import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface EnrichRequest {
  companyId: string;
}

// Extract domain from website URL or domains field
function extractDomain(website: string | null, domains: string | null): string | null {
  const raw = website || domains;
  if (!raw) return null;
  try {
    let url = raw.trim();
    if (!url.startsWith("http")) url = `https://${url}`;
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    // Maybe it's already a bare domain
    return raw.replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0] || null;
  }
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const hunterApiKey = Deno.env.get("HUNTER_API_KEY");
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!hunterApiKey) throw new Error("HUNTER_API_KEY not configured");
    if (!openaiApiKey) throw new Error("OPENAI_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { companyId }: EnrichRequest = await req.json();
    if (!companyId) throw new Error("companyId is required");

    console.log(`Enriching company: ${companyId}`);

    // Verify company belongs to user
    const { data: company, error: fetchError } = await supabase
      .from("companies")
      .select("*")
      .eq("id", companyId)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !company) {
      throw new Error(`Company not found: ${fetchError?.message}`);
    }

    console.log(`Found company: ${company.company_name}`);

    const domain = extractDomain(company.website, company.domains);

    // Step 1: Call Hunter.io Company Enrichment API
    let hunterData: Record<string, unknown> | null = null;
    if (domain) {
      console.log(`Calling Hunter.io for domain: ${domain}`);
      const hunterUrl = `https://api.hunter.io/v2/companies/find?domain=${encodeURIComponent(domain)}&api_key=${hunterApiKey}`;
      const hunterRes = await fetch(hunterUrl);
      
      if (hunterRes.ok) {
        const hunterJson = await hunterRes.json();
        hunterData = hunterJson.data || null;
        console.log("Hunter.io data retrieved:", JSON.stringify(hunterData).substring(0, 500));
      } else {
        console.warn(`Hunter.io returned ${hunterRes.status}: ${await hunterRes.text()}`);
      }
    } else {
      console.log("No domain available, skipping Hunter.io lookup");
    }

    // Step 2: Also call Hunter Domain Search to get email count / patterns
    let domainSearchData: Record<string, unknown> | null = null;
    if (domain) {
      const dsUrl = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&limit=0&api_key=${hunterApiKey}`;
      const dsRes = await fetch(dsUrl);
      if (dsRes.ok) {
        const dsJson = await dsRes.json();
        domainSearchData = dsJson.data || null;
      }
    }

    // Step 3: Use OpenAI to fill gaps using Hunter data as context
    const hunterContext = hunterData
      ? `
Hunter.io Company Data:
- Description: ${(hunterData as any)?.description || "N/A"}
- Industry: ${(hunterData as any)?.industry || "N/A"}
- Company Type: ${(hunterData as any)?.company_type || "N/A"}
- Company Size: ${(hunterData as any)?.size || "N/A"}
- Founded: ${(hunterData as any)?.founded || "N/A"}
- Country: ${(hunterData as any)?.country || "N/A"}
- State: ${(hunterData as any)?.state || "N/A"}
- City: ${(hunterData as any)?.city || "N/A"}
- LinkedIn URL: ${(hunterData as any)?.linkedin || "N/A"}
- Twitter Handle: ${(hunterData as any)?.twitter || "N/A"}
- Technologies: ${JSON.stringify((hunterData as any)?.technologies || [])}
`
      : "No Hunter.io data available (no domain found).";

    const emailInfo = domainSearchData
      ? `Email patterns: ${(domainSearchData as any)?.pattern || "unknown"}, Organization: ${(domainSearchData as any)?.organization || "unknown"}`
      : "";

    const prompt = `You are a business intelligence assistant. Enrich this company using the real data from Hunter.io below, plus your knowledge.

Company Name: ${company.company_name}
Website/Domain: ${domain || "unknown"}
Current Industry: ${company.industry || "unknown"}
Current Description: ${company.description || "none"}
Country: ${company.country || "unknown"}

${hunterContext}
${emailInfo}

Provide a JSON response with the following fields. Use Hunter.io data as the primary source. Only use AI inference where Hunter.io data is missing. Use null for truly unknown fields:
{
  "description": "2-3 sentences about what the company does",
  "industry": "Primary industry category",
  "employee_range": "One of: 1-10, 11-50, 51-200, 201-500, 501-1000, 1001-5000, 5000+",
  "categories": "Comma-separated business categories/tags",
  "estimated_arr": "Estimated annual recurring revenue in USD (number only, null if unknown)",
  "country": "HQ country",
  "address": "Full address if available",
  "linkedin_url": "LinkedIn company URL if found",
  "foundation_date": "YYYY-MM-DD format if known, null otherwise",
  "employee_count": "Number if known, null otherwise",
  "funding_raised": "Total funding in USD if known, null otherwise",
  "annual_turnover": "Annual revenue in USD if known, null otherwise"
}

Respond ONLY with valid JSON.`;

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a business intelligence assistant. Prioritize real data from Hunter.io. Fill gaps with reasonable inferences. Return valid JSON only." },
          { role: "user", content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 600,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error("OpenAI API error:", errorText);
      throw new Error(`OpenAI API error: ${openaiResponse.status}`);
    }

    const openaiData = await openaiResponse.json();
    const enrichedText = openaiData.choices?.[0]?.message?.content;

    if (!enrichedText) throw new Error("No response from OpenAI");

    let enrichedData;
    try {
      const cleanedText = enrichedText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      enrichedData = JSON.parse(cleanedText);
    } catch {
      console.error("Failed to parse OpenAI response:", enrichedText);
      throw new Error("Failed to parse AI response");
    }

    // Prepare update — only fill empty fields
    const updateData: Record<string, unknown> = {};
    
    const fieldMap: Record<string, string> = {
      description: "description",
      industry: "industry",
      employee_range: "employee_range",
      categories: "categories",
      estimated_arr: "estimated_arr",
      country: "country",
      address: "address",
      linkedin_url: "linkedin_url",
      foundation_date: "foundation_date",
      employee_count: "employee_count",
      funding_raised: "funding_raised",
      annual_turnover: "annual_turnover",
    };

    for (const [aiField, dbField] of Object.entries(fieldMap)) {
      if (enrichedData[aiField] != null && !company[dbField]) {
        updateData[dbField] = enrichedData[aiField];
      }
    }

    console.log("Update data:", updateData);

    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase
        .from("companies")
        .update(updateData)
        .eq("id", companyId);

      if (updateError) {
        throw new Error(`Failed to update company: ${updateError.message}`);
      }
    }

    const { data: updatedCompany } = await supabase
      .from("companies")
      .select("*")
      .eq("id", companyId)
      .single();

    return new Response(
      JSON.stringify({
        success: true,
        company: updatedCompany,
        enrichedFields: Object.keys(updateData),
        sources: { hunter: !!hunterData, openai: true },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    console.error("Error enriching company:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
