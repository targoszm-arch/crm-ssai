import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

// Common email providers to skip when matching companies
const COMMON_EMAIL_PROVIDERS = [
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "icloud.com",
  "aol.com",
  "protonmail.com",
  "mail.com",
  "zoho.com",
  "yandex.com",
  "live.com",
  "msn.com",
];

interface LMSPayload {
  user_id?: string;
  email: string;
  name?: string;
  role?: string;
  company_size?: string;
  use_case?: string;
  learning_objectives?: string;
  marketing_consent?: boolean;
  verified?: boolean;
  created_at?: string;
  credits_used?: number;
  credits_total?: number;
  plan?: string;
  crm_user_id: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate API key
    const apiKey = req.headers.get("x-api-key");
    const expectedApiKey = Deno.env.get("CRM_WEBHOOK_API_KEY");

    if (!apiKey || apiKey !== expectedApiKey) {
      console.error("Invalid or missing API key");
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid API key" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Only accept POST requests
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse payload
    const payload: LMSPayload = await req.json();
    console.log("Received LMS webhook payload:", JSON.stringify(payload));

    // Validate required fields
    if (!payload.email) {
      return new Response(
        JSON.stringify({ error: "Missing required field: email" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!payload.crm_user_id) {
      return new Response(
        JSON.stringify({ error: "Missing required field: crm_user_id" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(payload.email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const userId = payload.crm_user_id;
    const email = payload.email.toLowerCase().trim();

    // Parse name into first and last name
    let firstName = "";
    let lastName = "";
    if (payload.name) {
      const nameParts = payload.name.trim().split(" ");
      firstName = nameParts[0] || "";
      lastName = nameParts.slice(1).join(" ") || "";
    }

    // Find the existing contact by email, case-insensitively, and tolerate more than one.
    //
    // WHY NOT .eq(...).maybeSingle(), WHICH IS WHAT THIS WAS. Two ways that produced a
    // duplicate contact on a signup from someone already in the CRM:
    //
    //   1. CASE. `email` above is lowercased, but .eq() is an exact match and 30 of the
    //      2,802 contacts carry a mixed-case address (Meet Alfred and LinkedIn imports
    //      write them as typed — "Shane.OHanlon@intertradeireland.com"). Lowercasing one
    //      side of an exact comparison finds nothing, so the webhook created a second row
    //      for a person it already had.
    //   2. MULTIPLE MATCHES. maybeSingle() errors when more than one row comes back, and
    //      that error was only logged — execution carried on with existingContact
    //      undefined and inserted anyway. So an email that was already duplicated got a
    //      THIRD row, every single time that person did anything. One address is already
    //      duplicated today.
    //
    // ilike is the case-insensitive match. The address is escaped first because ilike
    // treats _ and % as wildcards and both are legal in an email local part — without it,
    // "a_b@x.com" would match "aXb@x.com" and attach a signup to a stranger.
    //
    // Ordering by created_at and taking the first makes the choice deterministic: the
    // oldest row wins, so repeated signups keep landing on the same contact instead of
    // ping-ponging between duplicates.
    //
    // contacts has no unique index on email (only on email_status), so nothing downstream
    // catches a duplicate the lookup misses. This function is the only guard there is.
    const emailPattern = email.replace(/([\\%_])/g, "\\$1");
    console.log(`Looking for existing contact with email: ${email}`);
    const { data: matchedContacts, error: contactError } = await supabase
      .from("contacts")
      .select("id, company_id")
      .ilike("email", emailPattern)
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1);

    if (contactError) {
      // Still only logged, but now it cannot silently cause an insert: a failed lookup
      // means we do not know whether the contact exists, and guessing "no" is what
      // created the duplicates.
      console.error("Error finding contact:", contactError);
      return new Response(
        JSON.stringify({
          error: "Contact lookup failed",
          message: contactError.message,
        }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const existingContact = matchedContacts?.[0] ?? null;
    let contactId = existingContact?.id || null;
    let companyId = existingContact?.company_id || null;

    // If no company linked, try to match by email domain
    if (!companyId) {
      const emailDomain = email.split("@")[1];
      
      if (emailDomain && !COMMON_EMAIL_PROVIDERS.includes(emailDomain)) {
        console.log(`Looking for company with domain: ${emailDomain}`);
        
        // Check domains column or website
        const { data: matchedCompany, error: companyError } = await supabase
          .from("companies")
          .select("id")
          .eq("user_id", userId)
          .or(`domains.ilike.%${emailDomain}%,website.ilike.%${emailDomain}%`)
          .maybeSingle();

        if (companyError) {
          console.error("Error finding company:", companyError);
        } else if (matchedCompany) {
          companyId = matchedCompany.id;
          console.log(`Matched company by domain: ${companyId}`);
        }
      }
    }

    // Create new contact if none exists
    if (!contactId) {
      console.log("Creating new contact for LMS lead");
      const { data: newContact, error: createContactError } = await supabase
        .from("contacts")
        .insert({
          user_id: userId,
          email: email,
          first_name: firstName || email.split("@")[0],
          last_name: lastName || null,
          company_id: companyId,
          labels: "LMS Lead",
          notes: `Created from LMS webhook on ${new Date().toISOString()}`,
        })
        .select("id")
        .single();

      if (createContactError) {
        console.error("Error creating contact:", createContactError);
      } else if (newContact) {
        contactId = newContact.id;
        console.log(`Created new contact: ${contactId}`);
      }
    }

    // Upsert LMS lead
    const lmsLeadData = {
      user_id: userId,
      email: email,
      full_name: payload.name || email.split("@")[0],
      role: payload.role || null,
      company_size: payload.company_size || null,
      use_case: payload.use_case || null,
      learning_objectives: payload.learning_objectives || null,
      marketing_consent: payload.marketing_consent ?? false,
      verified: payload.verified ?? false,
      lms_created_at: payload.created_at || null,
      credits_used: payload.credits_used ?? 0,
      credits_total: payload.credits_total ?? 0,
      plan: payload.plan || null,
      lms_user_id: payload.user_id || null,
      contact_id: contactId,
      company_id: companyId,
      source: "skillstudio",
      raw_payload: payload,
      updated_at: new Date().toISOString(),
    };

    console.log("Upserting LMS lead:", JSON.stringify(lmsLeadData));

    // Check if lead exists (by email + user_id)
    const { data: existingLead } = await supabase
      .from("lms_leads")
      .select("id")
      .eq("email", email)
      .eq("user_id", userId)
      .maybeSingle();

    let result;
    if (existingLead) {
      // Update existing lead
      const { data, error } = await supabase
        .from("lms_leads")
        .update(lmsLeadData)
        .eq("id", existingLead.id)
        .select()
        .single();
      
      if (error) throw error;
      result = { action: "updated", lead: data };
      console.log(`Updated existing LMS lead: ${existingLead.id}`);
    } else {
      // Insert new lead
      const { data, error } = await supabase
        .from("lms_leads")
        .insert(lmsLeadData)
        .select()
        .single();
      
      if (error) throw error;
      result = { action: "created", lead: data };
      console.log(`Created new LMS lead: ${data.id}`);
    }

    // Create activity record
    if (contactId) {
      await supabase.from("activities").insert({
        user_id: userId,
        contact_id: contactId,
        company_id: companyId,
        activity_type: "lms_registration",
        description: `LMS registration: ${payload.plan || "Unknown plan"}`,
        source: "lms-webhook",
        metadata: {
          plan: payload.plan,
          credits_total: payload.credits_total,
          verified: payload.verified,
        },
      });
      console.log("Created activity record for contact");
    }

    return new Response(
      JSON.stringify({
        success: true,
        ...result,
        contact_id: contactId,
        company_id: companyId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("LMS webhook error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
