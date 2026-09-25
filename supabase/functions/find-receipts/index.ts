/**
 * find-receipts — looks in Gmail for the receipt behind specific bank lines.
 *
 * The bulk harvest (sync-gmail-receipts) pulled every PDF-bearing email into
 * the ledger as its own row, which is how an ROI calculator became an
 * EUR 85,938 expense. This goes the other way: start from a line the bank
 * says was paid, search Gmail around that date for that supplier, and attach
 * the best-matching email to the SAME row. No new rows, no amounts changed —
 * the bank line stays the money, the email becomes its evidence.
 *
 * POST { ids: string[] }  (at most 50 per call)
 * → { results: [{ id, status: "matched" | "no_match" | "already_has_receipt",
 *                 subject?, from?, amount_found?, score? }] }
 *
 * Scoring, per candidate email:
 *   amount appears in the email (e.g. 24.60 or 24,60)   +5
 *   supplier name appears in the sender                  +3
 *   supplier name appears in the subject                 +2
 *   subject reads as a receipt / invoice / payment       +2
 *   a PDF is attached                                    +1
 * Attached only at 5 or more, so either the amount matches or the supplier
 * and a receipt-like subject both do. Anything less is reported, not attached.
 *
 * The Gmail helpers are copied from sync-gmail-receipts rather than shared,
 * so each function deploys on its own.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const TIME_BUDGET_MS = 120_000;
const RECEIPT_WORDS = /\b(receipt|invoice|payment|paid|order|billing|bill|charge|charged|subscription|renewal|faktura|rechnung|factura|facture)\b/i;

// Words in a bank descriptor that say nothing about who was paid.
const NOISE = new Set([
  "payment", "from", "to", "the", "ltd", "limited", "inc", "llc", "gmbh", "bv", "sa", "sl", "ou",
  "com", "www", "http", "https", "pending", "card", "purchase", "subscription", "subscr",
  "ireland", "europe", "technology", "technologies", "services", "online", "pay", "paypal",
]);

/** "OPENAI *CHATGPT SUBSCR" -> ["openai", "chatgpt"]; "WWW.FIREJET.IO" -> ["firejet"]. */
function supplierTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/https?:\/\/|www\./g, " ")
    .replace(/\.(com|io|ai|app|net|org|co|ie|uk)\b/g, " ")
    .split(/[^a-z0-9]+/)
    // Reference numbers ("P885273904", "83105425") only narrow the search to nothing.
    .filter(w => w.length >= 3 && !NOISE.has(w) && !/\d{3,}/.test(w))
    .slice(0, 2);
}

/** The ways an amount is written in a receipt: 24.60, 24,60, 1,250.00, 1.250,00. */
function amountForms(cents: number): string[] {
  const whole = Math.floor(cents / 100);
  const frac = String(cents % 100).padStart(2, "0");
  const thousands = whole >= 1000 ? whole.toLocaleString("en-US") : String(whole);
  return [...new Set([
    `${whole}.${frac}`, `${whole},${frac}`,
    `${thousands}.${frac}`, `${thousands.replace(/,/g, ".")},${frac}`,
  ])];
}

const ymd = (d: Date) => `${d.getUTCFullYear()}/${d.getUTCMonth() + 1}/${d.getUTCDate()}`;

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

function decodeBase64UrlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

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

function getHeader(headers: Array<{ name: string; value: string }>, name: string): string {
  return headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}


Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const startedAt = Date.now();

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");
    const { data: { user }, error: authError } = await sb.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("Unauthorized");

    const body = await req.json().catch(() => ({}));
    const ids: string[] = Array.isArray(body.ids) ? body.ids.slice(0, 50) : [];
    if (ids.length === 0) return json({ error: "bad_request", message: "Select at least one transaction." }, 400);

    let accessToken: string;
    try {
      accessToken = await getGmailAccessToken(sb, user.id);
    } catch (e) {
      return json({ error: "not_configured", message: String(e) }, 400);
    }
    const gmail = async (path: string) => {
      const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error(`Gmail ${res.status}: ${await res.text()}`);
      return res.json();
    };

    // Only her own rows, whatever ids the browser sent.
    const { data: rows, error: rowsErr } = await sb
      .from("finance_transactions")
      .select("id, transaction_date, counterparty_name, description, amount_cents, amount_eur_cents, currency, gmail_url, raw_data")
      .eq("user_id", user.id)
      .in("id", ids);
    if (rowsErr) throw rowsErr;

    const results: Record<string, unknown>[] = [];
    let timedOut = false;

    for (const row of rows ?? []) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) { timedOut = true; break; }
      if (row.gmail_url) { results.push({ id: row.id, status: "already_has_receipt" }); continue; }

      const who = (row.counterparty_name ?? row.description ?? "") as string;
      const tokens = supplierTokens(who);
      if (tokens.length === 0) { results.push({ id: row.id, status: "no_match", reason: "no supplier name to search for" }); continue; }

      // A receipt usually lands the same day as the card charge, sometimes a
      // few days before (annual renewals notify ahead) or after (invoices).
      const day = new Date(`${row.transaction_date}T00:00:00Z`);
      const after = new Date(day); after.setUTCDate(after.getUTCDate() - 5);
      const before = new Date(day); before.setUTCDate(before.getUTCDate() + 10);
      const q = `(${tokens.join(" OR ")}) after:${ymd(after)} before:${ymd(before)} -in:drafts -in:sent`;

      let list;
      try {
        list = await gmail(`messages?${new URLSearchParams({ q, maxResults: "8" })}`);
      } catch (e) {
        results.push({ id: row.id, status: "no_match", reason: String(e) });
        continue;
      }

      const forms = amountForms(Math.abs(Number(row.amount_cents ?? 0)));
      const eurForms = row.amount_eur_cents != null ? amountForms(Math.abs(Number(row.amount_eur_cents))) : [];
      // deno-lint-ignore no-explicit-any
      let best: { score: number; msg: any; subject: string; from: string; amountFound: boolean } | null = null;

      for (const m of (list.messages ?? []).slice(0, 6)) {
        if (Date.now() - startedAt > TIME_BUDGET_MS) { timedOut = true; break; }
        const msg = await gmail(`messages/${m.id}?format=full`).catch(() => null);
        if (!msg) continue;
        const headers = (msg.payload?.headers ?? []) as Array<{ name: string; value: string }>;
        const subject = getHeader(headers, "subject");
        const from = getHeader(headers, "from");
        const text = `${subject} ${msg.snippet ?? ""} ${extractBody(msg.payload ?? {})}`;

        const amountFound = [...forms, ...eurForms].some(f => text.includes(f));
        const lcFrom = from.toLowerCase();
        const lcSubject = subject.toLowerCase();
        let score = 0;
        if (amountFound) score += 5;
        if (tokens.some(t => lcFrom.includes(t))) score += 3;
        if (tokens.some(t => lcSubject.includes(t))) score += 2;
        if (RECEIPT_WORDS.test(subject)) score += 2;
        if (findPdfAttachment(msg.payload ?? {})) score += 1;

        if (!best || score > best.score) best = { score, msg, subject, from, amountFound };
      }

      if (!best || best.score < 5) {
        results.push({ id: row.id, status: "no_match", best_score: best?.score ?? 0, closest: best?.subject ?? null });
        continue;
      }

      // Keep the PDF, if there is one, next to the other receipts.
      let pdfPath: string | null = null;
      const pdf = findPdfAttachment(best.msg.payload ?? {});
      if (pdf) {
        try {
          const att = await gmail(`messages/${best.msg.id}/attachments/${pdf.attachmentId}`);
          if (att.data) {
            const path = `receipts/${user.id}/${best.msg.id}.pdf`;
            const { error: upErr } = await sb.storage.from("receipt-pdfs")
              .upload(path, decodeBase64UrlToBytes(att.data as string), { contentType: "application/pdf", upsert: true });
            if (!upErr) pdfPath = path;
          }
        } catch { /* the link alone is still worth attaching */ }
      }

      const { error: updErr } = await sb.from("finance_transactions").update({
        gmail_url: `https://mail.google.com/mail/u/0/#all/${best.msg.id}`,
        receipt_filename: pdf?.filename ?? null,
        receipt_size: pdf ? `${Math.round(pdf.size / 1024)} KB` : null,
        raw_data: {
          ...((row.raw_data as Record<string, unknown>) ?? {}),
          receipt: {
            gmail_message_id: best.msg.id,
            subject: best.subject,
            from: best.from,
            pdf_path: pdfPath,
            score: best.score,
            amount_found: best.amountFound,
            found_at: new Date().toISOString(),
          },
        },
      }).eq("id", row.id).eq("user_id", user.id);
      if (updErr) { results.push({ id: row.id, status: "no_match", reason: updErr.message }); continue; }

      results.push({
        id: row.id, status: "matched", subject: best.subject, from: best.from,
        amount_found: best.amountFound, score: best.score,
      });
    }

    return json({ results, timed_out: timedOut });
  } catch (err) {
    console.error("find-receipts error:", err);
    return json({ error: String(err) }, 500);
  }
});
