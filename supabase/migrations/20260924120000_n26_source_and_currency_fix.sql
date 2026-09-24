-- N26 becomes a source of its own, and the first N26 import is put right.
--
-- transactions-2026-09-16.csv was an N26 export (N26 Cashback, "Sent from
-- N26", N26 Spaces called "Instant Savings" / "Main Account" / "Bills"),
-- imported through the Revolut picker because the importer offered nothing
-- else. 431 rows, 2025-06-06 to 2026-01-24. The earlier pocket-transfer
-- migration (20260917092000) calls those names Revolut pockets; they are N26
-- Spaces, and its conclusion — that they are transfers — stands either way.
--
-- Two problems, fixed together because they share the same 431 rows:
--
-- 1. Currency, which is money. N26's "Amount (EUR)" is the euro that left the
--    account. The generic column guesser picked up "Original Currency" as the
--    currency, so a USD 100 card payment was stored as 85.47 USD, and
--    sync-fx-rates then converted the 85.47 to euro a second time. 116 rows:
--      USD  74 rows  EUR 3,119.52 recorded as EUR 2,682.50
--      PLN  29 rows  EUR   445.30 recorded as EUR   104.88
--      GBP  13 rows  EUR   516.12 recorded as EUR   591.01
--    amount_cents was right all along; only the label and the derived euro
--    figure were wrong. VAT is zero on every one of these rows, so no VAT
--    figure moves. The wrong label is kept in raw_data.original_currency — it
--    is the card's real currency, just not the currency of this amount.
--
-- 2. Source. Relabelled 'n26', with source_id recomputed on the formula the
--    importer's N26 parser now uses, so re-importing any N26 export is an
--    exact no-op on these rows instead of 299 rows put to a person as
--    possible duplicates (which is what happened on 24 Sep and read as the
--    upload refusing the file).
--
--    id = 'n26_' || first 20 hex of sha1(date|description|abs amount|counterparty)
--    with '|#n' appended for the nth identical line on one day. Rows sharing
--    every one of those fields are interchangeable, so which of them gets #2
--    does not matter.
--
-- Classification, reconciliation and matches are left exactly as they are.

ALTER TABLE public.finance_transactions DROP CONSTRAINT finance_transactions_source_check;
ALTER TABLE public.finance_transactions ADD CONSTRAINT finance_transactions_source_check
  CHECK (source IN ('stripe', 'revolut', 'n26', 'paypal', 'manual', 'gmail', 'receipt_log'));

UPDATE public.finance_transactions
SET currency = 'EUR',
    amount_eur_cents = amount_cents,
    net_cents = amount_cents,
    raw_data = coalesce(raw_data, '{}'::jsonb) || jsonb_build_object('original_currency', currency)
WHERE source = 'revolut'
  AND raw_data->>'imported_from' = 'transactions-2026-09-16.csv'
  AND currency <> 'EUR';

WITH keyed AS (
  SELECT id,
         transaction_date::text
           || '|' || coalesce(nullif(trim(description), ''), '(no description)')
           || '|' || amount_cents::text
           || '|' || coalesce(counterparty_name, '') AS k
  FROM public.finance_transactions
  WHERE source = 'revolut'
    AND raw_data->>'imported_from' = 'transactions-2026-09-16.csv'
), numbered AS (
  SELECT id, k, row_number() OVER (PARTITION BY k ORDER BY id) AS n FROM keyed
)
UPDATE public.finance_transactions t
SET source = 'n26',
    source_id = 'n26_' || left(encode(extensions.digest(
      numbered.k || CASE WHEN numbered.n > 1 THEN '|#' || numbered.n ELSE '' END,
      'sha1'), 'hex'), 20)
FROM numbered
WHERE t.id = numbered.id;
