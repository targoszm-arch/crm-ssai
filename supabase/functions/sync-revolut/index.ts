/**
 * sync-revolut — pulls transactions from the Revolut Business API into
 * finance_transactions.
 *
 * Revolut Business issues no static API key. Every call needs a 40-minute
 * access token, minted by presenting a long-lived refresh token together with
 * an RS256 JWT ("client assertion") signed with the private half of the X509
 * certificate uploaded to Revolut. So a fresh access token is minted per run;
 * storing one would leave it stale within the hour.
 *
 * The refresh token lives in public.finance_oauth_tokens, not in a secret,
 * because Revolut's consent lapses periodically and re-authorising is a
 * recurring chore. Keeping it in the database lets this function write it
 * itself, so re-auth never needs the Supabase dashboard. That table is
 * service-role only (RLS on, no policies), so the browser cannot read it.
 *
 * Secrets:
 *   REVOLUT_CLIENT_ID     — Revolut Business → Settings → API
 *   REVOLUT_PRIVATE_KEY   — privatekey_pkcs8.pem contents ("BEGIN PRIVATE KEY")
 *   REVOLUT_REDIRECT_URI  — the registered OAuth redirect URI
 *   REVOLUT_SANDBOX       — optional, "true" for the sandbox host
 *
 * Actions (POST body):
 *   {"action":"exchange","code":"oa_prod_…"}  one-time / re-auth bootstrap
 *   {"action":"status"}                       is a refresh token stored?
 *   {"days":90}                               sync (default)
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
    "pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"],
  );
}

async function buildClientAssertion(): Promise<string> {
  const clientId = Deno.env.get("REVOLUT_CLIENT_ID");
  const privateKeyPem = Deno.env.get("REVOLUT_PRIVATE_KEY");
  const redirectUri = Deno.env.get("REVOLUT_REDIRECT_URI");

  const missing = [
    !clientId && "REVOLUT_CLIENT_ID",
    !privateKeyPem && "REVOLUT_PRIVATE_KEY",
    !redirectUri && "REVOLUT_REDIRECT_URI",
  ].filter(Boolean);
  if (missing.length) throw new Error(`not_configured: missing ${missing.join(", ")}`);

  // `iss` is the *host* of the redirect URI — no scheme, no path. Derived
  // rather than configured separately so the two cannot drift.
  const issuer = new URL(redirectUri!).hostname;

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: issuer,
    sub: clientId,
    aud: "https://revolut.com",
    exp: Math.floor(Date.now() / 1000) + 60,
  };

  const signingInput = `${b64urlText(JSON.stringify(header))}.${b64urlText(JSON.stringify(payload))}`;
  const key = await importPrivateKey(privateKeyPem!);
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signingInput),
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

    const readStoredToken = async (): Promise<string | null> => {
      const { data } = await sb
        .from("finance_oauth_tokens")
        .select("refresh_token")
        .eq("provider", "revolut")
        .maybeSingle();
      return (data?.refresh_token as string) ?? Deno.env.get("REVOLUT_REFRESH_TOKEN") ?? null;
    };

    const storeToken = async (token: string) => {
      await sb.from("finance_oauth_tokens").upsert(
        { provider: "revolut", refresh_token: token, obtained_at: new Date().toISOString() },
        { onConflict: "provider" },
      );
    };

    // ── status: does the UI need to show "connect" or "connected"? ────────
    if (body.action === "status") {
      const { data } = await sb
        .from("finance_oauth_tokens")
        .select("obtained_at, updated_at")
        .eq("provider", "revolut")
        .maybeSingle();
      const secretsSet = Boolean(
        Deno.env.get("REVOLUT_CLIENT_ID") &&
        Deno.env.get("REVOLUT_PRIVATE_KEY") &&
        Deno.env.get("REVOLUT_REDIRECT_URI"),
      );
      return json({
        secrets_set: secretsSet,
        has_refresh_token: Boolean(data) || Boolean(Deno.env.get("REVOLUT_REFRESH_TOKEN")),
        obtained_at: data?.obtained_at ?? null,
      });
    }

    // ── exchange: swap the ?code=… from the redirect for a refresh token ──
    if (body.action === "exchange") {
      const code = String(body.code ?? "").trim();
      if (!code) return json({ error: "bad_request", message: "Paste the code from the redirect URL." }, 400);
      try {
        const tokens = await postToken({ grant_type: "authorization_code", code });
        const refresh = tokens.refresh_token as string | undefined;
        if (!refresh) return json({ error: "no_refresh_token", message: "Revolut returned no refresh token.", raw: tokens }, 400);
        await storeToken(refresh);
        // Deliberately not returned to the browser: it is stored server-side
        // and there is no reason for it to exist in a browser tab.
        return json({ ok: true, message: "Revolut connected. Refresh token stored." });
      } catch (e) {
        const msg = String(e);
        if (msg.includes("not_configured")) return json({ error: "not_configured", message: msg }, 400);
        return json({
          error: "exchange_failed",
          message: msg + " — authorisation codes expire within minutes and are single-use. Click Enable in Revolut again for a fresh one.",
        }, 400);
      }
    }

    // ── sync ──────────────────────────────────────────────────────────────
    const refreshToken = await readStoredToken();
    if (!refreshToken) {
      return json({
        error: "not_configured",
        message: "Revolut is not connected yet. Use Connect Revolut in Settings, or import a CSV statement instead.",
      }, 400);
    }

    let accessToken: string;
    try {
      const tokens = await postToken({ grant_type: "refresh_token", refresh_token: refreshToken });
      accessToken = tokens.access_token as string;
      // Revolut may rotate the refresh token; persist it when it does.
      if (tokens.refresh_token && tokens.refresh_token !== refreshToken) {
        await storeToken(tokens.refresh_token as string);
      }
    } catch (e) {
      const msg = String(e);
      if (msg.includes("not_configured")) return json({ error: "not_configured", message: msg }, 400);
      return json({
        error: "auth_failed",
        message: msg + " — the consent may have lapsed. Re-connect with Connect Revolut in Settings.",
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
        // A bank feed does not know a tax position; that is set at reconciliation.
        vat_treatment: null,
        vat_amount_cents: 0,
        is_reconciled: false,
        raw_data: { revolut_type: tx.type, state: tx.state, legs },
      });
    }

    if (rows.length === 0) return json({ synced: 0, skipped, message: "No new completed transactions" });

    const { error: upsertErr } = await sb
      .from("finance_transactions")
      // ignoreDuplicates => ON CONFLICT DO NOTHING. A completed transaction is
      // a fixed fact, but the accounting category, tax rate, VAT treatment and
      // reconciled flag on that row are a person's work. DO UPDATE sent this
      // function's blank values over the top of them, so a sync silently
      // reset classification — the reconciliation work is the expensive part,
      // and a bank feed has no business overwriting it.
      .upsert(rows, { onConflict: "source,source_id", ignoreDuplicates: true });
    if (upsertErr) throw upsertErr;

    return json({ synced: rows.length, skipped });
  } catch (err) {
    console.error("sync-revolut error:", err);
    return json({ error: String(err) }, 500);
  }
});
