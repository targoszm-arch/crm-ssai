import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// 1x1 transparent GIF
const TRANSPARENT_GIF = Uint8Array.from(atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"), c => c.charCodeAt(0));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const sequenceEmailId = url.searchParams.get("seid");
    
    // Also support legacy 'eid' parameter
    const emailId = sequenceEmailId || url.searchParams.get("eid");

    if (!emailId) {
      console.log("No email ID provided");
      return new Response(TRANSPARENT_GIF, {
        headers: { ...corsHeaders, "Content-Type": "image/gif", "Cache-Control": "no-cache, no-store" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Tracking open for sequence email: ${emailId}`);

    // Get sequence email with enrollment info
    const { data: sequenceEmail, error: fetchError } = await supabase
      .from("sequence_emails")
      .select(`
        id,
        enrollment_id,
        unique_opens,
        total_opens,
        opened_at,
        sequence_enrollments (
          contact_id
        )
      `)
      .eq("id", emailId)
      .single();

    if (fetchError || !sequenceEmail) {
      console.log("Sequence email not found:", fetchError);
      return new Response(TRANSPARENT_GIF, {
        headers: { ...corsHeaders, "Content-Type": "image/gif", "Cache-Control": "no-cache, no-store" },
      });
    }

    const now = new Date().toISOString();
    const isFirstOpen = !sequenceEmail.opened_at;
    const contactId = (sequenceEmail.sequence_enrollments as any)?.contact_id;

    // Update sequence_emails
    await supabase
      .from("sequence_emails")
      .update({
        opened_at: sequenceEmail.opened_at || now,
        unique_opens: isFirstOpen ? (sequenceEmail.unique_opens || 0) + 1 : sequenceEmail.unique_opens,
        total_opens: (sequenceEmail.total_opens || 0) + 1,
      })
      .eq("id", emailId);

    // Record tracking event
    const userAgent = req.headers.get("user-agent") || null;
    const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0] || null;

    await supabase.from("email_tracking_events").insert({
      email_id: emailId,
      contact_id: contactId,
      event_type: "open",
      occurred_at: now,
      user_agent: userAgent,
      ip_address: clientIP,
    });

    // Update contact total_opens
    if (contactId) {
      await supabase.rpc("increment_contact_opens", { contact_id_param: contactId }).catch(() => {
        // Fallback if RPC doesn't exist
        supabase
          .from("contacts")
          .update({ total_opens: supabase.raw("COALESCE(total_opens, 0) + 1") })
          .eq("id", contactId);
      });
    }

    console.log(`✓ Recorded open for sequence email ${emailId}`);

    return new Response(TRANSPARENT_GIF, {
      headers: { ...corsHeaders, "Content-Type": "image/gif", "Cache-Control": "no-cache, no-store" },
    });
  } catch (error) {
    console.error("Track sequence open error:", error);
    return new Response(TRANSPARENT_GIF, {
      headers: { ...corsHeaders, "Content-Type": "image/gif", "Cache-Control": "no-cache, no-store" },
    });
  }
});
