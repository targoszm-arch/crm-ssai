-- A ledger of VAT3 periods, so "already claimed" is recorded rather than remembered.
--
-- The spreadsheet this replaces computed VAT due as (all output VAT) minus
-- (all input VAT ever recorded), and separately noted that EUR 155.46 and
-- EUR 189.04 had been "Submitted 13/9/26". Those two submissions are the
-- May-Jun and Jul-Aug 2026 periods, EUR 344.50 of the EUR 344.73 input VAT the
-- subtraction used — so the figure carried EUR 344.50 of input VAT that had
-- already been claimed in an earlier return. The sheet has an "Offset" row for
-- exactly that adjustment; it was left blank.
--
-- With a row per period the arithmetic cannot drift: each period's figures are
-- computed from the transactions dated inside it, and filing stamps what was
-- actually submitted. A later edit to an old receipt changes the live figure
-- but never the filed one.

CREATE TABLE IF NOT EXISTS public.finance_vat_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- The VAT3 period. Stored as dates rather than a label so a period can be
  -- compared against a transaction date without parsing anything.
  period_start DATE NOT NULL,
  period_end   DATE NOT NULL,

  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'submitted')),
  submitted_on DATE,

  -- Figures AS FILED, in euro. Null until submitted. These are deliberately a
  -- copy, not a view: what was sent to Revenue is a historical fact, and a
  -- receipt classified next month must not silently restate a filed return.
  filed_output_vat_cents BIGINT,
  filed_input_vat_cents  BIGINT,
  filed_net_cents        BIGINT,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  CONSTRAINT finance_vat_returns_period_order CHECK (period_end >= period_start)
);

-- One row per period per user; the UI upserts on it.
CREATE UNIQUE INDEX IF NOT EXISTS finance_vat_returns_period_idx
  ON public.finance_vat_returns (user_id, period_start, period_end);

ALTER TABLE public.finance_vat_returns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own VAT returns"
  ON public.finance_vat_returns;
CREATE POLICY "Users can manage their own VAT returns"
  ON public.finance_vat_returns
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS finance_vat_returns_updated_at ON public.finance_vat_returns;
CREATE TRIGGER finance_vat_returns_updated_at
  BEFORE UPDATE ON public.finance_vat_returns
  FOR EACH ROW EXECUTE FUNCTION public.update_finance_transactions_updated_at();
