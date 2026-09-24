-- Five N26 payments on 2026-01-24 to "SKILL STUDIO AI LIMITED", IBAN
-- IE40REVO99036077821661: the company's own Revolut Business account. That
-- is the day the N26 balance moved to Revolut, so these are money changing
-- accounts, not costs. EUR 594 had been booked as expense.
--
-- 20260917092000 left them as vendor payments because one reference reads
-- "Lovable". The reference is a note on why the money was moved; the payee
-- is still the company itself. Reclassified on the account holder's
-- confirmation, 25 Sep 2026.
UPDATE public.finance_transactions
SET type = 'transfer'
WHERE source = 'n26'
  AND counterparty_name = 'SKILL STUDIO AI LIMITED'
  AND transaction_date = '2026-01-24'
  AND type = 'expense';
