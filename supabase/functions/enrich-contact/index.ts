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

    // Build the prompt for OpenAI
    const companyInfo = contact.companies 
      ? `Company: ${contact.companies.company_name || "unknown"}, Industry: ${contact.companies.industry || "unknown"}`
      : "Company: unknown";

    const prompt = `You are a sales intelligence assistant. Given the following contact information, provide enriched professional insights. Be factual and helpful for sales outreach.

Name: ${fullName}
Email: ${contact.email || "unknown"}
Current Title: ${contact.title || "unknown"}
${companyInfo}
LinkedIn: ${contact.linkedin_url || "unknown"}

Provide a JSON response with the following fields (only include fields where you have reasonable confidence, use null for unknown):
{
  "title": "Professional job title (if current title is missing or incomplete)",
  "seniority_level": "One of: Entry, Mid, Senior, Manager, Director, VP, C-Level, Founder",
  "function": "Department/function like Sales, Marketing, Engineering, Operations, Finance, HR, etc.",
  "buying_signals": "Brief description of potential buying signals or indicators of interest based on their role",
  "pain_point": "Likely business pain points based on their role and industry",
  "interest_level": "One of: High, Medium, Low - based on typical engagement patterns for this role",
  "next_recommended_action": "Suggested next action for sales outreach"
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
          { role: "system", content: "You are a sales intelligence assistant that provides professional contact insights in JSON format." },
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
      const cleanedText = enrichedText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      enrichedData = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error("Failed to parse OpenAI response:", parseError);
      throw new Error("Failed to parse AI response");
    }

    // Prepare update object with only non-null values for empty fields
    const updateData: Record<string, unknown> = {};
    
    if (enrichedData.title && !contact.title) {
      updateData.title = enrichedData.title;
    }
    if (enrichedData.seniority_level && !contact.seniority_level) {
      updateData.seniority_level = enrichedData.seniority_level;
    }
    if (enrichedData.function && !contact.function) {
      updateData.function = enrichedData.function;
    }
    if (enrichedData.buying_signals && !contact.buying_signals) {
      updateData.buying_signals = enrichedData.buying_signals;
    }
    if (enrichedData.pain_point && !contact.pain_point) {
      updateData.pain_point = enrichedData.pain_point;
    }
    if (enrichedData.interest_level && !contact.interest_level) {
      updateData.interest_level = enrichedData.interest_level;
    }
    if (enrichedData.next_recommended_action && !contact.next_recommended_action) {
      updateData.next_recommended_action = enrichedData.next_recommended_action;
    }

    console.log("Update data:", updateData);

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

    return new Response(
      JSON.stringify({
        success: true,
        contact: updatedContact,
        enrichedFields: Object.keys(updateData),
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
