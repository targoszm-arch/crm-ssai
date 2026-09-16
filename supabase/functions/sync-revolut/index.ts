/**
 * sync-revolut — pulls transactions from the Revolut Business API into
 * finance_transactions.
 *
 * Revolut Business does not accept a static API key. Every call needs a
 * 40-minute access token, minted by presenting a long-lived refresh token
 * together with an RS256 JWT ("client assertion") signed with the private
 * half of the certificate uploaded to Revolut. So this function mints a fresh
 * access token on each run rather than storing one — a stored one would be
 * stale within the hour, which is exactly what the previous static-key
 * version got wrong.
 *
 * Secrets (Supabase → Edge Functions → Secrets):
 *   REVOLUT_CLIENT_ID     — from Revolut Business → Settings → API
 *   REVOLUT_PRIVATE_KEY   — contents of privatekey.pem, PKCS#8 ("BEGIN PRIVATE KEY")
 *   REVOLUT_REFRESH_TOKEN — from the one-time code exchange (see below)
 *   REVOLUT_REDIRECT_URI  — the OAuth redirect URI registered with Revolut
 *   REVOLUT_SANDBOX       — optional, "true" to hit the sandbox host
 *
 * One-time setup: after clicking Enable in Revolut you are redirected to your
 * redirect URI with ?code=oa_prod_… in the address bar. Call this function
 * once with { "action": "exchange", "code": "oa_prod_…" } and it returns the
 * refresh token to store as REVOLUT_REFRESH_TOKEN. The code is single-use and
 * expires quickly, so do it promptly.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const REVOLUT_BASE = Deno.env.get("REVOLUT_SANDBOX") === "true"
  ? "https://sandbox-b2b.revolut.com/api/1.0"
  : "https://b2b.revolut.com/api/1.0";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// ── JWT client assertion ───────────────────────────────────────────────────

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const b64urlText = (s: string) => b64url(new TextEncoder().encode(s));

/**
 * Import the private key. Web Crypto only accepts PKCS#8, while
 * `openssl genrsa` on OpenSSL 1.x emits PKCS#1 — a difference that shows up
 * only as an opaque DataError, so name it explicitly.
 */
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const trimmed = pem.trim();
  if (trimmed.includes("BEGIN RSA PRIVATE KEY")) {
    throw new Error(
      "REVOLUT_PRIVATE_KEY is in PKCS#1 format. Convert it with: " +
      "openssl pkcs8 -topk8 -nocrypt -in privatekey.pem -out privatekey_pkcs8.pem",
    );
  }
  if (!trimmed.includes("BEGIN PRIVATE KEY")) {
    throw new Error("REVOLUT_PRIVATE_KEY does not look like a PEM private key.");
  }
  const body = trimmed
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(body), c => c.charCodeAt(0));
  return await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function buildClientAssertion(): Promise<string> {
  const clientId = Deno.env.get("REVOLUT_CLIENT_ID");
  const privateKeyPem = Deno.env.get("REVOLUT_PRIVATE_KEY");
  const redirectUri = Deno.env.get("REVOLUT_REDIRECT_URI");

  if (!clientId || !privateKeyPem || !redirectUri) {
    throw new Error(
      "not_configured: REVOLUT_CLIENT_ID, REVOLUT_PRIVATE_KEY and REVOLUT_REDIRECT_URI must all be set.",
    );
  }

  // `iss` is the *host* of the redirect URI, with no scheme or path. Revolut
  // rejects the assertion if it does not match the registered URI's domain.
  const issuer = new URL(redirectUri).hostname;

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: issuer,
    sub: clientId,
    aud: "https://revolut.com",
    // Short-lived on purpose: it only has to survive this one token call.
    exp: Math.floor(Date.now() / 1000) + 60,
  };

  const signingInput = `${b64urlText(JSON.stringify(header))}.${b64urlText(JSON.stringify(payload))}`;
  const key = await importPrivateKey(privateKeyPem);
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${b64url(new Uint8Array(sig))}`;
}

async function postToken(params: Record<string, string>): Promise<Record<string, unknown>> {
  const clientId = Deno.env.get("REVOLUT_CLIENT_ID")!;
  const assertion = await buildClientAssertion();

  const res = await fetch(`${REVOLUT_BASE}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      ...params,
      client_id: clientId,
      client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      client_assertion: assertion,
    }),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`Revolut token error ${res.status}: ${text}`);
  return JSON.parse(text);
}

const getAccessToken = async (refreshToken: string) =>
  (await postToken({ grant_type: "refresh_token", refresh_token: refreshToken }))
    .access_token as string;

// ── Transaction mapping ────────────────────────────────────────────────────

function mapType(revType: string, amount: number): "income" | "expense" | "fee" | "refund" {
  if (revType === "refund") return "refund";
  if (revType === "fee" || revType === "card_credit") return "fee";
  if (revType === "topup" || revType === "transfer_in") return "income";
  return amount > 0 ? "income" : "expense";
}

function toDate(iso: string): string {
  try { return new Date(iso).toISOString().split("T")[0]; } catch { return iso.split("T")[0]; }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");
    const { data: { user }, error: authError } =
      await sb.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("Unauthorized");

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

    // ── One-time: swap the ?code=… from the redirect for a refresh token ──
    if (body.action === "exchange") {
      if (!body.code) return json({ error: "bad_request", message: "Provide the `code` from the redirect URL." }, 400);
      const tokens = await postToken({
        grant_type: "authorization_code",
        code: String(body.code),
      });
      return json({
        message: "Store `refresh_token` as the REVOLUT_REFRESH_TOKEN secret. It is shown once.",
        refresh_token: tokens.refresh_token,
        access_token_expires_in: tokens.expires_in,
      });
    }

    const refreshToken = Deno.env.get("REVOLUT_REFRESH_TOKEN");
    if (!refreshToken) {
      return json({
        error: "not_configured",
        message: "REVOLUT_REFRESH_TOKEN is not set. Run this function once with " +
                 '{"action":"exchange","code":"oa_prod_…"} to obtain it, or import a Revolut CSV instead.',
      }, 400);
    }

    let accessToken: string;
    try {
      accessToken = await getAccessToken(refreshToken);
    } catch (e) {
      const msg = String(e);
      // A missing/!expired credential is a setup state, not a crash — the
      // Settings page branches on `not_configured` to say "not connected".
      if (msg.includes("not_configured")) return json({ error: "not_configured", message: msg }, 400);
      return json({
        error: "auth_failed",
        message: msg + " — if the refresh token has been revoked or the 90-day consent lapsed, re-authorise in Revolut and re-run the exchange step.",
      }, 400);
    }

    const daysBack = Number(body.days ?? 90);
    const params = new URLSearchParams({
      from: new Date(Date.now() - daysBack * 86400_000).toISOString().split("T")[0],
      to: new Date().toISOString().split("T")[0],
      count: "1000",
    });

    const revRes = await fetch(`${REVOLUT_BASE}/transactions?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    });
    if (!revRes.ok) throw new Error(`Revolut API error ${revRes.status}: ${await revRes.text()}`);

    const transactions = await revRes.json() as Record<string, unknown>[];

    const rows: Record<string, unknown>[] = [];
    let skipped = 0;

    for (const tx of transactions) {
      if ((tx.state as string) !== "completed") { skipped++; continue; }

      const legs = (tx.legs as Record<string, unknown>[]) ?? [];
      const leg = legs[0] ?? {};
      const rawAmount = Number(leg.amount ?? 0);
      if (!rawAmount) { skipped++; continue; }

      const currency = ((leg.currency as string) ?? "EUR").toUpperCase();
      const amountCents = Math.round(Math.abs(rawAmount) * 100);
      const amountEurCents = currency === "EUR" ? amountCents : null;

      const merchant = tx.merchant as Record<string, unknown> | null;
      const counterparty = tx.counterparty as Record<string, unknown> | null;
      const description = (tx.reference as string) ?? (tx.description as string)
        ?? (merchant?.name as string) ?? "Revolut transaction";

      rows.push({
        user_id: user.id,
        source: "revolut",
        source_id: tx.id as string,
        type: mapType(tx.type as string, rawAmount),
        amount_cents: amountCents,
        currency,
        amount_eur_cents: amountEurCents,
        stripe_fee_cents: Math.round(Math.abs(Number(tx.fee ?? 0)) * 100),
        net_cents: amountEurCents,
        transaction_date: toDate((tx.completed_at as string) ?? (tx.created_at as string)),
        description,
        subject: description,
        counterparty_name: (merchant?.name as string) ?? (counterparty?.name as string) ?? null,
        counterparty_country: (merchant?.country as string) ?? null,
        // Left null deliberately: VAT treatment is a tax position, not
        // something a bank feed knows. It is set during reconciliation.
        vat_treatment: null,
        vat_amount_cents: 0,
        is_reconciled: false,
        raw_data: { revolut_type: tx.type, state: tx.state, legs },
      });
    }

    if (rows.length === 0) return json({ synced: 0, skipped, message: "No new completed transactions" });

    const { error: upsertErr } = await sb
      .from("finance_transactions")
      .upsert(rows, { onConflict: "source,source_id", ignoreDuplicates: false });
    if (upsertErr) throw upsertErr;

    return json({ synced: rows.length, skipped });
  } catch (err) {
    console.error("sync-revolut error:", err);
    return json({ error: String(err) }, 500);
  }
});
