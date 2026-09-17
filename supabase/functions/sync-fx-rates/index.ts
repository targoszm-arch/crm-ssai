// Euro reference rates from the ECB, and the euro figures they unlock.
//
// 116 transactions carry a foreign amount and no euro one — 74 USD, 29 PLN,
// 13 GBP, from June 2025 to September 2026. Every euro total in the app steps
// over them, the VAT3 included, so a USD invoice with VAT on it is currently
// worth nothing to the return.
//
// Two jobs, either or both per call:
//   mode "rates"    — pull the ECB daily reference rates into fx_rates
//   mode "convert"  — fill amount_eur_cents where it is null, using them
//
// Why the ECB: Revenue accepts the ECB rate on the date of the supply for VAT
// purposes, it is published, and it is the same number for everyone — which
// means an accountant can check any figure here against a public source.
// Revolut's own rate would be defensible too, but the CSV import dropped it
// and the API does not backfill, so it is not available for these rows.

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// The full series back to 1999. The 90-day file would cover neither June 2025
// nor most of what needs converting, so the larger download is the right one
// even though it is a few megabytes.
const ECB_HIST = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist.xml";

/**
 * Parse the ECB's daily cube file.
 *
 * Shape, unchanged for twenty years:
 *   <Cube time='2026-09-16'>
 *     <Cube currency='USD' rate='1.0823'/>
 *
 * Parsed by regex rather than a DOM: this is a fixed machine-generated format,
 * and a 4MB DOM in an edge function is the more fragile of the two choices.
 * The rate is kept as the published string and cast by Postgres into NUMERIC,
 * so no float ever touches it.
 */
export function parseEcbXml(
  xml: string,
  wanted: Set<string>,
): { rate_date: string; currency: string; rate_per_eur: string }[] {
  const out: { rate_date: string; currency: string; rate_per_eur: string }[] = [];
  // Split on the dated cubes, then read the currency cubes inside each.
  const dayRe = /<Cube\s+time=['"](\d{4}-\d{2}-\d{2})['"]\s*>([\s\S]*?)<\/Cube>/g;
  for (const day of xml.matchAll(dayRe)) {
    const rate_date = day[1];
    const rateRe = /<Cube\s+currency=['"]([A-Z]{3})['"]\s+rate=['"]([\d.]+)['"]\s*\/>/g;
    for (const r of day[2].matchAll(rateRe)) {
      const currency = r[1];
      if (wanted.size && !wanted.has(currency)) continue;
      // A zero or unparseable rate is not a rate. The CHECK would reject it
      // anyway; dropping it here keeps one bad day from failing a whole batch.
      if (!(Number(r[2]) > 0)) continue;
      out.push({ rate_date, currency, rate_per_eur: r[2] });
    }
  }
  return out;
}

/**
 * The rate to use for a payment on `date`.
 *
 * The ECB publishes on TARGET business days only, so a Saturday payment, a
 * Sunday payment and anything on Christmas Day have no rate of their own. The
 * convention — and what Revenue expects — is the last published rate before
 * the date, not the next one: a rate that did not exist when the money moved
 * cannot be the rate the money moved at.
 *
 * The window is bounded so a missing stretch of data fails loudly rather than
 * silently reaching back a month for a number.
 */
export function pickRate(
  rates: { rate_date: string; rate_per_eur: string }[],
  date: string,
  maxLookbackDays = 7,
): { rate_date: string; rate_per_eur: string } | null {
  let best: { rate_date: string; rate_per_eur: string } | null = null;
  for (const r of rates) {
    if (r.rate_date > date) continue;
    if (!best || r.rate_date > best.rate_date) best = r;
  }
  if (!best) return null;
  const gap = (Date.parse(date) - Date.parse(best.rate_date)) / 86_400_000;
  return gap <= maxLookbackDays ? best : null;
}

/** Foreign minor units -> euro cents. Divides, because rates are per 1 EUR. */
export function toEurCents(amountCents: number, ratePerEur: string): number {
  return Math.round(amountCents / Number(ratePerEur));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const startedAt = Date.now();

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const mode: string = body.mode ?? "all";
    const dryRun: boolean = body.dry_run === true;

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Whose ledger this touches. The service-role client bypasses RLS, so
    // without resolving the caller every signed-in user would convert every
    // other user's transactions. Same shape as sync-revolut, deliberately:
    // one function skipping the check is how a single-tenant assumption
    // becomes a cross-tenant write.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");
    const { data: { user }, error: authError } =
      await sb.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("Unauthorized");

    const result: Record<string, unknown> = { mode, dry_run: dryRun };

    // Which currencies matter here. Read from the data rather than hardcoded,
    // so a first PLN invoice next year needs no code change.
    //
    // Paged explicitly: PostgREST caps an unordered select at 1000 rows, and
    // past that a currency could silently drop out of `wanted` — the rate
    // would never be fetched and its transactions would stay unconverted,
    // with nothing in the output saying so.
    const wanted = new Set<string>();
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb
        .from("finance_transactions")
        .select("currency")
        .eq("user_id", user.id)
        .neq("currency", "EUR")
        .order("currency")
        .range(from, from + 999);
      if (error) throw error;
      for (const r of data ?? []) wanted.add(r.currency);
      if (!data || data.length < 1000) break;
    }
    result.currencies = [...wanted].sort();

    // No foreign currency means nothing to fetch. Without this, an empty
    // `wanted` makes parseEcbXml keep every currency the ECB publishes and
    // store ~1.5M rows to convert nothing.
    if (wanted.size === 0) {
      return new Response(
        JSON.stringify({ ...result, parsed_rates: 0, converted: 0, note: "no foreign-currency transactions" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ---- rates ----------------------------------------------------------
    if (mode === "rates" || mode === "all") {
      const res = await fetch(ECB_HIST);
      if (!res.ok) throw new Error(`ECB returned ${res.status}`);
      const xml = await res.text();
      const parsed = parseEcbXml(xml, wanted);
      result.parsed_rates = parsed.length;
      result.rate_range = parsed.length
        ? { first: parsed[parsed.length - 1].rate_date, last: parsed[0].rate_date }
        : null;

      if (!dryRun && parsed.length) {
        // ignoreDuplicates: a published rate is a historical fact. Re-running
        // must never rewrite one, only add days that were missing.
        for (let i = 0; i < parsed.length; i += 1000) {
          const { error } = await sb
            .from("fx_rates")
            .upsert(parsed.slice(i, i + 1000), {
              onConflict: "rate_date,currency",
              ignoreDuplicates: true,
            });
          if (error) throw error;
        }
      }
    }

    // ---- convert --------------------------------------------------------
    if (mode === "convert" || mode === "all") {
      const { data: txs, error: txErr } = await sb
        .from("finance_transactions")
        .select("id, transaction_date, currency, amount_cents, vat_amount_cents, vat_eur_cents")
        .eq("user_id", user.id)
        .neq("currency", "EUR")
        .is("amount_eur_cents", null);
      if (txErr) throw txErr;

      const need = txs ?? [];
      result.candidates = need.length;

      // One read per currency, then matched in memory. 116 rows against three
      // currencies is not worth 116 round trips.
      const byCcy = new Map<string, { rate_date: string; rate_per_eur: string }[]>();
      for (const c of new Set(need.map(t => t.currency))) {
        const { data, error } = await sb
          .from("fx_rates")
          .select("rate_date, rate_per_eur")
          .eq("currency", c)
          .order("rate_date", { ascending: false });
        if (error) throw error;
        byCcy.set(c, data ?? []);
      }

      const converted: unknown[] = [];
      const unresolved: unknown[] = [];

      for (const t of need) {
        const rate = pickRate(byCcy.get(t.currency) ?? [], t.transaction_date);
        if (!rate) {
          unresolved.push({ id: t.id, date: t.transaction_date, currency: t.currency });
          continue;
        }
        const amount_eur_cents = toEurCents(t.amount_cents, rate.rate_per_eur);

        // VAT converts at the same rate as the amount it belongs to — using
        // two rates on one document is how a return stops adding up. Only
        // filled when the euro figure is still absent; a figure already read
        // off the receipt is better evidence than any rate.
        const patch: Record<string, unknown> = { amount_eur_cents };

        if (t.vat_amount_cents && t.vat_amount_cents > 0 && !t.vat_eur_cents) {
          patch.vat_eur_cents = toEurCents(t.vat_amount_cents, rate.rate_per_eur);
        }

        converted.push({
          id: t.id,
          date: t.transaction_date,
          currency: t.currency,
          rate_date: rate.rate_date,
          rate: rate.rate_per_eur,
          amount_cents: t.amount_cents,
          amount_eur_cents,
          patch,
        });
      }

      result.converted = converted.length;
      result.unresolved = unresolved.length;
      result.unresolved_sample = unresolved.slice(0, 5);
      result.sample = converted.slice(0, 5).map((c) => {
        const { patch: _p, ...rest } = c as Record<string, unknown>;
        return rest;
      });

      if (!dryRun) {
        for (const c of converted as { id: string; patch: Record<string, unknown> }[]) {
          const { error } = await sb
            .from("finance_transactions")
            .update(c.patch)
            .eq("id", c.id)
            .eq("user_id", user.id)
            // Belt and braces: only ever fills a hole. If something else set a
            // euro figure between the read and this write, that one wins.
            .is("amount_eur_cents", null);
          if (error) throw error;
        }
      }
    }

    result.ms = Date.now() - startedAt;
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
