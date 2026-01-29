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

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { companyId }: EnrichRequest = await req.json();

    if (!companyId) {
      throw new Error("companyId is required");
    }

    console.log(`Enriching company: ${companyId}`);

    // Fetch current company data
    const { data: company, error: fetchError } = await supabase
      .from("companies")
      .select("*")
      .eq("id", companyId)
      .single();

    if (fetchError || !company) {
      throw new Error(`Company not found: ${fetchError?.message}`);
    }

    console.log(`Found company: ${company.company_name}`);

    // Build the prompt for OpenAI
    const prompt = `You are a business intelligence assistant. Given the following company information, research and provide enriched data. Be factual and concise.

Company Name: ${company.company_name}
Website/Domain: ${company.website || company.domains || "unknown"}
Current Industry: ${company.industry || "unknown"}
Current Description: ${company.description || "none"}
Country: ${company.country || "unknown"}

Provide a JSON response with the following fields (only include fields where you have reasonable confidence, use null for unknown):
{
  "description": "2-3 sentences about what the company does, their main products/services",
  "industry": "Primary industry category",
  "employee_range": "Employee count range like '1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5000+'",
  "categories": "Comma-separated list of business categories/tags",
  "estimated_arr": "Estimated annual recurring revenue in USD (number only, null if unknown)",
  "country": "Country where headquarters is located"
}

Respond ONLY with valid JSON, no additional text.`;

    // Call OpenAI API
    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a business intelligence assistant that provides accurate company information in JSON format." },
          { role: "user", content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error("OpenAI API error:", errorText);
      throw new Error(`OpenAI API error: ${openaiResponse.status}`);
    }

    const openaiData = await openaiResponse.json();
    const enrichedText = openaiData.choices?.[0]?.message?.content;

    console.log("OpenAI response:", enrichedText);

    if (!enrichedText) {
      throw new Error("No response from OpenAI");
    }

    // Parse the JSON response
    let enrichedData;
    try {
      // Clean the response (remove markdown code blocks if present)
      const cleanedText = enrichedText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      enrichedData = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error("Failed to parse OpenAI response:", parseError);
      throw new Error("Failed to parse AI response");
    }

    // Prepare update object with only non-null values
    const updateData: Record<string, unknown> = {};
    
    if (enrichedData.description && !company.description) {
      updateData.description = enrichedData.description;
    }
    if (enrichedData.industry && !company.industry) {
      updateData.industry = enrichedData.industry;
    }
    if (enrichedData.employee_range && !company.employee_range) {
      updateData.employee_range = enrichedData.employee_range;
    }
    if (enrichedData.categories && !company.categories) {
      updateData.categories = enrichedData.categories;
    }
    if (enrichedData.estimated_arr && !company.estimated_arr) {
      updateData.estimated_arr = enrichedData.estimated_arr;
    }
    if (enrichedData.country && !company.country) {
      updateData.country = enrichedData.country;
    }

    console.log("Update data:", updateData);

    // Update the company record
    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase
        .from("companies")
        .update(updateData)
        .eq("id", companyId);

      if (updateError) {
        console.error("Update error:", updateError);
        throw new Error(`Failed to update company: ${updateError.message}`);
      }
    }

    // Fetch updated company
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
