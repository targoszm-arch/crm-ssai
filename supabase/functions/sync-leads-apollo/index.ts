import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const APOLLO_API_URL = "https://api.apollo.io/api/v1/people/match";
const BATCH_SIZE = 50;
const DELAY_MS = 300; // rate-limit delay between API calls

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apolloApiKey = Deno.env.get("APOLLO_API_KEY");
    if (!apolloApiKey) {
      return new Response(
        JSON.stringify({ error: "APOLLO_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse optional parameters
    let force = false;
    let userId: string | null = null;

    if (req.method === "POST") {
      try {
        const body = await req.json();
        force = body.force === true;
        userId = body.user_id || null;
      } catch {
        // No body or invalid JSON, use defaults
      }
    }

    // Also try to get user from auth header (for manual triggers)
    if (!userId) {
      const authHeader = req.headers.get("Authorization");
      if (authHeader) {
        const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
        const { data: { user } } = await supabaseAuth.auth.getUser(
          authHeader.replace("Bearer ", "")
        );
        if (user) userId = user.id;
      }
    }

    // Query unsynced leads
    let query = supabase
      .from("lms_leads")
      .select("id, email, full_name, company_id")
      .limit(BATCH_SIZE);

    if (!force) {
      query = query.is("apollo_synced_at", null);
    }

    if (userId) {
      query = query.eq("user_id", userId);
    }

    const { data: leads, error: fetchError } = await query;

    if (fetchError) {
      console.error("Error fetching leads:", fetchError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch leads", details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!leads || leads.length === 0) {
      return new Response(
        JSON.stringify({ message: "No leads to sync", synced: 0, errors: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Collect unique company IDs to batch-fetch company names
    const companyIds = [...new Set(leads.filter((l) => l.company_id).map((l) => l.company_id))];
    const companyMap: Record<string, string> = {};

    if (companyIds.length > 0) {
      const { data: companies } = await supabase
        .from("companies")
        .select("id, company_name")
        .in("id", companyIds);

      if (companies) {
        for (const c of companies) {
          companyMap[c.id] = c.company_name;
        }
      }
    }

    let synced = 0;
    let errors = 0;
    const results: Array<{ lead_id: string; status: string; apollo_contact_id?: string; error?: string }> = [];

    for (const lead of leads) {
      try {
        // Split full_name into first/last
        const nameParts = (lead.full_name || "").trim().split(/\s+/);
        const firstName = nameParts[0] || "";
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";
        const organizationName = lead.company_id ? companyMap[lead.company_id] || "" : "";

        // Call Apollo People Match API
        const apolloResponse = await fetch(APOLLO_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apolloApiKey,
          },
          body: JSON.stringify({
            email: lead.email,
            first_name: firstName,
            last_name: lastName,
            organization_name: organizationName || undefined,
          }),
        });

        if (!apolloResponse.ok) {
          const errorText = await apolloResponse.text();
          console.error(`Apollo API error for lead ${lead.id}:`, apolloResponse.status, errorText);
          errors++;
          results.push({ lead_id: lead.id, status: "error", error: `Apollo API ${apolloResponse.status}` });
          await sleep(DELAY_MS);
          continue;
        }

        const apolloData = await apolloResponse.json();
        const apolloContactId = apolloData?.person?.id || apolloData?.id || null;

        // Update the lead with sync info
        const { error: updateError } = await supabase
          .from("lms_leads")
          .update({
            apollo_synced_at: new Date().toISOString(),
            apollo_contact_id: apolloContactId,
          })
          .eq("id", lead.id);

        if (updateError) {
          console.error(`Failed to update lead ${lead.id}:`, updateError);
          errors++;
          results.push({ lead_id: lead.id, status: "error", error: updateError.message });
        } else {
          synced++;
          results.push({ lead_id: lead.id, status: "synced", apollo_contact_id: apolloContactId });
        }
      } catch (err) {
        console.error(`Unexpected error for lead ${lead.id}:`, err);
        errors++;
        results.push({ lead_id: lead.id, status: "error", error: String(err) });
      }

      await sleep(DELAY_MS);
    }

    console.log(`Apollo sync complete: ${synced} synced, ${errors} errors out of ${leads.length} leads`);

    return new Response(
      JSON.stringify({
        message: "Apollo sync complete",
        total: leads.length,
        synced,
        errors,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Sync leads to Apollo error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
