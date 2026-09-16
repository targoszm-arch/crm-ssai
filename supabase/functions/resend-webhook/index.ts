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
      // Not a sequence email. Until now this returned here and the event was lost, which
      // is why email_tracking_events sat at zero rows while Resend had been delivering
      // events to this endpoint since January.
      //
      // Content Lab solved the same problem by keying on the RECIPIENT rather than a
      // message id (its newsletter_events table has ~925 opens and counting). Keying on
      // resend_message_id alone cannot work for a send composed outside the sequence
      // engine: the id does not exist until Resend returns it, so email.sent and
      // email.delivered routinely arrive before any row exists to match.
      //
      // So fall back to the address. Anything we can tie to a contact gets recorded.
      const recipient = Array.isArray(data?.to) ? String(data.to[0] ?? "").toLowerCase() : "";
      if (!recipient) {
        return new Response(JSON.stringify({ success: true, message: "No recipient to match" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Tags are how a send declares what it belongs to; send-email and any hand-rolled
      // send should set campaign and user_id. Mirrors Content Lab's schedule_id/user_id.
      const tagMap: Record<string, string> = {};
      for (const t of (Array.isArray(data?.tags) ? data.tags : [])) {
        if (t?.name && t?.value) tagMap[String(t.name)] = String(t.value);
      }

      // Escape LIKE wildcards — an address is user-supplied and ilike treats % and _ as
      // patterns, which would otherwise match the wrong contact.
      const pattern = recipient.replace(/([\\%_])/g, "\\$1");
      const { data: matched, error: contactErr } = await supabase
        .from("contacts")
        .select("id, user_id")
        .ilike("email", pattern)
        .order("created_at", { ascending: true })
        .limit(1);

      if (contactErr) {
        console.error("Contact lookup failed:", contactErr);
        // 503 so Resend retries rather than silently dropping the event.
        return new Response(JSON.stringify({ success: false, error: "Contact lookup failed" }), {
          status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const contact = matched?.[0] ?? null;
      if (!contact) {
        console.log("No contact for recipient, nothing to attribute:", recipient);
        return new Response(JSON.stringify({ success: true, message: "No matching contact" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Same vocabulary Content Lab uses, so the two projects report alike.
      const EVENT_TYPES: Record<string, string> = {
        "email.opened": "open",
        "email.clicked": "click",
        "email.bounced": "bounce",
        "email.complained": "complaint",
        "email.unsubscribed": "unsubscribe",
        // sent/delivered deliberately absent: one row per recipient per send for a
        // signal nobody reads. Absence of a bounce is the delivery signal.
      };
      const eventType = EVENT_TYPES[type] ?? null;

      if (!eventType) {
        return new Response(JSON.stringify({ success: true, message: `Unhandled type ${type}` }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const linkUrl: string | null = data?.click?.link ?? null;
      const { error: eventError } = await supabase.from("email_tracking_events").insert({
        contact_id: contact.id,
        event_type: eventType,
        link_url: linkUrl,
        occurred_at: payload?.created_at ?? new Date().toISOString(),
        user_agent: data?.click?.user_agent ?? `resend-webhook/${type}`,
        ip_address: data?.click?.ip_address ?? null,
        user_id: tagMap["user_id"] ?? contact.user_id ?? null,
      });
      if (eventError) {
        console.error("Error recording tracking event:", eventError);
      }

      // A click still routes, exactly as it does on the sequence path — one set of rules.
      if (eventType === "click" && linkUrl) {
        const { error: routeError } = await supabase.rpc("route_sequence_click", {
          p_contact_id: contact.id,
          p_link_url: linkUrl,
          p_user_id: tagMap["user_id"] ?? contact.user_id ?? null,
        });
        if (routeError) console.error("route_sequence_click failed:", routeError);
      }

      // Honour an opt-out on the contact so a later send cannot reach them again.
      if (eventType === "unsubscribe" || eventType === "complaint") {
        const { error: dncError } = await supabase
          .from("contacts")
          .update({ do_not_contact: true })
          .eq("id", contact.id);
        if (dncError) console.error("Failed to set do_not_contact:", dncError);
      }

      return new Response(
        JSON.stringify({ success: true, matched_by: "recipient", event_type: eventType }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
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
