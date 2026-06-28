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

    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not configured");

    // Auth: verify the calling user
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) throw new Error("Unauthorized");

    const body = await req.json().catch(() => ({}));
    const limit = Math.min(body.limit ?? 100, 100);
    // Optional: sync from a specific date
    const sinceTs = body.since_timestamp ? parseInt(body.since_timestamp) : undefined;

    // Fetch Stripe charges
    const chargesParams = new URLSearchParams({
      limit: String(limit),
      expand: ["data.customer", "data.balance_transaction"].join(","),
    });
    if (sinceTs) chargesParams.set("created[gte]", String(sinceTs));

    const chargesRes = await fetch(
      `https://api.stripe.com/v1/charges?${chargesParams}`,
      { headers: { Authorization: `Bearer ${stripeKey}` } }
    );
    if (!chargesRes.ok) throw new Error(`Stripe API error: ${chargesRes.status}`);
    const chargesData = await chargesRes.json();

    // Also fetch payouts (actual money to bank)
    const payoutsParams = new URLSearchParams({ limit: "50" });
    if (sinceTs) payoutsParams.set("created[gte]", String(sinceTs));
    const payoutsRes = await fetch(
      `https://api.stripe.com/v1/payouts?${payoutsParams}`,
      { headers: { Authorization: `Bearer ${stripeKey}` } }
    );
    const payoutsData = payoutsRes.ok ? await payoutsRes.json() : { data: [] };

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
        type: "fee",
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
      .upsert(upsertRows, { onConflict: "source,source_id", ignoreDuplicates: false });

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
