// Pull per-recipient newsletter engagement from Resend into newsletter_recipients.
//
// WHY THIS EXISTS. newsletter_sends was built believing a newsletter reports only a
// recipient count and a status, so the Newsletters tab showed no open or click rate and
// said the data did not exist. It does. Content Lab does not send a newsletter as one
// Resend broadcast — it sends one Resend email PER RECIPIENT — and Resend keeps
// delivered/opened/clicked/bounced on each of them. The 3 Aug send has 48 unique opens and
// 20 unique clicks that the CRM was simply never asking for.
//
// HOW A NEWSLETTER'S EMAILS ARE IDENTIFIED. Resend's /emails list carries no campaign id
// for these, so an email belongs to a send when its subject equals the send's subject_line
// AND it was created inside a window around sent_at. Both conditions are needed: the same
// subject was re-sent to a different audience more than once (see 14 Apr, sent to two
// audiences), so subject alone would merge two sends into one.
//
// A date range alone is NOT a substitute. The account carries transactional mail —
// signup confirmations, "your video is ready" — on the same days, and opens accrue for
// days after a send, so any date-window total would be both contaminated and truncated.
//
// THE TWO-MACHINE RULE IS NOT AT STAKE. This only ever READS from Resend. It sends
// nothing, and it does not touch Content Lab: Content Lab is a public product and stays
// unwired, exactly as before.
//
//   GET ?apply=false  (default) -> reports what it WOULD write, writes nothing
//   GET ?apply=true             -> performs the writes
//   GET ?id=<uuid>              -> restrict to one newsletter send

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Resend paginates /emails newest-first with an opaque cursor. 100 is its maximum.
const PAGE_SIZE = 100;
const MAX_PAGES = 60;

// How far after sent_at an email may be created and still belong to the send. A 114-person
// send completes in a few seconds, but a scheduled send can start slightly before the
// recorded sent_at, so the window opens a little early too.
const WINDOW_BEFORE_MS = 10 * 60 * 1000;
const WINDOW_AFTER_MS = 60 * 60 * 1000;

interface ResendEmail {
  id: string;
  to: string[] | string | null;
  subject: string | null;
  created_at: string | null;
  last_event: string | null;
}

interface NewsletterSend {
  id: string;
  user_id: string | null;
  subject_line: string | null;
  sent_at: string | null;
  scheduled_at: string | null;
}

// "Steve Bennett <steve@example.com>" -> { name: "Steve Bennett", email: "steve@example.com" }
function parseRecipient(raw: string): { name: string | null; email: string } {
  const match = raw.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (match) {
    return { name: match[1] || null, email: match[2].trim().toLowerCase() };
  }
  return { name: null, email: raw.trim().toLowerCase() };
}

function normaliseSubject(subject: string | null | undefined): string {
  return (subject ?? "").trim().toLowerCase();
}

// The owner every row is stamped with. Writing with the service role bypasses RLS on the
// write but NOT on the read, so a row without user_id is written successfully and is then
// invisible to the app — the failure mode that hid 96% of activities until 20260831004500.
async function resolveOwnerId(
  supabase: ReturnType<typeof createClient>,
): Promise<string> {
  const configured = Deno.env.get("CRM_OWNER_USER_ID");
  if (configured) return configured;

  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) throw new Error(`Cannot resolve owner: ${error.message}`);
  const users = data?.users ?? [];
  if (users.length !== 1) {
    throw new Error(
      `Cannot resolve owner: found ${users.length} auth users. Set CRM_OWNER_USER_ID.`,
    );
  }
  return users[0].id;
}

async function fetchResendPage(
  apiKey: string,
  after: string | null,
): Promise<{ emails: ResendEmail[]; hasMore: boolean }> {
  const url = new URL("https://api.resend.com/emails");
  url.searchParams.set("limit", String(PAGE_SIZE));
  if (after) url.searchParams.set("after", after);

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend /emails failed (${response.status}): ${body}`);
  }

  const payload = await response.json();
  return {
    emails: (payload?.data ?? []) as ResendEmail[],
    // Resend reports has_more; when absent, a full page is the signal there may be more.
    hasMore: payload?.has_more ?? (payload?.data ?? []).length === PAGE_SIZE,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const apply = url.searchParams.get("apply") === "true";
    const onlyId = url.searchParams.get("id");

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const ownerId = await resolveOwnerId(supabase);

    // Only sends that actually went out have recipients to find. A cancelled send has none,
    // and matching it on subject alone would steal another send's emails.
    let query = supabase
      .from("newsletter_sends")
      .select("id, user_id, subject_line, sent_at, scheduled_at")
      .not("sent_at", "is", null);
    if (onlyId) query = query.eq("id", onlyId);

    const { data: sends, error: sendsError } = await query;
    if (sendsError) throw new Error(`Reading newsletter_sends: ${sendsError.message}`);

    const candidates = (sends ?? []).filter(
      (s: NewsletterSend) => normaliseSubject(s.subject_line) !== "",
    ) as NewsletterSend[];

    if (candidates.length === 0) {
      return new Response(
        JSON.stringify({ apply, matched: 0, message: "No sent newsletters to sync" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Index the sends by normalised subject so each Resend email is tested once, rather
    // than re-scanning every send for every email.
    const bySubject = new Map<string, NewsletterSend[]>();
    for (const send of candidates) {
      const key = normaliseSubject(send.subject_line);
      const list = bySubject.get(key) ?? [];
      list.push(send);
      bySubject.set(key, list);
    }

    // Stop paging once we are safely older than the oldest send we care about.
    const oldestSentAt = Math.min(
      ...candidates.map((s) => new Date(s.sent_at!).getTime()),
    );
    const stopBefore = oldestSentAt - WINDOW_BEFORE_MS;

    const rows: Record<string, unknown>[] = [];
    const perSend = new Map<string, number>();
    let cursor: string | null = null;
    let pages = 0;
    let scanned = 0;
    let reachedEnd = false;

    while (pages < MAX_PAGES) {
      const { emails, hasMore } = await fetchResendPage(resendKey, cursor);
      pages += 1;
      if (emails.length === 0) {
        reachedEnd = true;
        break;
      }
      scanned += emails.length;

      for (const email of emails) {
        const matches = bySubject.get(normaliseSubject(email.subject));
        if (!matches || !email.created_at) continue;

        const createdMs = new Date(email.created_at).getTime();
        const send = matches.find((s) => {
          const sentMs = new Date(s.sent_at!).getTime();
          return (
            createdMs >= sentMs - WINDOW_BEFORE_MS &&
            createdMs <= sentMs + WINDOW_AFTER_MS
          );
        });
        if (!send) continue;

        const recipients = Array.isArray(email.to)
          ? email.to
          : email.to
            ? [email.to]
            : [];
        for (const raw of recipients) {
          const { name, email: address } = parseRecipient(String(raw));
          if (!address) continue;
          rows.push({
            newsletter_send_id: send.id,
            user_id: send.user_id ?? ownerId,
            resend_email_id: email.id,
            email: address,
            recipient_name: name,
            status: email.last_event ?? null,
            sent_at: email.created_at,
          });
          perSend.set(send.id, (perSend.get(send.id) ?? 0) + 1);
        }
      }

      const oldestOnPage = emails
        .map((e) => (e.created_at ? new Date(e.created_at).getTime() : Infinity))
        .reduce((a, b) => Math.min(a, b), Infinity);
      if (oldestOnPage < stopBefore) {
        reachedEnd = true;
        break;
      }
      if (!hasMore) {
        reachedEnd = true;
        break;
      }
      cursor = emails[emails.length - 1].id;
    }

    const summary = {
      apply,
      pages,
      scanned,
      reachedEnd,
      sends_considered: candidates.length,
      sends_matched: perSend.size,
      recipients_found: rows.length,
      per_send: Object.fromEntries(perSend),
    };

    if (!apply) {
      return new Response(JSON.stringify({ ...summary, note: "Dry run — nothing written. Re-run with ?apply=true." }, null, 2), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Chunked so one oversized request cannot fail the whole sync.
    let written = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = await supabase
        .from("newsletter_recipients")
        .upsert(chunk, { onConflict: "user_id,resend_email_id" });
      if (error) throw new Error(`Upserting recipients: ${error.message}`);
      written += chunk.length;
    }

    // Link recipients to the CRM contacts they already are. This is what makes a
    // newsletter open a contact-level signal rather than a number on a card.
    const { error: linkError } = await supabase.rpc("link_newsletter_recipients_to_contacts");
    if (linkError) console.error("Linking contacts failed:", linkError.message);

    for (const sendId of perSend.keys()) {
      const { error } = await supabase.rpc("refresh_newsletter_metrics", {
        p_newsletter_send_id: sendId,
      });
      if (error) console.error(`Refreshing metrics for ${sendId}:`, error.message);
    }

    return new Response(
      JSON.stringify({ ...summary, written }, null, 2),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("sync-newsletter-metrics failed:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
