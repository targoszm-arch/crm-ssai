-- 323 Gmail receipts re-harvested by "Refresh all" an hour after the ledger
-- was cleared down to the Revolut feed (20260925120000). Removed again on the
-- account holder's instruction, into the same backup tables; Refresh all no
-- longer runs the Gmail harvest.
INSERT INTO public.finance_transactions_backup_20260925
  SELECT * FROM public.finance_transactions WHERE source = 'gmail';

INSERT INTO public.finance_receipt_matches_backup_20260925
  SELECT m.* FROM public.finance_receipt_matches m
  JOIN public.finance_transactions t ON t.id IN (m.bank_transaction_id, m.receipt_transaction_id)
  WHERE t.source = 'gmail';

DELETE FROM public.finance_transactions WHERE source = 'gmail';
