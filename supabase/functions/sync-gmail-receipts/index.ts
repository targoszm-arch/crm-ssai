/**
 * sync-gmail-receipts — scans Gmail for receipts/invoices and upserts to finance_transactions.
 *
 * Required env vars (set in Supabase Dashboard → Edge Functions → Secrets):
 *   GMAIL_REFRESH_TOKEN   — OAuth2 refresh token (preferred; triggers auto-refresh)
 *   GMAIL_CLIENT_ID       — Google OAuth2 client ID
 *   GMAIL_CLIENT_SECRET   — Google OAuth2 client secret
 *   OR:
 *   GMAIL_ACCESS_TOKEN    — A static access token (short-lived; use refresh token flow instead)
 *
 * To obtain a refresh token:
 *   1. Create a Google Cloud project, enable Gmail API.
 *   2. Create OAuth2 credentials (Web application), add https://developers.google.com/oauthplayground as redirect URI.
 *   3. Visit https://developers.google.com/oauthplayground, select Gmail API v1 → gmail.readonly scope.
 *   4. Exchange for tokens, copy the refresh_token.
 *   5. Store as GMAIL_REFRESH_TOKEN, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET in Supabase secrets.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Amount regex patterns ─────────────────────────────────────────────────────
const AMOUNT_PATTERNS = [
  /€\s*([\d,]+\.?\d{0,2})/g,
  /EUR\s*([\d,]+\.?\d{0,2})/gi,
  /([\d,]+\.?\d{0,2})\s*EUR/gi,
];

function extractAmount(text: string): number | null {
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

// ── Get a fresh Gmail access token via refresh token flow ────────────────────
async function getGmailAccessToken(): Promise<string> {
  const refreshToken = Deno.env.get("GMAIL_REFRESH_TOKEN");
  const clientId = Deno.env.get("GMAIL_CLIENT_ID");
  const clientSecret = Deno.env.get("GMAIL_CLIENT_SECRET");
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
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gmail token refresh failed: ${err}`);
    }
    const json = await res.json();
    return json.access_token as string;
  }

  if (staticToken) return staticToken;

  throw new Error(
    "No Gmail credentials configured. Set GMAIL_REFRESH_TOKEN + GMAIL_CLIENT_ID + GMAIL_CLIENT_SECRET (or GMAIL_ACCESS_TOKEN) in Supabase secrets."
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
function findPdfAttachment(payload: Record<string, unknown>): { attachmentId: string; filename: string } | null {
  const mimeType = payload.mimeType as string | undefined;
  const body = payload.body as Record<string, unknown> | undefined;
  const parts = payload.parts as Array<Record<string, unknown>> | undefined;
  const filename = payload.filename as string | undefined;

  if (mimeType === "application/pdf" && body?.attachmentId) {
    return { attachmentId: body.attachmentId as string, filename: filename ?? "receipt.pdf" };
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

    // Get Gmail access token (refresh if needed)
    const accessToken = await getGmailAccessToken();

    // Search Gmail for receipts/invoices from the last 90 days
    const searchParams = new URLSearchParams({
      q: "receipt OR invoice has:attachment newer_than:90d",
      maxResults: "50",
    });
    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?${searchParams}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!listRes.ok) {
      const errText = await listRes.text();
      throw new Error(`Gmail list error ${listRes.status}: ${errText}`);
    }
    const listData = await listRes.json();
    const messages: Array<{ id: string }> = listData.messages ?? [];

    let synced = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const msg of messages) {
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
        const amount = extractAmount(searchText);

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
        if (amount === null) notesObj.hint = "Amount not parsed — update manually";

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
          },
        };

        const { error: upsertErr } = await sb
          .from("finance_transactions")
          .upsert(upsertRow, { onConflict: "source,source_id", ignoreDuplicates: false });

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
      JSON.stringify({ synced, skipped, errors }),
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
