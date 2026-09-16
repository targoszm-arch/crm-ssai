-- Irish GAAP/FRS chart of accounts + named tax rates on every transaction.
--
-- `category` already existed but was a loose product-level label
-- (saas_subscription, travel…). An accountant needs the FRS line the amount
-- posts to, which is a different axis: Software & Subscriptions is an
-- overhead, Computer Equipment is a fixed asset, and Entertainment is an
-- overhead that is specifically NOT deductible. Both are kept.
--
-- The category list is fixed (it is a chart of accounts, not a free-text
-- field) and lives in code, in financeUtils.ts, so the two cannot drift.
-- Tax rates are the opposite: the names are fixed but the percentage is
-- editable, so they are rows, and each transaction stores the percentage it
-- was posted at. A rate change must never silently restate a filed period.

ALTER TABLE public.finance_transactions
  ADD COLUMN IF NOT EXISTS accounting_category TEXT,
  ADD COLUMN IF NOT EXISTS tax_rate_name       TEXT,
  ADD COLUMN IF NOT EXISTS tax_rate_percent    NUMERIC(6,3);

CREATE TABLE IF NOT EXISTS public.finance_tax_rates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name        TEXT NOT NULL,
  percent     NUMERIC(6,3) NOT NULL DEFAULT 0 CHECK (percent >= 0 AND percent <= 100),
  applies_to  TEXT NOT NULL DEFAULT 'both' CHECK (applies_to IN ('sales', 'purchases', 'both')),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, name)
);

ALTER TABLE public.finance_tax_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own tax rates" ON public.finance_tax_rates;
CREATE POLICY "Users can manage their own tax rates"
  ON public.finance_tax_rates FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_finance_tax_rates_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS finance_tax_rates_updated_at ON public.finance_tax_rates;
CREATE TRIGGER finance_tax_rates_updated_at
  BEFORE UPDATE ON public.finance_tax_rates
  FOR EACH ROW EXECUTE FUNCTION public.update_finance_tax_rates_updated_at();

-- Seed the rates for every existing user. The brief listed "Sales Tax on
-- Imports" twice, so three distinct names are seeded; more can be added in
-- Settings. Percentages are starting values meant to be edited there.
INSERT INTO public.finance_tax_rates (user_id, name, percent, applies_to, sort_order)
SELECT u.id, r.name, r.percent, r.applies_to, r.sort_order
FROM auth.users u
CROSS JOIN (VALUES
  ('Sales Tax on Imports', 0.0, 'sales',     1),
  ('Tax on Purchases',     0.0, 'purchases', 2),
  ('Tax on Sales',         0.0, 'sales',     3)
) AS r(name, percent, applies_to, sort_order)
ON CONFLICT (user_id, name) DO NOTHING;
