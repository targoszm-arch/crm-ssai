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

// Extract company name from email domain
function extractCompanyFromEmail(email: string | null): string | null {
  if (!email) return null;
  
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return null;
  
  // Skip common personal email providers
  const personalDomains = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com", "aol.com", "protonmail.com", "mail.com"];
  if (personalDomains.includes(domain)) return null;
  
  // Extract company name from domain (remove .com, .io, etc.)
  const companyName = domain.split(".")[0];
  // Capitalize first letter
  return companyName.charAt(0).toUpperCase() + companyName.slice(1);
}

// Infer seniority from title
function inferSeniorityFromTitle(title: string | null): string | null {
  if (!title) return null;
  const t = title.toLowerCase();
  
  if (t.includes("ceo") || t.includes("cto") || t.includes("cfo") || t.includes("coo") || t.includes("chief")) return "C-Level";
  if (t.includes("founder") || t.includes("co-founder") || t.includes("owner")) return "Founder";
  if (t.includes("vp") || t.includes("vice president")) return "VP";
  if (t.includes("director")) return "Director";
  if (t.includes("manager") || t.includes("head of") || t.includes("lead")) return "Manager";
  if (t.includes("senior") || t.includes("sr.") || t.includes("sr ")) return "Senior";
  if (t.includes("junior") || t.includes("jr.") || t.includes("jr ") || t.includes("intern") || t.includes("trainee")) return "Entry";
  
  return "Mid";
}

// Infer function/department from title
function inferFunctionFromTitle(title: string | null): string | null {
  if (!title) return null;
  const t = title.toLowerCase();
  
  if (t.includes("sales") || t.includes("account executive") || t.includes("business development") || t.includes("bdr") || t.includes("sdr")) return "Sales";
  if (t.includes("marketing") || t.includes("brand") || t.includes("content") || t.includes("growth") || t.includes("demand gen")) return "Marketing";
  if (t.includes("engineer") || t.includes("developer") || t.includes("software") || t.includes("tech") || t.includes("devops")) return "Engineering";
  if (t.includes("product") || t.includes("pm")) return "Product";
  if (t.includes("design") || t.includes("ux") || t.includes("ui")) return "Design";
  if (t.includes("hr") || t.includes("human resources") || t.includes("people") || t.includes("talent") || t.includes("recruiting")) return "HR";
  if (t.includes("finance") || t.includes("accounting") || t.includes("controller") || t.includes("treasurer")) return "Finance";
  if (t.includes("operations") || t.includes("ops")) return "Operations";
  if (t.includes("legal") || t.includes("counsel")) return "Legal";
  if (t.includes("customer success") || t.includes("support") || t.includes("client")) return "Customer Success";
  
  return null;
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

    const { contactId }: EnrichRequest = await req.json();

    if (!contactId) {
      throw new Error("contactId is required");
    }

    console.log(`Enriching contact: ${contactId}`);

    // Fetch current contact data with company (specify FK to avoid ambiguity)
    const { data: contact, error: fetchError } = await supabase
      .from("contacts")
      .select("*, companies!contacts_company_id_fkey(company_name, industry, website)")
      .eq("id", contactId)
      .single();

    if (fetchError || !contact) {
      throw new Error(`Contact not found: ${fetchError?.message}`);
    }

    const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(" ");
    console.log(`Found contact: ${fullName}`);

    // Extract company from email if no company linked
    const inferredCompany = extractCompanyFromEmail(contact.email);
    const companyName = contact.companies?.company_name || inferredCompany;
    const companyIndustry = contact.companies?.industry;

    // Pre-infer some fields locally (faster, doesn't need AI)
    const inferredSeniority = inferSeniorityFromTitle(contact.title);
    const inferredFunction = inferFunctionFromTitle(contact.title);

    // Check if we have enough data to enrich
    const hasEmail = !!contact.email;
    const hasLinkedIn = !!contact.linkedin_url;
    const hasTitle = !!contact.title;
    const hasCompany = !!companyName;
    const hasMinimalData = hasEmail || hasLinkedIn || hasTitle || hasCompany;

    if (!hasMinimalData) {
      console.log("Insufficient data for enrichment");
      return new Response(
        JSON.stringify({
          success: true,
          contact,
          enrichedFields: [],
          message: "Add email, title, or LinkedIn URL for better enrichment results",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Build context for AI
    let companyContext = "Company: Unknown";
    if (companyName) {
      companyContext = `Company: ${companyName}`;
      if (companyIndustry) {
        companyContext += ` (Industry: ${companyIndustry})`;
      }
      if (inferredCompany && !contact.companies) {
        companyContext += " [inferred from email domain]";
      }
    }

    // Build the improved prompt for OpenAI
    const prompt = `You are a sales intelligence assistant helping with contact enrichment for a CRM. Your job is to make REASONABLE PROFESSIONAL INFERENCES based on available data.

## Contact Information
- Name: ${fullName || "Unknown"}
- Email: ${contact.email || "Unknown"}
- Current Title: ${contact.title || "Unknown"}
- ${companyContext}
- LinkedIn: ${contact.linkedin_url || "Not provided"}
${inferredSeniority ? `- Detected Seniority: ${inferredSeniority}` : ""}
${inferredFunction ? `- Detected Function: ${inferredFunction}` : ""}

## Your Task
Based on the information above, provide professional insights. You MUST make reasonable inferences - do not leave fields as null unless there is truly no basis for inference.

INFERENCE GUIDELINES:
- If title contains "Sales Director", function is "Sales" and seniority is "Director"
- If email is @enterprise-company.com, they likely work at an enterprise company
- VPs and C-Level executives typically have budget authority → "High" interest level
- Common pain points for Sales = hitting quotas, pipeline management, forecasting
- Common pain points for Engineering = technical debt, scaling, developer productivity

Provide a JSON response:
{
  "seniority_level": "${inferredSeniority || "One of: Entry, Mid, Senior, Manager, Director, VP, C-Level, Founder"}",
  "function": "${inferredFunction || "Department like Sales, Marketing, Engineering, Operations, Finance, HR, Product, Design, Legal, Customer Success"}",
  "buying_signals": "2-3 sentences about potential buying triggers based on their role and company type",
  "pain_point": "1-2 sentences about likely business challenges they face",
  "interest_level": "High, Medium, or Low - based on decision-making authority (VPs+ = High, Managers = Medium, ICs = Low)",
  "next_recommended_action": "Specific, actionable next step for sales outreach"
}

IMPORTANT: 
- Provide your BEST educated guess for each field
- Do NOT return null values - make reasonable inferences
- Keep responses concise but insightful

Respond ONLY with valid JSON.`;

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
          { 
            role: "system", 
            content: "You are a sales intelligence assistant. You ALWAYS provide reasonable professional inferences based on available data. Never return null values - make educated guesses based on common patterns in business roles." 
          },
          { role: "user", content: prompt }
        ],
        temperature: 0.5, // Slightly higher for more creative inferences
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

    console.log("OpenAI response:", enrichedText);

    if (!enrichedText) {
      throw new Error("No response from OpenAI");
    }

    // Parse the JSON response
    let enrichedData;
    try {
      const cleanedText = enrichedText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      enrichedData = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error("Failed to parse OpenAI response:", parseError);
      throw new Error("Failed to parse AI response");
    }

    // Prepare update object - ALWAYS update with AI values (force refresh)
    const updateData: Record<string, unknown> = {};
    const enrichedFields: string[] = [];
    
    // Use local inference as fallback, but prefer AI response
    const finalSeniority = enrichedData.seniority_level || inferredSeniority;
    const finalFunction = enrichedData.function || inferredFunction;

    if (finalSeniority) {
      updateData.seniority_level = finalSeniority;
      enrichedFields.push("seniority_level");
    }
    if (finalFunction) {
      updateData.function = finalFunction;
      enrichedFields.push("function");
    }
    if (enrichedData.buying_signals) {
      updateData.buying_signals = enrichedData.buying_signals;
      enrichedFields.push("buying_signals");
    }
    if (enrichedData.pain_point) {
      updateData.pain_point = enrichedData.pain_point;
      enrichedFields.push("pain_point");
    }
    if (enrichedData.interest_level) {
      updateData.interest_level = enrichedData.interest_level;
      enrichedFields.push("interest_level");
    }
    if (enrichedData.next_recommended_action) {
      updateData.next_recommended_action = enrichedData.next_recommended_action;
      enrichedFields.push("next_recommended_action");
    }

    console.log("Update data:", updateData);
    console.log("Enriched fields:", enrichedFields);

    // Update the contact record
    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase
        .from("contacts")
        .update(updateData)
        .eq("id", contactId);

      if (updateError) {
        console.error("Update error:", updateError);
        throw new Error(`Failed to update contact: ${updateError.message}`);
      }
    }

    // Fetch updated contact
    const { data: updatedContact } = await supabase
      .from("contacts")
      .select("*")
      .eq("id", contactId)
      .single();

    // Build success message
    let message = "";
    if (enrichedFields.length === 0) {
      message = "No new insights could be generated";
    } else {
      message = `Updated: ${enrichedFields.join(", ")}`;
    }

    return new Response(
      JSON.stringify({
        success: true,
        contact: updatedContact,
        enrichedFields,
        message,
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
