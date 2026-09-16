import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Trial-funnel aggregates for the growth dashboard, read live from the LMS.
//
// Same shape as fetch-lms-customers: a signed-in CRM user asks, this function
// calls the LMS's public endpoint with the shared key, and the answer is
// displayed but never stored. That matters — the system of record is
// LMS -> CRM -> Resend, one direction, and a cached copy of the funnel in this
// database would be a second source of truth competing with the first.
//
// The LMS side returns counts only. Nothing identifying anyone crosses over.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LMS_FUNNEL_URL =
  "https://oxlujbymtjugefaqmwuy.supabase.co/functions/v1/crm-trial-funnel";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return json({ error: "Unauthorized" }, 401);

  const crmApiKey = Deno.env.get("CRM_WEBHOOK_API_KEY");
  if (!crmApiKey) {
    console.error("[fetch-lms-funnel] CRM_WEBHOOK_API_KEY not configured");
    return json({ error: "The LMS connection is not configured." }, 500);
  }

  let response: Response;
  try {
    response = await fetch(LMS_FUNNEL_URL, {
      method: "GET",
      headers: { "X-API-Key": crmApiKey, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[fetch-lms-funnel] LMS unreachable:", (e as Error)?.message);
    // 503, not 500: the CRM is fine, the LMS did not answer. The dashboard
    // renders its own sections either way and says this one is unavailable,
    // rather than showing zeros that look like real numbers.
    return json({ error: "The LMS did not respond." }, 503);
  }

  if (!response.ok) {
    // Never pass the LMS body through verbatim — an upstream error can echo
    // request details, and this response reaches a browser.
    console.error("[fetch-lms-funnel] LMS returned", response.status);
    return json({ error: `The LMS returned ${response.status}.` }, 502);
  }

  return json(await response.json());
});
