/**
 * sync-gmail-receipts — harvests receipt and invoice PDFs from Gmail.
 *
 * This is the Apps Script Magda runs by hand, moved behind a button: the same
 * four searches over the same window, saving the same attachments and writing
 * the same log columns. What it does differently is where the output lands —
 * rows in finance_transactions rather than a spreadsheet, so a receipt can be
 * reconciled against the bank line that paid it.
 *
 * AUTH. It uses the mailbox already connected to the CRM (`email_accounts`,
 * the gmail.readonly grant the Inbox uses), refreshing the token the same way
 * sync-emails does. No new secrets. GMAIL_REFRESH_TOKEN / GMAIL_CLIENT_ID /
 * GMAIL_CLIENT_SECRET remain as a fallback for the other mailboxes that
 * receive receipts and are not connected here.
 *
 * RESUMING. Gmail is paged and Edge Functions are not infinite, so a run stops
 * on a time budget and reports `done: false`. Messages already stored are
 * skipped without being fetched, so calling it again continues rather than
 * repeats — the same property the Apps Script gets from its `seenIds`.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// The Apps Script's four searches, verbatim. Overlap between them is fine:
// a message already stored is skipped before it is fetched.
const DEFAULT_QUERIES = [
  'has:attachment filename:pdf (invoice OR receipt OR "tax invoice" OR billing OR statement)',
  "has:attachment filename:pdf from:(stripe.com)",
  "has:attachment filename:pdf from:(invoice OR billing OR receipts OR noreply)",
  "has:attachment filename:pdf (subscription OR payment OR charged)",
];

// VAT registration start — the same floor the Apps Script uses.
const DEFAULT_AFTER = "2025/04/01";

// Leave room to finish the batch and write the response.
const TIME_BUDGET_MS = 110_000;

// ── Amount regex patterns ─────────────────────────────────────────────────────
const AMOUNT_PATTERNS = [
  /€\s*([\d,]+\.?\d{0,2})/g,
  /EUR\s*([\d,]+\.?\d{0,2})/gi,
  /([\d,]+\.?\d{0,2})\s*EUR/gi,
];

// ── Is this email a receipt at all? ──────────────────────────────────────────
//
// The searches above are deliberately wide ("statement", "payment", any PDF
// from noreply), so they catch a great deal that is not a purchase: bank T&C
// updates, newsletters, a sales ROI calculator, a cold pitch. Taking the first
// euro figure out of those and booking it as an expense put EUR 675,000 of
// fiction into the ledger by Sep 2026 — an ROI report's "save EUR 85,938",
// Revolut's savings terms as EUR 100,000, a Seedcorn congratulations as
// EUR 50,000. The email is still stored, with its PDF; only its amount is
// withheld until the subject says it is a receipt.
//
// Tested against the 780 rows harvested before this existed: it rejects all
// of the mis-parses above and keeps every receipt that was matched to a bank
// payment. What it misses (a "you're all set" from Slack, an event
// registration) lands at EUR 0 with a hint — and the bank line carries that
// money regardless. A missed receipt costs a manual entry; a false one costs
// the P&L.
const RECEIPT_SUBJECT =
  /\b(receipt|invoice|payment|paid|order|billing|bill|charge|charged|subscription|renewal|refund|credit note|purchase|e-?ticket|ticket|faktura|rachunek|rechnung|factura|facture)\b/i;
const NOT_A_RECEIPT =
  /(terms|t&cs|update to your|updating our|congratulations|report|webinar|invest|newsletter|policy|proposal|avatar is ready)/i;

function looksLikeReceipt(subject: string, from: string, mailbox: string | null): boolean {
  // Her own outgoing mail — an invoice she sent, a forward — is not a
  // purchase she made. A forwarded receipt duplicates the original anyway.
  const sender = (from.match(/<([^>]+)>/)?.[1] ?? from).trim().toLowerCase();
  if (mailbox && sender === mailbox.toLowerCase()) return false;
  return RECEIPT_SUBJECT.test(subject) && !NOT_A_RECEIPT.test(subject);
}

// A receipt states its total next to a label. Prefer that to the first euro
// figure in the text, which is as often a line item, a "was" price or an
// upsell.
const TOTAL_PATTERN =
  /\b(?:grand total|total paid|amount paid|total due|amount due|total charged|total)\s*:?\s*(?:€|EUR)\s*([\d,]+\.?\d{0,2})/i;

function extractAmount(text: string): number | null {
  const total = TOTAL_PATTERN.exec(text);
  if (total) {
    const val = parseFloat(total[1].replace(/,/g, ""));
    if (!isNaN(val) && val > 0 && val < 1_000_000) return val;
  }
  for (const pattern of AMOUNT_PATTERNS) {
    pattern.lastIndex = 0;
    const match = pattern.exec(text);
    if (match) {
      const raw = match[1].replace(/,/g, "");
      const val = parseFloat(raw);
      if (!isNaN(val) && val > 0 && val < 1_000_000) return val;
    }
  }
  return null;
}
// ── Get a fresh Gmail access token ───────────────────────────────────────────
//
// The mailbox connected to the CRM comes first: it already holds a
// gmail.readonly grant and a refresh token, so the harvest works on a click
// with nothing to configure. The GMAIL_* secrets stay as a way to reach a
// mailbox that is not connected here.
// deno-lint-ignore no-explicit-any
async function getGmailAccessToken(sb: any, userId: string): Promise<string> {
  const { data: account } = await sb
    .from("email_accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "google")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const clientId = Deno.env.get("GOOGLE_CLIENT_ID") ?? Deno.env.get("GMAIL_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? Deno.env.get("GMAIL_CLIENT_SECRET");

  if (account?.refresh_token && clientId && clientSecret) {
    // Still valid? Use it. Gmail tokens last an hour and a harvest is long.
    if (account.access_token && account.expires_at && new Date(account.expires_at) > new Date(Date.now() + 60_000)) {
      return account.access_token;
    }
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: account.refresh_token,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });
    if (!res.ok) throw new Error(`Gmail token refresh failed: ${await res.text()}`);
    const json = await res.json();
    await sb.from("email_accounts").update({
      access_token: json.access_token,
      expires_at: new Date(Date.now() + (json.expires_in ?? 3600) * 1000).toISOString(),
    }).eq("id", account.id);
    return json.access_token as string;
  }

  // Fallback: a standalone grant for a mailbox not connected to the CRM.
  const refreshToken = Deno.env.get("GMAIL_REFRESH_TOKEN");
  const staticToken = Deno.env.get("GMAIL_ACCESS_TOKEN");
  if (refreshToken && clientId && clientSecret) {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });
    if (!res.ok) throw new Error(`Gmail token refresh failed: ${await res.text()}`);
    return (await res.json()).access_token as string;
  }
  if (staticToken) return staticToken;

  throw new Error(
    "No Gmail connection. Connect a mailbox in the Inbox, or set GMAIL_REFRESH_TOKEN + GMAIL_CLIENT_ID + GMAIL_CLIENT_SECRET."
  );
}

// ── Decode base64url → string ─────────────────────────────────────────────────
function decodeBase64Url(s: string): string {
  try {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64);
    // Try to decode as UTF-8
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  } catch {
    return "";
  }
}

// ── Find first PDF attachment part in Gmail message payload ─────────────────
function findPdfAttachment(payload: Record<string, unknown>): { attachmentId: string; filename: string; size: number } | null {
  const mimeType = payload.mimeType as string | undefined;
  const body = payload.body as Record<string, unknown> | undefined;
  const parts = payload.parts as Array<Record<string, unknown>> | undefined;
  const filename = payload.filename as string | undefined;

  if (mimeType === "application/pdf" && body?.attachmentId) {
    return {
      attachmentId: body.attachmentId as string,
      filename: filename ?? "receipt.pdf",
      size: (body.size as number) ?? 0,
    };
  }
  if (parts) {
    for (const part of parts) {
      const found = findPdfAttachment(part);
      if (found) return found;
    }
  }
  return null;
}

// ── Decode base64url → Uint8Array (for binary PDF data) ─────────────────────
function decodeBase64UrlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// ── Extract plain-text body from Gmail message payload ───────────────────────
function extractBody(payload: Record<string, unknown>): string {
  const parts = payload.parts as Array<Record<string, unknown>> | undefined;
  const mimeType = payload.mimeType as string | undefined;
  const body = payload.body as Record<string, unknown> | undefined;

  if (mimeType === "text/plain" && body?.data) {
    return decodeBase64Url(body.data as string);
  }

  if (parts) {
    for (const part of parts) {
      const text = extractBody(part);
      if (text) return text;
    }
  }

  // fallback: try body.data directly
  if (body?.data) {
    return decodeBase64Url(body.data as string);
  }

  return "";
}

// ── Extract header value from Gmail message headers ──────────────────────────
function getHeader(headers: Array<{ name: string; value: string }>, name: string): string {
  return headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

// ── Parse RFC 2822 date string to YYYY-MM-DD ─────────────────────────────────
function parseEmailDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return new Date().toISOString().split("T")[0];
    return d.toISOString().split("T")[0];
  } catch {
    return new Date().toISOString().split("T")[0];
  }
}

// ── Extract sender name from "Name <email>" format ───────────────────────────
function parseSenderName(from: string): string {
  const match = from.match(/^([^<]+)</);
  if (match) return match[1].trim().replace(/^"|"$/g, "");
  return from.split("@")[0] ?? from;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const startedAt = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseServiceKey);

    // Ensure receipt-pdfs bucket exists (idempotent)
    await sb.storage.createBucket("receipt-pdfs", { public: false }).catch(() => {});

    // Auth: verify the calling user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");
    const { data: { user }, error: authError } = await sb.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) throw new Error("Unauthorized");

    // Get Gmail access token (refresh if needed). Not being connected yet is
    // a configuration state the Settings page reports, not a 500.
    let accessToken: string;
    let mailboxAddress = user.email ?? null;
    try {
      accessToken = await getGmailAccessToken(sb, user.id);
      const { data: acct } = await sb
        .from("email_accounts").select("email_address")
        .eq("user_id", user.id).eq("provider", "google")
        .order("created_at", { ascending: true }).limit(1).maybeSingle();
      if (acct?.email_address) mailboxAddress = acct.email_address;
    } catch (e) {
      return new Response(
        JSON.stringify({ error: "not_configured", message: String(e) }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const queries: string[] = body.queries ?? DEFAULT_QUERIES;
    const after: string = body.after ?? DEFAULT_AFTER;
    const before: string | null = body.before ?? null;

    // Everything already harvested, so a message is skipped before it costs a
    // round trip. This is what makes a second run continue rather than repeat.
    const known = new Set<string>();
    {
      const pageSize = 1000;
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await sb
          .from("finance_transactions")
          .select("source_id")
          .eq("user_id", user.id)
          .eq("source", "gmail")
          .range(from, from + pageSize - 1);
        if (error) throw error;
        for (const r of data ?? []) if (r.source_id) known.add(r.source_id);
        if (!data || data.length < pageSize) break;
      }
    }

    // List every search, page by page, collecting ids we have not seen.
    const messages: Array<{ id: string }> = [];
    const seenInRun = new Set<string>();
    let listedAll = true;

    outer: for (const q of queries) {
      const fullQuery = [q, `after:${after}`, before ? `before:${before}` : "", "-in:drafts"]
        .filter(Boolean).join(" ");
      let pageToken: string | undefined;

      do {
        if (Date.now() - startedAt > TIME_BUDGET_MS) { listedAll = false; break outer; }

        const searchParams = new URLSearchParams({ q: fullQuery, maxResults: "100" });
        if (pageToken) searchParams.set("pageToken", pageToken);

        const listRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages?${searchParams}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!listRes.ok) {
          const errText = await listRes.text();
          throw new Error(`Gmail list error ${listRes.status}: ${errText}`);
        }
        const listData = await listRes.json();
        for (const m of listData.messages ?? []) {
          if (known.has(m.id) || seenInRun.has(m.id)) continue;
          seenInRun.add(m.id);
          messages.push(m);
        }
        pageToken = listData.nextPageToken;
      } while (pageToken);
    }

    let synced = 0;
    let skipped = 0;
    let done = listedAll;
    const errors: string[] = [];

    for (const msg of messages) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) { done = false; break; }
      try {
        // Fetch full message
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!msgRes.ok) {
          skipped++;
          continue;
        }
        const msgData = await msgRes.json();
        const headers = (msgData.payload?.headers ?? []) as Array<{ name: string; value: string }>;

        const subject = getHeader(headers, "subject") || "(no subject)";
        const from = getHeader(headers, "from");
        const dateStr = getHeader(headers, "date");
        const transactionDate = parseEmailDate(dateStr);
        const senderName = parseSenderName(from);

        // Extract body text for amount parsing
        const bodyText = extractBody(msgData.payload ?? {});
        const snippetText = msgData.snippet ?? "";
        const searchText = `${subject} ${snippetText} ${bodyText}`;
        const parsedAmount = extractAmount(searchText);
        const isReceipt = looksLikeReceipt(subject, from, mailboxAddress);
        const amount = isReceipt ? parsedAmount : null;

        // Try to download PDF attachment and store in Supabase Storage
        let pdfStoragePath: string | null = null;
        const pdfAttachment = findPdfAttachment(msgData.payload ?? {});
        if (pdfAttachment) {
          try {
            const attRes = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}/attachments/${pdfAttachment.attachmentId}`,
              { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            if (attRes.ok) {
              const attData = await attRes.json();
              if (attData.data) {
                const pdfBytes = decodeBase64UrlToBytes(attData.data as string);
                const storagePath = `receipts/${user.id}/${msg.id}.pdf`;
                const { error: storageErr } = await sb.storage
                  .from("receipt-pdfs")
                  .upload(storagePath, pdfBytes, {
                    contentType: "application/pdf",
                    upsert: true,
                  });
                if (!storageErr) pdfStoragePath = storagePath;
              }
            }
          } catch {
            // PDF download failed — continue without it
          }
        }

        const notesObj: Record<string, string> = {};
        if (pdfStoragePath) notesObj.pdf_path = pdfStoragePath;
        if (!isReceipt) {
          notesObj.hint = parsedAmount !== null
            ? `Not recognised as a receipt, so EUR ${parsedAmount} found in it was not booked. Enter the amount if this is a real purchase.`
            : "Not recognised as a receipt — enter the amount if this is a real purchase";
        } else if (amount === null) notesObj.hint = "Amount not parsed — update manually";

        const upsertRow: Record<string, unknown> = {
          user_id: user.id,
          source: "gmail",
          source_id: msg.id,
          type: "expense",
          category: null,
          amount_cents: amount !== null ? Math.round(amount * 100) : 0,
          currency: "EUR",
          amount_eur_cents: amount !== null ? Math.round(amount * 100) : 0,
          stripe_fee_cents: 0,
          net_cents: amount !== null ? Math.round(amount * 100) : null,
          transaction_date: transactionDate,
          description: subject,
          // Mirror the receipt-log columns so a scanned receipt lands in the
          // same shape as an imported one and the Gmail link is one click.
          subject,
          gmail_url: `https://mail.google.com/mail/u/0/#all/${msg.id}`,
          mailbox: mailboxAddress,
          receipt_filename: pdfAttachment?.filename ?? null,
          // Same "57 KB" shape the Apps Script writes, so the columns line up.
          receipt_size: pdfAttachment ? `${Math.round(pdfAttachment.size / 1024)} KB` : null,
          counterparty_name: senderName,
          counterparty_email: from.match(/<([^>]+)>/)?.[1] ?? from,
          counterparty_country: null,
          counterparty_vat_number: null,
          vat_treatment: null,
          vat_amount_cents: 0,
          is_reconciled: false,
          notes: Object.keys(notesObj).length ? JSON.stringify(notesObj) : null,
          raw_data: {
            gmail_message_id: msg.id,
            subject,
            from,
            snippet: snippetText.slice(0, 200),
            has_pdf: pdfStoragePath !== null,
            looks_like_receipt: isReceipt,
            parsed_amount: parsedAmount,
          },
        };

        const { error: upsertErr } = await sb
          .from("finance_transactions")
          .upsert(upsertRow, { onConflict: "source,source_id", ignoreDuplicates: true });

        if (upsertErr) {
          errors.push(`${msg.id}: ${upsertErr.message}`);
          skipped++;
        } else {
          synced++;
        }
      } catch (msgErr) {
        errors.push(`${msg.id}: ${String(msgErr)}`);
        skipped++;
      }
    }

    return new Response(
      JSON.stringify({
        synced, skipped, done,
        found: messages.length,
        already_stored: known.size,
        window: { after, before },
        // The Apps Script tells her to run it again when it hits its limit;
        // so does this, and for the same reason.
        message: done
          ? `Harvested ${synced} new receipt(s).`
          : `Harvested ${synced} so far — time limit reached, run it again to continue.`,
        errors: errors.slice(0, 20),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("sync-gmail-receipts error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
