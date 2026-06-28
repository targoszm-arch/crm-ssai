/**
 * sync-revolut — pulls transactions from Revolut Business API into finance_transactions.
 *
 * Required env var (Supabase Dashboard → Edge Functions → Secrets):
 *   REVOLUT_API_KEY  — API key from Revolut Business → Settings → API → Production API Keys
 *
 * Optional:
 *   REVOLUT_SANDBOX=true  — use sandbox endpoint for testing
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const REVOLUT_BASE = Deno.env.get("REVOLUT_SANDBOX") === "true"
  ? "https://sandbox-b2b.revolut.com/api/1.0"
  : "https://b2b.revolut.com/api/1.0";

// Map Revolut transaction type to finance_transactions type
function mapType(revType: string, amount: number): "income" | "expense" | "fee" | "refund" {
  if (revType === "refund") return "refund";
  if (revType === "topup" || revType === "transfer_in") return "income";
  if (amount > 0) return "income";
  return "expense";
}

// Parse Revolut ISO date to YYYY-MM-DD
function toDate(iso: string): string {
  try { return new Date(iso).toISOString().split("T")[0]; } catch { return iso.split("T")[0]; }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const revolutKey = Deno.env.get("REVOLUT_API_KEY");
    if (!revolutKey) throw new Error("REVOLUT_API_KEY not configured. Add it in Supabase → Edge Functions → Secrets.");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseServiceKey);

    // Auth: verify calling user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");
    const { data: { user }, error: authError } = await sb.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) throw new Error("Unauthorized");

    // Date range: last 90 days (adjustable via body)
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const daysBack = body.days ?? 90;
    const from = new Date(Date.now() - daysBack * 86400_000).toISOString();
    const to = new Date().toISOString();

    // Fetch transactions from Revolut Business API
    const params = new URLSearchParams({ from, to, count: "1000" });
    const revRes = await fetch(`${REVOLUT_BASE}/transactions?${params}`, {
      headers: {
        Authorization: `Bearer ${revolutKey}`,
        Accept: "application/json",
      },
    });

    if (!revRes.ok) {
      const errText = await revRes.text();
      throw new Error(`Revolut API error ${revRes.status}: ${errText}`);
    }

    const transactions = await revRes.json() as Record<string, unknown>[];

    let synced = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const tx of transactions) {
      try {
        const id = tx.id as string;
        const legs = (tx.legs as Record<string, unknown>[]) ?? [];
        const leg = legs[0] ?? {};

        const rawAmount = Number(leg.amount ?? 0);
        const currency = (leg.currency as string) ?? "EUR";
        const amountCents = Math.round(Math.abs(rawAmount) * 100);
        const type = mapType(tx.type as string, rawAmount);

        // Convert to EUR if needed (basic approach — use leg.amount directly if EUR)
        const amountEurCents = currency === "EUR" ? amountCents : null;

        const merchant = tx.merchant as Record<string, unknown> | null;
        const counterpartyName = merchant?.name as string
          ?? (tx.counterparty as Record<string, unknown>)?.name as string
          ?? null;
        const counterpartyCountry = (merchant?.country as string) ?? null;

        const completedAt = (tx.completed_at as string) ?? (tx.created_at as string);

        const row: Record<string, unknown> = {
          user_id: user.id,
          source: "revolut",
          source_id: id,
          type,
          category: null,
          amount_cents: amountCents,
          currency,
          amount_eur_cents: amountEurCents,
          stripe_fee_cents: 0,
          net_cents: amountEurCents,
          transaction_date: toDate(completedAt),
          description: (tx.reference as string) ?? (tx.description as string) ?? null,
          counterparty_name: counterpartyName,
          counterparty_email: null,
          counterparty_country: counterpartyCountry,
          counterparty_vat_number: null,
          vat_treatment: null,
          vat_amount_cents: 0,
          is_reconciled: false,
          notes: null,
          raw_data: { revolut_type: tx.type, legs, state: tx.state },
        };

        // Skip declined/pending
        if ((tx.state as string) !== "completed") { skipped++; continue; }

        const { error: upsertErr } = await sb
          .from("finance_transactions")
          .upsert(row, { onConflict: "source,source_id", ignoreDuplicates: false });

        if (upsertErr) { errors.push(`${id}: ${upsertErr.message}`); skipped++; }
        else synced++;
      } catch (e) {
        errors.push(String(e));
        skipped++;
      }
    }

    return new Response(
      JSON.stringify({ synced, skipped, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("sync-revolut error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
