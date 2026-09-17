-- 153 of 726 Revolut rows read "-" for supplier and "Revolut transaction" for
-- subject. Three separate bugs in sync-revolut, all visible in raw_data:
--
-- 1. The description chain is tx.reference -> tx.description -> merchant.name
--    -> the placeholder. It never reads legs[0].description, which is where
--    Revolut puts the human text for interest, transfers and account charges.
--    All 153 rows have one: "Interest earned - Skill Studio AI Save",
--    "Company Pro plan fee", "To EUR Approved bills".
--
-- 2. counterparty_name is merchant.name ?? counterparty.name. An internal
--    move has neither, so it lands null and the table shows "-".
--
-- 3. mapType falls through to `amount > 0 ? income : expense`. An internal
--    transfer's first leg is negative, so 61 moves between the account
--    holder's own Revolut pockets were booked as EXPENSES totalling
--    EUR 15,948.13. The money never left the business.
--
-- Nothing was lost: raw_data holds the legs. This restores from them. The
-- function itself is fixed in the same change, so it does not recur.

-- A transfer between your own accounts is not income and not expense. Without
-- a fourth value the choice is to mislabel it or to delete it, and deleting a
-- real bank movement makes the balance unexplainable.
ALTER TABLE public.finance_transactions DROP CONSTRAINT IF EXISTS finance_transactions_type_check;
ALTER TABLE public.finance_transactions ADD CONSTRAINT finance_transactions_type_check
  CHECK (type IN ('income', 'expense', 'refund', 'fee', 'transfer'));

UPDATE public.finance_transactions t
SET description = t.raw_data->'legs'->0->>'description',
    subject     = COALESCE(NULLIF(t.subject, 'Revolut transaction'), t.raw_data->'legs'->0->>'description'),
    counterparty_name = COALESCE(t.counterparty_name, t.raw_data->'legs'->0->>'description')
WHERE t.source = 'revolut'
  AND t.description = 'Revolut transaction'
  AND t.raw_data->'legs'->0->>'description' IS NOT NULL;

-- Deliberately narrow: BOTH legs present and NEITHER carrying a counterparty.
-- The ten single-leg transfers DO carry one ("To Magdalena Targosz", an
-- external Revolut account), so they are real payments out and reclassifying
-- them would hide actual spending.
UPDATE public.finance_transactions t
SET type = 'transfer'
WHERE t.source = 'revolut'
  AND t.raw_data->>'revolut_type' = 'transfer'
  AND jsonb_array_length(t.raw_data->'legs') = 2
  AND t.raw_data->'legs'->0->'counterparty' IS NULL
  AND t.raw_data->'legs'->1->'counterparty' IS NULL
  AND t.type <> 'transfer';
