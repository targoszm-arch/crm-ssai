-- The second population of pocket transfers.
--
-- The previous migration caught the ones synced from the Revolut API, which
-- prove themselves structurally: two legs, -6000 out of one account_id and
-- +6000 into another, no counterparty anywhere. 61 rows, EUR 15,948.
--
-- These came from the CSV import instead and have no raw_data at all, so there
-- is no structure to read. What identifies them is the counterparty: "Instant
-- Savings", "Bills" and "Main Account" are Revolut pocket names, not
-- suppliers, confirmed by the account holder. 118 rows, EUR 22,898 — booked
-- as EUR 15,950 of income and EUR 6,848 of expense that never entered or left
-- the business.
--
-- Mirror-pairing was tried first and rejected: matching an outgoing row to an
-- incoming one of the same amount within a day found four pairs, and on
-- inspection they were amount collisions between unrelated vendors rather than
-- transfers. Without raw_data there is no structural evidence, so the name is
-- the evidence, and the exclusions below are what keep that honest.
--
-- Two deliberate exclusions:
--
--   * Rows carrying a reference. One EUR 30 credit to Instant Savings says
--     "Front end developer", which reads like an actual payment that happened
--     to land in that pocket. Reclassifying it would hide EUR 30 of real
--     activity to tidy up a list, so it is left for a person.
--
--   * "SKILL STUDIO AI LIMITED", 5 rows, EUR 594. The name is hers, but the
--     descriptions are "Lovable" and "Sent from N26" — real vendor payments
--     where the counterparty column caught the paying company instead of the
--     payee. Not transfers.
UPDATE public.finance_transactions
SET type = 'transfer'
WHERE source = 'revolut'
  AND counterparty_name IN ('Instant Savings', 'Bills', 'Main Account')
  AND description = '(no description)'
  AND type IN ('income', 'expense');
