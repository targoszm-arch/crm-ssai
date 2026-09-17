import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as hexEncode } from "https://deno.land/std@0.208.0/encoding/hex.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * The addresses this CRM sends from, comma-separated.
 *
 * This Resend account is shared with Content Lab, which sends its Supabase Auth
 * mail ("Your Magic Link", "Confirm Your Signup") from team@skillstudio.ai —
 * the SAME DOMAIN this CRM sends campaigns from (magda@skillstudio.ai). So a
 * domain check does not separate them and never could; only the full address
 * does.
 *
 * Without this gate the recipient fallback below recorded every Content Lab
 * auth click as CRM email activity, stored the single-use sign-in token from
 * the URL, and attributed two of them to a campaign send. That is another
 * product's credentials in this database, and it is the CRM reading Content
 * Lab's traffic — the coupling CLAUDE.md forbids.
 *
 * Fails CLOSED: unset means the fallback records nothing. Losing an open is a
 * worse outcome than it sounds, but storing someone else's login tokens is far
 * worse, and a silent capture is exactly what went unnoticed for a day.
 */
const CRM_SENDER_ADDRESSES = new Set(
  (Deno.env.get("CRM_SENDER_ADDRESSES") ?? "")
    .split(",")
    .map((a: string) => a.trim().toLowerCase())
    .filter(Boolean),
);

/** `"Magda Targosz <magda@skillstudio.ai>"` → `magda@skillstudio.ai`. */
function senderAddress(from: unknown): string {
  const raw = String(from ?? "");
  const angled = raw.match(/<([^>]+)>/);
  return (angled ? angled[1] : raw).trim().toLowerCase();
}

/**
 * Remove credential-bearing query parameters before a URL is stored anywhere.
 *
 * Belt and braces alongside the sender gate: the gate decides whose mail we
 * record, this decides that no click URL we record can carry a secret even if
 * one of our own emails ever links to a tokenised URL. Redacting rather than
 * dropping keeps the link's identity intact, so segmentation by destination
 * still works.
 */
const CREDENTIAL_PARAMS =
  /^(token|token_hash|access_token|refresh_token|id_token|code|secret|api[-_]?key|password|signature|sig)$/i;

function redactLinkUrl(url: string | null): string | null {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    let redacted = false;
    for (const key of [...parsed.searchParams.keys()]) {
      if (CREDENTIAL_PARAMS.test(key)) {
        parsed.searchParams.set(key, "REDACTED");
        redacted = true;
      }
    }
    return redacted ? parsed.toString() : url;
  } catch {
    // Not a parseable URL. Returning it unchanged is safe: the gate above has
    // already established this is our own mail.
    return url;
  }
}

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
        opened_at,
        clicked_at,
        total_opens,
        unique_opens,
        total_clicks,
        unique_clicks,
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
      //
      // ...but ONLY for mail this CRM sent. The fallback keys on the recipient,
      // and a recipient is not ours exclusively: this Resend account also
      // carries Content Lab's auth mail, and any address that exists in
      // `contacts` matched it. Check the sender before going any further —
      // before the contact lookup, so a foreign event costs one comparison and
      // touches no table.
      const fromAddress = senderAddress(data?.from);
      if (!CRM_SENDER_ADDRESSES.has(fromAddress)) {
        if (CRM_SENDER_ADDRESSES.size === 0) {
          console.error(
            "CRM_SENDER_ADDRESSES is not configured, so no event can be attributed by " +
            "recipient. Set it to the addresses this CRM sends from.",
          );
        } else {
          console.log(`Not a CRM sender (${fromAddress || "unknown"}), ignoring event`);
        }
        return new Response(
          JSON.stringify({ success: true, message: "Not a CRM sender", from: fromAddress }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

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

      // Attribute the event to a send where one exists. Matching on
      // resend_message_id failed above, but the analytics page joins tracking events
      // to sequence_emails on email_id, so an event with a null email_id shows up in
      // no chart. The most recent send to this contact is the best available guess and
      // is nearly always right: a person is not in two campaigns the same minute.
      // Still a guess, so it never overrides the message-id match — it only fills a
      // column that would otherwise be null.
      const { data: recentSend } = await supabase
        .from("sequence_emails")
        .select("id, sequence_enrollments!inner(contact_id)")
        .eq("sequence_enrollments.contact_id", contact.id)
        .not("sent_at", "is", null)
        .order("sent_at", { ascending: false })
        .limit(1);
      const attributedSequenceEmailId: string | null = recentSend?.[0]?.id ?? null;

      const linkUrl: string | null = redactLinkUrl(data?.click?.link ?? null);
      const { error: eventError } = await supabase.from("email_tracking_events").insert({
        sequence_email_id: attributedSequenceEmailId,
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
      case "email.opened": {
        const openedAt = new Date().toISOString();
        updates.status = "opened";
        // opened_at is the FIRST open — overwriting it on every re-open would turn
        // "when did they read it" into "when did they last read it".
        if (!(sequenceEmail as any).opened_at) updates.opened_at = openedAt;

        // Read-modify-write. Two opens landing in the same instant can lose a count;
        // that is acceptable for a counter nobody bills on, and the tracking rows
        // below are the authoritative record either way.
        updates.total_opens = ((sequenceEmail as any).total_opens ?? 0) + 1;
        updates.unique_opens = (sequenceEmail as any).opened_at
          ? ((sequenceEmail as any).unique_opens ?? 1)
          : 1;

        // The charts read email_tracking_events, not these columns. Without this row
        // an open recorded here appeared in the totals but in none of the timelines.
        const openEnrollment = (sequenceEmail as any).sequence_enrollments;
        if (openEnrollment?.contact_id) {
          const { error: openEventError } = await supabase
            .from("email_tracking_events").insert({
              sequence_email_id: sequenceEmail.id,
              contact_id: openEnrollment.contact_id,
              event_type: "open",
              occurred_at: openedAt,
              user_agent: data?.user_agent ?? `resend-webhook/${type}`,
              ip_address: data?.ip_address ?? null,
              user_id: openEnrollment.user_id ?? null,
            });
          if (openEventError) console.error("Error recording open event:", openEventError);
        }
        break;
      }
      case "email.clicked": {
        const clickedAt = new Date().toISOString();
        updates.status = "clicked";
        if (!(sequenceEmail as any).clicked_at) updates.clicked_at = clickedAt;
        updates.total_clicks = ((sequenceEmail as any).total_clicks ?? 0) + 1;
        updates.unique_clicks = (sequenceEmail as any).clicked_at
          ? ((sequenceEmail as any).unique_clicks ?? 1)
          : 1;

        // Resend tells us WHICH link was clicked, in data.click.link. This used to be
        // dropped, which made segmentation impossible for anything Resend sent — and under
        // the two-machine rule Resend sends the lifecycle mail, so this is the path the
        // indoctrination email's four cards actually take.
        const enrollment = (sequenceEmail as any).sequence_enrollments;
        const contactId = enrollment?.contact_id ?? null;
        const linkUrl: string | null = redactLinkUrl(data?.click?.link ?? null);

        if (contactId && linkUrl) {
          // email_tracking_events is where clicks are read from for reporting. Write it
          // here too so a Resend-sent click and a CRM-sent click look the same downstream.
          const { error: eventError } = await supabase.from("email_tracking_events").insert({
            // sequence_email_id, not email_id: email_id references `emails` (the
            // mailbox table) and this is a sequence send. Writing it to email_id
            // violated the foreign key and the insert was silently discarded.
            sequence_email_id: sequenceEmail.id,
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
