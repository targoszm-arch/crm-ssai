import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  contactFieldsFromApollo,
  matchPerson,
  toDomain,
  type ApolloPerson,
} from "../_shared/apollo.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Which data source to spend on.
//   auto   — Apollo first, Hunter only if Apollo missed. The default, and the cheapest
//            way to get the best answer: two providers are only worth two credits when
//            the first one came back empty.
//   apollo — Apollo only. Skips Hunter even on a miss.
//   hunter — Hunter only. The behaviour this function had before Apollo existed, kept
//            so a bulk run can be pinned to one provider's billing.
// OpenAI runs in every mode; it is what turns facts into buying_signals and pain_point,
// and it is asked for less the more the providers already answered.
type EnrichProvider = "auto" | "apollo" | "hunter";

interface EnrichRequest {
  contactId: string;
  provider?: EnrichProvider;
}

function parseProvider(value: unknown): EnrichProvider {
  return value === "apollo" || value === "hunter" ? value : "auto";
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
    const apolloApiKey = Deno.env.get("APOLLO_API_KEY");
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) throw new Error("OPENAI_API_KEY not configured");

    const body: EnrichRequest = await req.json();
    const { contactId } = body;
    const provider = parseProvider(body.provider);
    if (!contactId) throw new Error("contactId is required");

    // Only the provider actually being asked for has to be configured. Requiring both
    // keys up front is what would make an Apollo-only account unable to enrich at all.
    if (provider === "hunter" && !hunterApiKey) throw new Error("HUNTER_API_KEY not configured");
    if (provider === "apollo" && !apolloApiKey) throw new Error("APOLLO_API_KEY not configured");
    if (provider === "auto" && !hunterApiKey && !apolloApiKey) {
      throw new Error("No enrichment provider configured — set APOLLO_API_KEY or HUNTER_API_KEY");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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

    const companyDomain = toDomain(contact.companies?.website || contact.companies?.domains);

    // Step 0: Apollo. Runs first because it returns facts where OpenAI would return a
    // confident inference — title, seniority, department, phone, location. Everything it
    // answers is one less thing the model is asked to guess.
    let apolloPerson: ApolloPerson | null = null;
    let apolloError: string | null = null;
    if (apolloApiKey && (provider === "apollo" || provider === "auto")) {
      try {
        apolloPerson = await matchPerson(apolloApiKey, {
          email: contact.email,
          firstName: contact.first_name,
          lastName: contact.last_name,
          domain: companyDomain,
          organizationName: contact.companies?.company_name ?? null,
          linkedinUrl: contact.linkedin_url,
        });
        console.log(apolloPerson ? `Apollo matched ${fullName}` : `Apollo had no match for ${fullName}`);
      } catch (err) {
        // A provider being out of credits should degrade the result, not fail the call —
        // Hunter and OpenAI can still say something useful. Surfaced in the response so
        // a bulk run reports "3 of 40 hit the Apollo limit" rather than silently thinning.
        apolloError = err instanceof Error ? err.message : String(err);
        console.warn("Apollo lookup failed:", apolloError);
      }
    }

    // Hunter is the fallback, not a second opinion: in auto mode a successful Apollo
    // match skips it, so the common case costs one credit rather than two.
    const useHunter = Boolean(hunterApiKey) &&
      (provider === "hunter" || (provider === "auto" && !apolloPerson));

    // Step 1: Call Hunter.io Email Enrichment if email available
    let hunterPersonData: Record<string, unknown> | null = null;
    if (useHunter && contact.email) {
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
    if (useHunter && !hunterPersonData && contact.first_name && contact.last_name && companyDomain) {
      const domain = companyDomain;
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

    // Apollo's own view, given to the model as established fact rather than as a hint.
    const apolloContext = apolloPerson
      ? `
Apollo Person Data (VERIFIED — treat as fact, do not contradict):
- Name: ${apolloPerson.name || `${apolloPerson.first_name ?? ""} ${apolloPerson.last_name ?? ""}`.trim() || "N/A"}
- Title: ${apolloPerson.title || "N/A"}
- Seniority: ${apolloPerson.seniority || "N/A"}
- Departments: ${(apolloPerson.departments ?? []).join(", ") || "N/A"}
- Company: ${apolloPerson.organization?.name || "N/A"}
- Industry: ${apolloPerson.organization?.industry || "N/A"}
- Employees: ${apolloPerson.organization?.estimated_num_employees ?? "N/A"}
- Location: ${[apolloPerson.city, apolloPerson.state, apolloPerson.country].filter(Boolean).join(", ") || "N/A"}
- LinkedIn: ${apolloPerson.linkedin_url || "N/A"}
`
      : "No Apollo data available.";

    const prompt = `You are a sales intelligence assistant. Enrich this contact using the real data below, combined with your professional knowledge.

## Contact Information
- Name: ${fullName || "Unknown"}
- Email: ${contact.email || "Unknown"}
- Current Title: ${contact.title || "Unknown"}
- Company: ${companyName || "Unknown"} (Industry: ${companyIndustry || "Unknown"})
- LinkedIn: ${contact.linkedin_url || "Not provided"}
${inferredSeniority ? `- Detected Seniority: ${inferredSeniority}` : ""}
${inferredFunction ? `- Detected Function: ${inferredFunction}` : ""}

${apolloContext}
${hunterContext}

## Your Task
Provide a JSON response. Apollo data is verified and outranks Hunter.io; Hunter.io outranks your own knowledge. Fill remaining gaps with reasonable professional inferences.

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

    // Apollo's stated facts go in first and are then protected below, so a model that
    // decides a VP is "Senior" cannot overwrite a title Apollo verified. This is the whole
    // reason for wiring a data provider in ahead of the model rather than beside it.
    //
    // These DO overwrite what is already on the row, unlike the AI pass, which only fills
    // blanks. That is deliberate: nearly every contact here came from a LinkedIn scrape
    // and the job title on it is however old the scrape is. Correcting a stale title is
    // what the credit is being spent on.
    const apolloFields = apolloPerson ? contactFieldsFromApollo(apolloPerson) : {};
    for (const [key, value] of Object.entries(apolloFields)) {
      updateData[key] = value;
      enrichedFields.push(key);
    }
    const fromApollo = (field: string) => Object.hasOwn(apolloFields, field);

    const finalSeniority = enrichedData.seniority_level || inferredSeniority;
    const finalFunction = enrichedData.function || inferredFunction;

    if (finalSeniority && !fromApollo("seniority_level")) { updateData.seniority_level = finalSeniority; enrichedFields.push("seniority_level"); }
    if (finalFunction && !fromApollo("function")) { updateData.function = finalFunction; enrichedFields.push("function"); }
    if (enrichedData.buying_signals) { updateData.buying_signals = enrichedData.buying_signals; enrichedFields.push("buying_signals"); }
    if (enrichedData.pain_point) { updateData.pain_point = enrichedData.pain_point; enrichedFields.push("pain_point"); }
    if (enrichedData.interest_level) { updateData.interest_level = enrichedData.interest_level; enrichedFields.push("interest_level"); }
    if (enrichedData.next_recommended_action) { updateData.next_recommended_action = enrichedData.next_recommended_action; enrichedFields.push("next_recommended_action"); }
    
    // Only fill empty fields for contact details, and never over an Apollo answer.
    if (enrichedData.linkedin_url && !contact.linkedin_url && !fromApollo("linkedin_url")) { updateData.linkedin_url = enrichedData.linkedin_url; enrichedFields.push("linkedin_url"); }
    if (enrichedData.phone && !contact.phone && !fromApollo("phone")) { updateData.phone = enrichedData.phone; enrichedFields.push("phone"); }
    if (enrichedData.title && !contact.title && !fromApollo("title")) { updateData.title = enrichedData.title; enrichedFields.push("title"); }

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
        provider,
        sources: { apollo: !!apolloPerson, hunter: !!hunterPerson, openai: true },
        ...(apolloError ? { apolloError } : {}),
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
