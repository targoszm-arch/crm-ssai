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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload = await req.json();
    console.log("Resend webhook received:", JSON.stringify(payload, null, 2));

    const { type, data } = payload;

    if (!data?.email_id) {
      console.log("No email_id in webhook payload");
      return new Response(JSON.stringify({ success: true, message: "No email_id to process" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the sequence_email by resend_message_id
    const { data: sequenceEmail, error: findError } = await supabase
      .from("sequence_emails")
      .select("id, enrollment_id")
      .eq("resend_message_id", data.email_id)
      .single();

    if (findError || !sequenceEmail) {
      console.log("Sequence email not found for:", data.email_id);
      return new Response(JSON.stringify({ success: true, message: "Email not from sequence" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update based on event type
    const updates: Record<string, any> = {};

    switch (type) {
      case "email.sent":
        updates.status = "sent";
        updates.sent_at = new Date().toISOString();
        break;
      case "email.delivered":
        updates.status = "delivered";
        break;
      case "email.opened":
        updates.opened_at = new Date().toISOString();
        updates.status = "opened";
        break;
      case "email.clicked":
        updates.clicked_at = new Date().toISOString();
        updates.status = "clicked";
        break;
      case "email.bounced":
        updates.bounced_at = new Date().toISOString();
        updates.status = "bounced";
        // Also update enrollment status
        await supabase
          .from("sequence_enrollments")
          .update({ status: "bounced" })
          .eq("id", sequenceEmail.enrollment_id);
        break;
      case "email.complained":
        updates.status = "complained";
        // Unsubscribe the contact
        await supabase
          .from("sequence_enrollments")
          .update({ status: "unsubscribed" })
          .eq("id", sequenceEmail.enrollment_id);
        break;
      default:
        console.log("Unhandled event type:", type);
    }

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from("sequence_emails")
        .update(updates)
        .eq("id", sequenceEmail.id);

      if (updateError) {
        console.error("Error updating sequence_email:", updateError);
        throw updateError;
      }

      console.log(`Updated sequence_email ${sequenceEmail.id} with:`, updates);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Resend webhook error:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
