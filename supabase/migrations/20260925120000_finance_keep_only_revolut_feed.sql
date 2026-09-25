-- The ledger keeps only what the Revolut Business API returns.
--
-- On the account holder's instruction (25 Sep 2026): every row that did not
-- come from the live Revolut feed is removed — the N26 CSV import (431), the
-- director-paid lines from her personal N26 (19), the Gmail receipt harvest
-- (780) and the receipt log (168). 1,398 rows.
--
-- Nothing is lost outright: every removed row, and any receipt match that
-- referenced one, is copied first into *_backup_20260925. Those tables are
-- the only copy of the 2025 N26 history (the Revolut feed cannot contain it)
-- and of the reconciling and categorising done on those rows. Do not drop
-- them without settling that.
CREATE TABLE public.finance_transactions_backup_20260925 AS
  SELECT * FROM public.finance_transactions
  WHERE NOT (source = 'revolut' AND raw_data->>'imported_from' IS NULL);

CREATE TABLE public.finance_receipt_matches_backup_20260925 AS
  SELECT m.* FROM public.finance_receipt_matches m
  WHERE m.bank_transaction_id IN (SELECT id FROM public.finance_transactions_backup_20260925)
     OR m.receipt_transaction_id IN (SELECT id FROM public.finance_transactions_backup_20260925);

ALTER TABLE public.finance_transactions_backup_20260925 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_receipt_matches_backup_20260925 ENABLE ROW LEVEL SECURITY;

DELETE FROM public.finance_transactions
WHERE id IN (SELECT id FROM public.finance_transactions_backup_20260925);
