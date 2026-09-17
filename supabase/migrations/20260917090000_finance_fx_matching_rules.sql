-- Three tables behind the last three manual steps of the VAT return:
-- the exchange rate on a date, a bank line paired with its receipt, and a
-- supplier's settled treatment. Each replaces a judgement the accountant
-- currently re-makes every month from the same inputs.

-- ---------------------------------------------------------------------------
-- 1. fx_rates — the ECB reference rate for one currency on one day.
-- ---------------------------------------------------------------------------
-- 116 transactions carry a foreign amount and no euro figure: 74 USD, 29 PLN,
-- 13 GBP, spanning June 2025 to September 2026. They are invisible to every
-- euro total in the app, including the VAT3.
--
-- Not user data: the ECB's rate on a date is a public fact and the same fact
-- for everyone, so this table is shared and has no user_id. Reading is open to
-- any signed-in user; writing belongs to the sync function alone.
--
-- Rates are stored as "units of CURRENCY per 1 EUR", which is the direction
-- the ECB publishes. Converting therefore DIVIDES. Storing the published
-- direction rather than its reciprocal keeps a stored number comparable to the
-- published one by eye, which matters when an accountant queries a figure.
CREATE TABLE IF NOT EXISTS public.fx_rates (
  rate_date   DATE NOT NULL,
  currency    TEXT NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  -- NUMERIC, never float: 1.0823 must round-trip exactly, because a VAT figure
  -- is derived from it and has to reconcile to the cent.
  rate_per_eur NUMERIC(18,8) NOT NULL CHECK (rate_per_eur > 0),
  source      TEXT NOT NULL DEFAULT 'ecb',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (rate_date, currency)
);

ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fx rates are readable by signed-in users"
  ON public.fx_rates FOR SELECT TO authenticated USING (true);

-- No INSERT/UPDATE/DELETE policy on purpose. The sync function uses the
-- service role, which bypasses RLS; nothing in the browser may rewrite a
-- published rate, because a rate that can be edited is not evidence.

CREATE INDEX IF NOT EXISTS fx_rates_currency_date_idx
  ON public.fx_rates (currency, rate_date DESC);

-- ---------------------------------------------------------------------------
-- 2. finance_receipt_matches — one bank line paired with one receipt.
-- ---------------------------------------------------------------------------
-- The bank line proves the money moved; the receipt carries the VAT, the
-- supplier's country and the PDF. Neither row alone can support a VAT3 entry,
-- and today the pairing exists only in the accountant's head as he scrolls two
-- lists side by side.
--
-- Measured on live data: of 115 receipts carrying an amount, 24 have a bank
-- line at the same euro figure within five days and 54 sit within 2%. The gap
-- between those two numbers is the whole problem — 2% of a payment is also the
-- distance between two unrelated subscriptions — so a score is proposed and a
-- person confirms. Same rule as duplicate review: propose, never decide.
CREATE TABLE IF NOT EXISTS public.finance_receipt_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  bank_transaction_id    UUID NOT NULL REFERENCES public.finance_transactions(id) ON DELETE CASCADE,
  receipt_transaction_id UUID NOT NULL REFERENCES public.finance_transactions(id) ON DELETE CASCADE,

  status TEXT NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed', 'confirmed', 'rejected')),

  -- 0-100. What the scorer thought, kept after confirmation so a later run can
  -- be compared against what a person actually accepted.
  score INT NOT NULL CHECK (score BETWEEN 0 AND 100),
  -- Why, in words, e.g. ["same euro amount", "2 days apart", "name matches"].
  reasons JSONB NOT NULL DEFAULT '[]'::jsonb,

  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- A row cannot be matched to itself.
  CONSTRAINT finance_receipt_matches_distinct
    CHECK (bank_transaction_id <> receipt_transaction_id)
);

-- One pair, proposed once. A rerun updates the score rather than stacking a
-- second proposal for the same two rows.
CREATE UNIQUE INDEX IF NOT EXISTS finance_receipt_matches_pair_idx
  ON public.finance_receipt_matches (bank_transaction_id, receipt_transaction_id);

-- A bank line has at most one CONFIRMED receipt, and vice versa. Partial
-- uniqueness, so competing proposals may coexist until someone picks one —
-- which is exactly the state the reviewer needs to see.
CREATE UNIQUE INDEX IF NOT EXISTS finance_receipt_matches_one_bank_idx
  ON public.finance_receipt_matches (bank_transaction_id) WHERE status = 'confirmed';
CREATE UNIQUE INDEX IF NOT EXISTS finance_receipt_matches_one_receipt_idx
  ON public.finance_receipt_matches (receipt_transaction_id) WHERE status = 'confirmed';

ALTER TABLE public.finance_receipt_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own receipt matches" ON public.finance_receipt_matches
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 3. finance_supplier_rules — what is already known about a supplier.
-- ---------------------------------------------------------------------------
-- 726 bank rows have no VAT treatment and no category at all, and they are the
-- same few dozen suppliers over and over: Anthropic 13 times, OpenAI 6, Vercel
-- 5, Fireflies 5, Anam 5. Deciding "Anthropic Ireland charges Irish VAT" once
-- a month, thirteen times, is the manual work this removes.
--
-- A rule proposes; it never overwrites. Applying is restricted to rows where
-- the field is still null, so a human decision always outranks a pattern —
-- the same guarantee ignoreDuplicates gives the syncs.
CREATE TABLE IF NOT EXISTS public.finance_supplier_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Matched case-insensitively as a substring against counterparty_name and,
  -- failing that, description. A substring rather than a regex because the
  -- person maintaining these is an accountant, and because bank descriptors
  -- mangle names in ways a regex would only pretend to anticipate
  -- ("google ads9621203723", "google*ads9621203723").
  match_pattern TEXT NOT NULL CHECK (length(trim(match_pattern)) >= 2),
  label TEXT,

  -- What the rule asserts. Any may be null — a rule that only sets a country
  -- is still useful, because the receipt extractor reasons from country.
  counterparty_country   TEXT CHECK (counterparty_country ~ '^[A-Z]{2}$'),
  counterparty_vat_number TEXT,
  vat_treatment TEXT CHECK (vat_treatment IN (
    'standard_23','reduced_135','zero_rated','exempt','reverse_charge','outside_scope'
  )),
  accounting_category TEXT,

  -- Lower runs first. Lets a specific rule ("anthropic ireland") beat a
  -- general one ("anthropic") without depending on row order.
  priority INT NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS finance_supplier_rules_pattern_idx
  ON public.finance_supplier_rules (user_id, lower(match_pattern));

ALTER TABLE public.finance_supplier_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own supplier rules" ON public.finance_supplier_rules
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Records that a rule, not a person, set these fields — so a later audit can
-- tell a proposal from a decision, and so applying is idempotent.
ALTER TABLE public.finance_transactions
  ADD COLUMN IF NOT EXISTS classified_by_rule_id UUID
    REFERENCES public.finance_supplier_rules(id) ON DELETE SET NULL;
