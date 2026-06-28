-- Finance transactions table for tax reconciliation dashboard
CREATE TABLE IF NOT EXISTS public.finance_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Source
  source TEXT NOT NULL CHECK (source IN ('stripe', 'revolut', 'paypal', 'manual')),
  source_id TEXT, -- external ID (Stripe charge ID, etc.)

  -- Classification
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'refund', 'fee')),
  category TEXT, -- 'saas_subscription', 'consulting', 'software', 'equipment', 'marketing', 'other'

  -- Amounts (stored in cents to avoid float issues)
  amount_cents BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  amount_eur_cents BIGINT, -- EUR equivalent (for non-EUR transactions)
  stripe_fee_cents BIGINT DEFAULT 0,
  net_cents BIGINT, -- after fees

  -- Date
  transaction_date DATE NOT NULL,

  -- Counterparty
  description TEXT,
  counterparty_name TEXT,
  counterparty_email TEXT,
  counterparty_country TEXT, -- ISO 3166-1 alpha-2, e.g. 'IE', 'DE'
  counterparty_vat_number TEXT,

  -- Irish VAT
  vat_treatment TEXT CHECK (vat_treatment IN (
    'standard_23',      -- Irish standard rate 23%
    'reduced_135',      -- Irish reduced rate 13.5%
    'zero_rated',       -- 0% (e.g. exports, some food)
    'exempt',           -- VAT exempt
    'reverse_charge',   -- EU B2B reverse charge
    'outside_scope'     -- non-EU, outside VAT scope
  )),
  vat_amount_cents BIGINT DEFAULT 0,

  -- Reconciliation
  is_reconciled BOOLEAN DEFAULT FALSE,
  notes TEXT,

  -- Raw payload from source
  raw_data JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Unique constraint to prevent duplicate syncs
CREATE UNIQUE INDEX IF NOT EXISTS finance_transactions_source_id_idx
  ON public.finance_transactions (source, source_id)
  WHERE source_id IS NOT NULL;

-- Index for date-range queries
CREATE INDEX IF NOT EXISTS finance_transactions_user_date_idx
  ON public.finance_transactions (user_id, transaction_date DESC);

-- RLS: each user sees only their own transactions
ALTER TABLE public.finance_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own finance transactions"
  ON public.finance_transactions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_finance_transactions_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER finance_transactions_updated_at
  BEFORE UPDATE ON public.finance_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_finance_transactions_updated_at();
