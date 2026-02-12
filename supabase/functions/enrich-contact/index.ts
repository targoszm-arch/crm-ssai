import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface EnrichRequest {
  contactId: string;
}

function inferSeniorityFromTitle(title: string | null): string | null {
  if (!title) return null;
  const t = title.toLowerCase();
  if (t.includes("ceo") || t.includes("cto") || t.includes("cfo") || t.includes("coo") || t.includes("chief")) return "C-Level";
  if (t.includes("founder") || t.includes("co-founder") || t.includes("owner")) return "Founder";
  if (t.includes("vp") || t.includes("vice president")) return "VP";
  if (t.includes("director")) return "Director";
  if (t.includes("manager") || t.includes("head of") || t.includes("lead")) return "Manager";
  if (t.includes("senior") || t.includes("sr.") || t.includes("sr ")) return "Senior";
  if (t.includes("junior") || t.includes("jr.") || t.includes("intern") || t.includes("trainee")) return "Entry";
  return "Mid";
}

function inferFunctionFromTitle(title: string | null): string | null {
  if (!title) return null;
  const t = title.toLowerCase();
  if (t.includes("sales") || t.includes("account executive") || t.includes("business development") || t.includes("bdr") || t.includes("sdr")) return "Sales";
  if (t.includes("marketing") || t.includes("brand") || t.includes("content") || t.includes("growth")) return "Marketing";
  if (t.includes("engineer") || t.includes("developer") || t.includes("software") || t.includes("tech")) return "Engineering";
  if (t.includes("product") || t.includes("pm")) return "Product";
  if (t.includes("design") || t.includes("ux") || t.includes("ui")) return "Design";
  if (t.includes("hr") || t.includes("human resources") || t.includes("people") || t.includes("talent")) return "HR";
  if (t.includes("finance") || t.includes("accounting")) return "Finance";
  if (t.includes("operations") || t.includes("ops")) return "Operations";
  if (t.includes("legal") || t.includes("counsel")) return "Legal";
  if (t.includes("customer success") || t.includes("support") || t.includes("client")) return "Customer Success";
  return null;
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

    const { contactId }: EnrichRequest = await req.json();
    if (!contactId) throw new Error("contactId is required");

    console.log(`Enriching contact: ${contactId}`);

    // Verify contact belongs to user
    const { data: contact, error: fetchError } = await supabase
      .from("contacts")
      .select("*, companies!contacts_company_id_fkey(company_name, industry, website, domains)")
      .eq("id", contactId)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !contact) {
      throw new Error(`Contact not found: ${fetchError?.message}`);
    }

    const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(" ");
    console.log(`Found contact: ${fullName}`);

    // Step 1: Call Hunter.io Email Enrichment if email available
    let hunterPersonData: Record<string, unknown> | null = null;
    if (contact.email) {
      console.log(`Calling Hunter.io for email: ${contact.email}`);
      const hunterUrl = `https://api.hunter.io/v2/people/find?email=${encodeURIComponent(contact.email)}&api_key=${hunterApiKey}`;
      const hunterRes = await fetch(hunterUrl);

      if (hunterRes.ok) {
        const hunterJson = await hunterRes.json();
        hunterPersonData = hunterJson.data || null;
        console.log("Hunter.io person data:", JSON.stringify(hunterPersonData).substring(0, 500));
      } else {
        console.warn(`Hunter.io returned ${hunterRes.status}`);
      }
    }

    // Step 2: Try Combined Enrichment if we have both first/last name and domain
    let hunterCombinedData: Record<string, unknown> | null = null;
    const companyWebsite = contact.companies?.website || contact.companies?.domains;
    if (!hunterPersonData && contact.first_name && contact.last_name && companyWebsite) {
      let domain = companyWebsite;
      try {
        if (!domain.startsWith("http")) domain = `https://${domain}`;
        domain = new URL(domain).hostname.replace(/^www\./, "");
      } catch { /* use as-is */ }
      
      console.log(`Trying Hunter combined enrichment: ${contact.first_name} ${contact.last_name} @ ${domain}`);
      const combUrl = `https://api.hunter.io/v2/combined/find?first_name=${encodeURIComponent(contact.first_name)}&last_name=${encodeURIComponent(contact.last_name)}&domain=${encodeURIComponent(domain)}&api_key=${hunterApiKey}`;
      const combRes = await fetch(combUrl);
      if (combRes.ok) {
        const combJson = await combRes.json();
        hunterCombinedData = combJson.data || null;
      }
    }

    const hunterPerson = hunterPersonData || hunterCombinedData;

    // Pre-infer some fields locally
    const inferredSeniority = inferSeniorityFromTitle(contact.title);
    const inferredFunction = inferFunctionFromTitle(contact.title);

    const companyName = contact.companies?.company_name || null;
    const companyIndustry = contact.companies?.industry || null;

    // Build Hunter context for AI
    const hunterContext = hunterPerson
      ? `
Hunter.io Person Data:
- Full Name: ${(hunterPerson as any)?.first_name || ""} ${(hunterPerson as any)?.last_name || ""}
- Position: ${(hunterPerson as any)?.position || "N/A"}
- Seniority: ${(hunterPerson as any)?.seniority || "N/A"}
- Department: ${(hunterPerson as any)?.department || "N/A"}
- LinkedIn: ${(hunterPerson as any)?.linkedin || "N/A"}
- Twitter: ${(hunterPerson as any)?.twitter || "N/A"}
- Phone: ${(hunterPerson as any)?.phone_number || "N/A"}
- Company: ${(hunterPerson as any)?.company || "N/A"}
`
      : "No Hunter.io person data available.";

    const prompt = `You are a sales intelligence assistant. Enrich this contact using the real data from Hunter.io below, combined with your professional knowledge.

## Contact Information
- Name: ${fullName || "Unknown"}
- Email: ${contact.email || "Unknown"}
- Current Title: ${contact.title || "Unknown"}
- Company: ${companyName || "Unknown"} (Industry: ${companyIndustry || "Unknown"})
- LinkedIn: ${contact.linkedin_url || "Not provided"}
${inferredSeniority ? `- Detected Seniority: ${inferredSeniority}` : ""}
${inferredFunction ? `- Detected Function: ${inferredFunction}` : ""}

${hunterContext}

## Your Task
Provide a JSON response. Use Hunter.io data as primary source. Fill gaps with reasonable professional inferences.

{
  "seniority_level": "One of: Entry, Mid, Senior, Manager, Director, VP, C-Level, Founder",
  "function": "Department like Sales, Marketing, Engineering, etc.",
  "buying_signals": "2-3 sentences about potential buying triggers",
  "pain_point": "1-2 sentences about likely business challenges",
  "interest_level": "High, Medium, or Low based on decision-making authority",
  "next_recommended_action": "Specific, actionable next step for outreach",
  "linkedin_url": "LinkedIn URL if found by Hunter, null otherwise",
  "phone": "Phone number if found by Hunter, null otherwise",
  "title": "Updated job title if Hunter has better data, null otherwise"
}

IMPORTANT: Do NOT return null values for seniority/function/buying_signals/pain_point/interest_level/next_recommended_action - make reasonable inferences.

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
          { role: "system", content: "You are a sales intelligence assistant. Prioritize real Hunter.io data. Fill gaps with educated inferences. Return valid JSON only." },
          { role: "user", content: prompt }
        ],
        temperature: 0.5,
        max_tokens: 600,
      }),
    });

    if (!openaiResponse.ok) {
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
      throw new Error("Failed to parse AI response");
    }

    // Prepare update
    const updateData: Record<string, unknown> = {};
    const enrichedFields: string[] = [];

    const finalSeniority = enrichedData.seniority_level || inferredSeniority;
    const finalFunction = enrichedData.function || inferredFunction;

    if (finalSeniority) { updateData.seniority_level = finalSeniority; enrichedFields.push("seniority_level"); }
    if (finalFunction) { updateData.function = finalFunction; enrichedFields.push("function"); }
    if (enrichedData.buying_signals) { updateData.buying_signals = enrichedData.buying_signals; enrichedFields.push("buying_signals"); }
    if (enrichedData.pain_point) { updateData.pain_point = enrichedData.pain_point; enrichedFields.push("pain_point"); }
    if (enrichedData.interest_level) { updateData.interest_level = enrichedData.interest_level; enrichedFields.push("interest_level"); }
    if (enrichedData.next_recommended_action) { updateData.next_recommended_action = enrichedData.next_recommended_action; enrichedFields.push("next_recommended_action"); }
    
    // Only fill empty fields for contact details
    if (enrichedData.linkedin_url && !contact.linkedin_url) { updateData.linkedin_url = enrichedData.linkedin_url; enrichedFields.push("linkedin_url"); }
    if (enrichedData.phone && !contact.phone) { updateData.phone = enrichedData.phone; enrichedFields.push("phone"); }
    if (enrichedData.title && !contact.title) { updateData.title = enrichedData.title; enrichedFields.push("title"); }

    console.log("Update data:", updateData);

    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase
        .from("contacts")
        .update(updateData)
        .eq("id", contactId);

      if (updateError) {
        throw new Error(`Failed to update contact: ${updateError.message}`);
      }
    }

    const { data: updatedContact } = await supabase
      .from("contacts")
      .select("*")
      .eq("id", contactId)
      .single();

    return new Response(
      JSON.stringify({
        success: true,
        contact: updatedContact,
        enrichedFields,
        sources: { hunter: !!hunterPerson, openai: true },
        message: enrichedFields.length > 0 ? `Updated: ${enrichedFields.join(", ")}` : "No new insights",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    console.error("Error enriching contact:", error);
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
