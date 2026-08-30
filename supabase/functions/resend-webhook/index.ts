import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as hexEncode } from "https://deno.land/std@0.208.0/encoding/hex.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function verifyResendSignature(req: Request, body: string): Promise<boolean> {
  const webhookSecret = Deno.env.get("RESEND_WEBHOOK_SECRET");
  if (!webhookSecret) {
    console.error("RESEND_WEBHOOK_SECRET not configured");
    return false;
  }

  const signatureHeader = req.headers.get("svix-signature");
  const timestampHeader = req.headers.get("svix-timestamp");
  const msgIdHeader = req.headers.get("svix-id");

  if (!signatureHeader || !timestampHeader || !msgIdHeader) {
    console.error("Missing webhook signature headers");
    return false;
  }

  // Check timestamp is within 5 minutes to prevent replay attacks
  const timestamp = parseInt(timestampHeader, 10);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > 300) {
    console.error("Webhook timestamp too old or in the future");
    return false;
  }

  // Construct the signed content
  const signedContent = `${msgIdHeader}.${timestampHeader}.${body}`;

  // Decode the secret (base64 with whsec_ prefix)
  const secretBytes = Uint8Array.from(
    atob(webhookSecret.startsWith("whsec_") ? webhookSecret.slice(6) : webhookSecret),
    (c) => c.charCodeAt(0)
  );

  // Compute HMAC-SHA256
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signatureBytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedContent));
  const computedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)));

  // Compare against all provided signatures (comma-separated, each prefixed with v1,)
  const signatures = signatureHeader.split(" ");
  for (const sig of signatures) {
    const [version, value] = sig.split(",");
    if (version === "v1" && value === computedSignature) {
      return true;
    }
  }

  console.error("Webhook signature verification failed");
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Read body as text for signature verification
    const bodyText = await req.text();

    // Verify webhook signature
    const isValid = await verifyResendSignature(req, bodyText);
    if (!isValid) {
      return new Response(JSON.stringify({ error: "Invalid webhook signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload = JSON.parse(bodyText);
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
      .select(`
        id,
        enrollment_id,
        sequence_enrollments (
          contact_id,
          user_id
        )
      `)
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
      case "email.clicked": {
        const clickedAt = new Date().toISOString();
        updates.clicked_at = clickedAt;
        updates.status = "clicked";

        // Resend tells us WHICH link was clicked, in data.click.link. This used to be
        // dropped, which made segmentation impossible for anything Resend sent — and under
        // the two-machine rule Resend sends the lifecycle mail, so this is the path the
        // indoctrination email's four cards actually take.
        const enrollment = (sequenceEmail as any).sequence_enrollments;
        const contactId = enrollment?.contact_id ?? null;
        const linkUrl: string | null = data?.click?.link ?? null;

        if (contactId && linkUrl) {
          // email_tracking_events is where clicks are read from for reporting. Write it
          // here too so a Resend-sent click and a CRM-sent click look the same downstream.
          const { error: eventError } = await supabase.from("email_tracking_events").insert({
            email_id: sequenceEmail.id,
            contact_id: contactId,
            event_type: "click",
            link_url: linkUrl,
            occurred_at: clickedAt,
            user_agent: data?.click?.user_agent ?? null,
            ip_address: data?.click?.ip_address ?? null,
          });
          if (eventError) {
            console.error("Error recording click event:", eventError);
          }

          // Same Postgres function track-sequence-click calls, so both click paths segment
          // identically rather than each growing its own copy of the rules.
          const { data: routed, error: routeError } = await supabase.rpc("route_sequence_click", {
            p_contact_id: contactId,
            p_link_url: linkUrl,
            p_user_id: enrollment?.user_id ?? null,
          });
          if (routeError) {
            console.error("route_sequence_click failed:", routeError);
          } else {
            console.log("Click routing:", routed);
          }
        } else if (!linkUrl) {
          console.log("email.clicked with no data.click.link — nothing to segment on");
        }
        break;
      }
      case "email.bounced":
        updates.bounced_at = new Date().toISOString();
        updates.status = "bounced";
        await supabase
          .from("sequence_enrollments")
          .update({ status: "bounced" })
          .eq("id", sequenceEmail.enrollment_id);
        break;
      case "email.complained":
        updates.status = "complained";
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
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
