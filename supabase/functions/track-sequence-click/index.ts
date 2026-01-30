import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const sequenceEmailId = url.searchParams.get("seid");
    const redirectUrl = url.searchParams.get("url");

    // Also support legacy 'eid' parameter
    const emailId = sequenceEmailId || url.searchParams.get("eid");

    if (!emailId || !redirectUrl) {
      console.log("Missing parameters:", { emailId, redirectUrl });
      // Redirect anyway if URL provided
      if (redirectUrl) {
        return Response.redirect(decodeURIComponent(redirectUrl), 302);
      }
      return new Response("Missing parameters", { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const decodedUrl = decodeURIComponent(redirectUrl);
    console.log(`Tracking click for sequence email: ${emailId}, URL: ${decodedUrl}`);

    // Get sequence email with enrollment info
    const { data: sequenceEmail, error: fetchError } = await supabase
      .from("sequence_emails")
      .select(`
        id,
        enrollment_id,
        unique_clicks,
        total_clicks,
        clicked_at,
        sequence_enrollments (
          contact_id
        )
      `)
      .eq("id", emailId)
      .single();

    if (fetchError || !sequenceEmail) {
      console.log("Sequence email not found:", fetchError);
      return Response.redirect(decodedUrl, 302);
    }

    const now = new Date().toISOString();
    const isFirstClick = !sequenceEmail.clicked_at;
    const contactId = (sequenceEmail.sequence_enrollments as any)?.contact_id;

    // Update sequence_emails
    await supabase
      .from("sequence_emails")
      .update({
        clicked_at: sequenceEmail.clicked_at || now,
        unique_clicks: isFirstClick ? (sequenceEmail.unique_clicks || 0) + 1 : sequenceEmail.unique_clicks,
        total_clicks: (sequenceEmail.total_clicks || 0) + 1,
      })
      .eq("id", emailId);

    // Record tracking event with link URL
    const userAgent = req.headers.get("user-agent") || null;
    const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0] || null;

    await supabase.from("email_tracking_events").insert({
      email_id: emailId,
      contact_id: contactId,
      event_type: "click",
      link_url: decodedUrl,
      occurred_at: now,
      user_agent: userAgent,
      ip_address: clientIP,
    });

    // Update contact total_clicks
    if (contactId) {
      await supabase.rpc("increment_contact_clicks", { contact_id_param: contactId }).catch(() => {
        // Fallback if RPC doesn't exist
        supabase
          .from("contacts")
          .update({ total_clicks: supabase.raw("COALESCE(total_clicks, 0) + 1") })
          .eq("id", contactId);
      });
    }

    console.log(`✓ Recorded click for sequence email ${emailId}`);

    return Response.redirect(decodedUrl, 302);
  } catch (error) {
    console.error("Track sequence click error:", error);
    const url = new URL(req.url);
    const redirectUrl = url.searchParams.get("url");
    if (redirectUrl) {
      return Response.redirect(decodeURIComponent(redirectUrl), 302);
    }
    return new Response("Error", { status: 500, headers: corsHeaders });
  }
});
