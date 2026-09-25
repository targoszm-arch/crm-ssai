import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Map Stripe customer country to VAT treatment for Irish VAT purposes
function deriveVatTreatment(
  country: string | null,
  vatNumber: string | null,
  amountCents: number
): { vatTreatment: string; vatAmountCents: number } {
  if (!country) return { vatTreatment: "outside_scope", vatAmountCents: 0 };
  if (country === "IE") {
    // Irish customer — 23% standard rate on SaaS
    const vatAmountCents = Math.round((amountCents / 1.23) * 0.23);
    return { vatTreatment: "standard_23", vatAmountCents };
  }
  const euCountries = [
    "AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU",
    "IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE",
  ];
  if (euCountries.includes(country)) {
    if (vatNumber) {
      // B2B EU — reverse charge, no Irish VAT
      return { vatTreatment: "reverse_charge", vatAmountCents: 0 };
    }
    // B2C EU — Irish VAT 23% (OSS or domestic rate applies)
    const vatAmountCents = Math.round((amountCents / 1.23) * 0.23);
    return { vatTreatment: "standard_23", vatAmountCents };
  }
  // Non-EU (US, UK, etc.) — outside scope
  return { vatTreatment: "outside_scope", vatAmountCents: 0 };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!stripeKey) {
      // Same as Revolut: "nobody has connected Stripe yet" is a state the
      // Settings page reports, not an error the user has to decode.
      return new Response(
        JSON.stringify({
          error: "not_configured",
          message: "STRIPE_SECRET_KEY is not set. Add it in Supabase → Edge Functions → Secrets.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Auth: verify the calling user
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) throw new Error("Unauthorized");

    const body = await req.json().catch(() => ({}));
    // Optional: sync from a specific date
    const sinceTs = body.since_timestamp ? parseInt(body.since_timestamp) : undefined;

    // Stripe list endpoints return one page and a `has_more` flag. This used
    // to read the first page only, so anything beyond the latest 100 charges
    // (50 payouts) was never synced. Walk every page with `starting_after`.
    //
    // `expand[]` must be repeated, one field per entry. It was sent as a
    // single comma-joined `expand=data.customer,data.balance_transaction`,
    // which Stripe rejects outright — every sync failed with a bare 400.
    // deno-lint-ignore no-explicit-any
    async function listAll(path: string, base: Record<string, string>, expand: string[] = []): Promise<any[]> {
      // deno-lint-ignore no-explicit-any
      const out: any[] = [];
      let startingAfter: string | null = null;
      for (let page = 0; page < 50; page++) {
        const params = new URLSearchParams({ limit: "100", ...base });
        for (const e of expand) params.append("expand[]", e);
        if (sinceTs) params.set("created[gte]", String(sinceTs));
        if (startingAfter) params.set("starting_after", startingAfter);
        const res = await fetch(`https://api.stripe.com/v1/${path}?${params}`, {
          headers: { Authorization: `Bearer ${stripeKey}` },
        });
        if (!res.ok) {
          // Stripe says exactly what it objected to; a bare status code hid it.
          const detail = await res.json().catch(() => null);
          throw new Error(`Stripe API error ${res.status} on ${path}: ${detail?.error?.message ?? "no detail"}`);
        }
        const json = await res.json();
        out.push(...(json.data ?? []));
        if (!json.has_more || !json.data?.length) break;
        startingAfter = json.data[json.data.length - 1].id;
      }
      return out;
    }

    const chargesData = { data: await listAll("charges", {}, ["data.customer", "data.balance_transaction"]) };
    // Payouts stay best-effort, as before: a key without payout access still
    // syncs the charges, which are the income.
    const payoutsData = { data: await listAll("payouts", {}).catch(() => []) };

    const upsertRows: Record<string, unknown>[] = [];

    for (const charge of chargesData.data ?? []) {
      if (charge.status !== "succeeded") continue;

      const customer = typeof charge.customer === "object" ? charge.customer : null;
      const country: string | null = customer?.address?.country ?? customer?.shipping?.address?.country ?? null;
      const vatNumber: string | null = customer?.tax_ids?.data?.[0]?.value ?? null;
      const balanceTx = typeof charge.balance_transaction === "object" ? charge.balance_transaction : null;
      const stripeFee = balanceTx?.fee ?? 0;
      const netCents = balanceTx?.net ?? (charge.amount - stripeFee);

      const { vatTreatment, vatAmountCents } = deriveVatTreatment(country, vatNumber, charge.amount);

      upsertRows.push({
        user_id: user.id,
        source: "stripe",
        source_id: charge.id,
        type: charge.amount < 0 ? "refund" : "income",
        category: "saas_subscription",
        amount_cents: charge.amount,
        currency: charge.currency.toUpperCase(),
        amount_eur_cents: charge.currency === "eur" ? charge.amount : null,
        stripe_fee_cents: stripeFee,
        net_cents: netCents,
        transaction_date: new Date(charge.created * 1000).toISOString().split("T")[0],
        description: charge.description ?? charge.statement_descriptor ?? "Stripe payment",
        counterparty_name: customer?.name ?? charge.billing_details?.name ?? null,
        counterparty_email: customer?.email ?? charge.billing_details?.email ?? null,
        counterparty_country: country,
        counterparty_vat_number: vatNumber,
        vat_treatment: vatTreatment,
        vat_amount_cents: vatAmountCents,
        raw_data: {
          charge_id: charge.id,
          customer_id: typeof charge.customer === "string" ? charge.customer : customer?.id,
          invoice_id: charge.invoice,
          receipt_url: charge.receipt_url,
        },
      });
    }

    for (const payout of payoutsData.data ?? []) {
      if (payout.status !== "paid") continue;
      upsertRows.push({
        user_id: user.id,
        source: "stripe",
        source_id: `payout_${payout.id}`,
        // Money moving from the Stripe balance to her own bank account: not a
        // cost and not a sale. Typed "fee" it was counted as a purchase in the
        // Accountant Pack, so every payout inflated expenses by its full amount.
        type: "transfer",
        category: "stripe_payout",
        amount_cents: payout.amount,
        currency: payout.currency.toUpperCase(),
        amount_eur_cents: payout.currency === "eur" ? payout.amount : null,
        net_cents: payout.amount,
        transaction_date: new Date(payout.arrival_date * 1000).toISOString().split("T")[0],
        description: `Stripe payout: ${payout.description ?? payout.statement_descriptor ?? "Bank transfer"}`,
        vat_treatment: "outside_scope",
        vat_amount_cents: 0,
        raw_data: { payout_id: payout.id },
      });
    }

    if (upsertRows.length === 0) {
      return new Response(
        JSON.stringify({ synced: 0, message: "No new transactions" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { error: upsertError } = await supabase
      .from("finance_transactions")
      // ignoreDuplicates => ON CONFLICT DO NOTHING. A completed transaction is
      // a fixed fact, but the accounting category, tax rate, VAT treatment and
      // reconciled flag on that row are a person's work. DO UPDATE sent this
      // function's blank values over the top of them, so a sync silently
      // reset classification — the reconciliation work is the expensive part,
      // and a bank feed has no business overwriting it.
      .upsert(upsertRows, { onConflict: "source,source_id", ignoreDuplicates: true });

    if (upsertError) throw upsertError;

    return new Response(
      JSON.stringify({ synced: upsertRows.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("sync-stripe-income error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
