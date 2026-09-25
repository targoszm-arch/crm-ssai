-- Eight more Gmail rows that are not expenses, confirmed by the account
-- holder on 25 Sep 2026: EUR 215,220 the harvester read out of emails that
-- were never purchases. Same treatment as the EUR 457,549 excluded earlier
-- the same day: EXCLUDED_MISPARSED, kept for the audit trail, out of every
-- total (isExcludedFromAccounts).
--
--   Revolut "update to your Instant Access Savings Terms"   EUR 100,000
--   "Seedcorn - Congratulations!" and its forward           EUR 50,000 x 2
--   "Phase 1 - Module 1 pilot + invoice" (her own invoice)  EUR 5,000
--   "Your avatar is ready!" and its reply                   EUR 3,500 + 2,500
--   Revolut Business "We're updating our Business T&Cs"     EUR 3,500
--   CIPD "What Will You Invest in This Autumn?"             EUR 720
--
-- sync-gmail-receipts v16 no longer books amounts from mail like this.
UPDATE public.finance_transactions
SET accounting_category = 'EXCLUDED_MISPARSED',
    notes = coalesce(notes || ' | ', '')
      || '[25 Sep 2026]: Excluded from P&L — not an expense. Gmail ingestion took a number out of a '
      || 'non-receipt email; confirmed by the account holder. Kept for the audit trail.'
WHERE source = 'gmail'
  AND id IN (
    '0af2b31a-6d0d-493e-b39d-3f4280e3f5f1',
    '20607858-421f-4ac7-9064-1bcb62e342f6',
    '4121c274-7c5e-43f2-8a80-def580bbf490',
    '1f9f6f27-f3ce-476f-9d54-754aa10f6bbc',
    '46dd8959-8755-4141-8319-092846bdd60d',
    'cf40c54a-da10-478f-bb92-671fe08614db',
    '2ed7001f-d6ef-43f6-be82-0f5b70c1330e',
    'a452f571-4992-4dd0-bd90-46334ef93036'
  )
  AND coalesce(accounting_category, '') NOT LIKE 'EXCLUDED%';
