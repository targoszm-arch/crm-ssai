-- Finance receipt-log columns + the sources the app actually writes.
--
-- 20260627000000 created finance_transactions but was never applied to the
-- remote project, so the table did not exist and every finance edge function
-- failed on its first upsert. This migration is written to run either after
-- that one or on its own.
--
-- Two things it fixes beyond creating the table:
--
--   * `source` allowed only stripe/revolut/paypal/manual, but the UI and
--     sync-gmail-receipts both read and write `source = 'gmail'`, so a
--     receipt row could never be stored. 'gmail' and 'receipt_log' are
--     allowed here.
--   * The receipt log Magda keeps (Date/Supplier/Subject/Invoice Amount/…)
--     carries per-receipt provenance — the Drive file, the Gmail thread, the
--     mailbox it landed in — that had nowhere to live. Those are columns now,
--     not raw_data keys, because reconciliation means opening the document.

CREATE TABLE IF NOT EXISTS public.finance_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  source TEXT NOT NULL,
  source_id TEXT,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'refund', 'fee')),
  category TEXT,
  amount_cents BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  amount_eur_cents BIGINT,
  stripe_fee_cents BIGINT DEFAULT 0,
  net_cents BIGINT,
  transaction_date DATE NOT NULL,
  description TEXT,
  counterparty_name TEXT,
  counterparty_email TEXT,
  counterparty_country TEXT,
  counterparty_vat_number TEXT,
  vat_treatment TEXT CHECK (vat_treatment IN (
    'standard_23', 'reduced_135', 'zero_rated',
    'exempt', 'reverse_charge', 'outside_scope'
  )),
  vat_amount_cents BIGINT DEFAULT 0,
  is_reconciled BOOLEAN DEFAULT FALSE,
  notes TEXT,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Receipt-log columns. Amounts stay in cents like every other amount here.
ALTER TABLE public.finance_transactions
  ADD COLUMN IF NOT EXISTS subject             TEXT,
  ADD COLUMN IF NOT EXISTS vat_eur_cents       BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat_collected_cents BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS receipt_filename    TEXT,
  ADD COLUMN IF NOT EXISTS receipt_size        TEXT,
  ADD COLUMN IF NOT EXISTS drive_url           TEXT,
  ADD COLUMN IF NOT EXISTS gmail_url           TEXT,
  ADD COLUMN IF NOT EXISTS mailbox             TEXT;

-- Widen `source` rather than recreate the constraint blindly: the old table
-- may or may not carry the four-value CHECK depending on whether
-- 20260627000000 ever ran here.
ALTER TABLE public.finance_transactions
  DROP CONSTRAINT IF EXISTS finance_transactions_source_check;
ALTER TABLE public.finance_transactions
  ADD CONSTRAINT finance_transactions_source_check
  CHECK (source IN ('stripe', 'revolut', 'paypal', 'manual', 'gmail', 'receipt_log'));

CREATE UNIQUE INDEX IF NOT EXISTS finance_transactions_source_id_idx
  ON public.finance_transactions (source, source_id)
  WHERE source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS finance_transactions_user_date_idx
  ON public.finance_transactions (user_id, transaction_date DESC);

ALTER TABLE public.finance_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own finance transactions"
  ON public.finance_transactions;
CREATE POLICY "Users can manage their own finance transactions"
  ON public.finance_transactions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_finance_transactions_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS finance_transactions_updated_at ON public.finance_transactions;
CREATE TRIGGER finance_transactions_updated_at
  BEFORE UPDATE ON public.finance_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_finance_transactions_updated_at();
