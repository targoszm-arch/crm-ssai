-- Deleted means deleted, even for rows a feed keeps sending.
--
-- The syncs insert with ON CONFLICT DO NOTHING, which protects a row that
-- still exists — its category, type and sign-off survive every sync — but
-- does nothing for a row that was deleted: there is no conflict, so the next
-- sync inserts it again. The account holder deletes pocket-to-pocket
-- transfers because they mean nothing for the balance, and a full re-sync
-- put them straight back.
--
-- Every delete of a feed row now leaves a tombstone keyed by
-- (source, source_id). sync-revolut, sync-stripe-income and the statement
-- importer skip any id with a tombstone. Deleting a tombstone (not exposed in
-- the UI) is how a row would be let back in.
CREATE TABLE IF NOT EXISTS public.finance_sync_tombstones (
  user_id    uuid NOT NULL,
  source     text NOT NULL,
  source_id  text NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source, source_id)
);

ALTER TABLE public.finance_sync_tombstones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tombstones readable" ON public.finance_sync_tombstones
  FOR SELECT USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.finance_record_tombstone()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.source_id IS NOT NULL AND OLD.source IN ('revolut', 'stripe', 'n26', 'paypal') THEN
    INSERT INTO public.finance_sync_tombstones (user_id, source, source_id)
    VALUES (OLD.user_id, OLD.source, OLD.source_id)
    ON CONFLICT (source, source_id) DO NOTHING;
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS finance_transactions_tombstone ON public.finance_transactions;
CREATE TRIGGER finance_transactions_tombstone
  AFTER DELETE ON public.finance_transactions
  FOR EACH ROW EXECUTE FUNCTION public.finance_record_tombstone();

-- Double-counted money, both sides of moves between the company's own
-- accounts:
--
--   * Stripe payouts landing in Revolut (9 deposits, EUR 11,001.97) were
--     income. The Stripe charges they pay out are already the income; the
--     deposit is the same money arriving. Now transfer, matching the Stripe
--     payout rows, which sync-stripe-income already types as transfer.
--   * The five N26 -> Revolut moves of 24 Jan 2026 (EUR 594): the N26 re-import
--     booked the outgoing side as expense again, and the Revolut side
--     ("Payment from Magdalena Targosz") was income. Both are transfers, as
--     confirmed by the account holder on 25 Sep 2026.
UPDATE public.finance_transactions
SET type = 'transfer'
WHERE source = 'revolut' AND type = 'income'
  AND (counterparty_name ILIKE 'Payment from Stripe%' OR description ILIKE 'Payment from Stripe%');

UPDATE public.finance_transactions
SET type = 'transfer'
WHERE source = 'n26' AND type = 'expense'
  AND counterparty_name = 'SKILL STUDIO AI LIMITED' AND transaction_date = '2026-01-24';

UPDATE public.finance_transactions
SET type = 'transfer'
WHERE source = 'revolut' AND type = 'income'
  AND counterparty_name = 'Payment from Magdalena Targosz'
  AND transaction_date = '2026-01-24';
