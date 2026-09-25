-- Business costs paid personally by the director, Feb – Aug 2025.
--
-- From 2025_txn_n26.csv, an export of her *personal* N26 account (Spaces:
-- Bills, Main Account, Living Expenses, Car and Travel). The file was not
-- imported — 490 household lines do not belong in the books — and the
-- importer now refuses a multi-account file until the company account is
-- ticked. These 19 lines were picked out of it on her instruction
-- (25 Sep 2026): software and memberships the company used.
--
-- Booked as expenses with source 'manual' and raw_data.paid_by = 'director':
-- the company owes her this money back through the director's loan account.
-- Two MeetAlfred charges in the file (21 and 25 May 2025) were left out
-- because their Gmail receipts are already booked; adding them again would
-- count them twice.
--
-- 19 rows, EUR 501.85. Feb – Mar 2025 predate VAT registration (1 Apr 2025);
-- whether they are claimable as pre-trading expenses is the accountant's call.
INSERT INTO public.finance_transactions
  (user_id, source, source_id, type, amount_cents, currency, amount_eur_cents, stripe_fee_cents, net_cents,
   transaction_date, description, subject, counterparty_name, is_reconciled, notes, raw_data)
SELECT (SELECT user_id FROM public.finance_transactions WHERE source = 'n26' LIMIT 1),
       'manual', v.sid, 'expense', v.cents, 'EUR', v.cents, 0, v.cents,
       v.d::date, v.who || ' (paid personally)', v.who || ' (paid personally)', v.who, false,
       'Paid personally by the director from her own N26 account (' || v.acct || '), not the company account. '
         || 'Owed back to her through the director''s loan account.',
       v.raw
FROM (VALUES
  ('director_n26_2025-02-13_1000_fingalchamber', '2025-02-13', 'Fingal Chamber', 1000, 'Bills', jsonb_build_object('imported_from', '2025_txn_n26.csv', 'account_name', 'Bills', 'paid_by', 'director', 'bank_description', 'FINGAL CHAMBER')),
  ('director_n26_2025-02-14_10107_speechify20250212', '2025-02-14', 'Speechify', 10107, 'Bills', jsonb_build_object('imported_from', '2025_txn_n26.csv', 'account_name', 'Bills', 'paid_by', 'director', 'bank_description', 'SPEECHIFY 2025-02-12', 'original_currency', 'USD', 'original_amount', '104.25')),
  ('director_n26_2025-02-19_1428_wwwaicarouselscom', '2025-02-19', 'AICarousels', 1428, 'Bills', jsonb_build_object('imported_from', '2025_txn_n26.csv', 'account_name', 'Bills', 'paid_by', 'director', 'bank_description', 'WWW.AICAROUSELS.COM', 'original_currency', 'USD', 'original_amount', '14.95')),
  ('director_n26_2025-02-20_1107_sqspinv170295891', '2025-02-20', 'Squarespace', 1107, 'Bills', jsonb_build_object('imported_from', '2025_txn_n26.csv', 'account_name', 'Bills', 'paid_by', 'director', 'bank_description', 'SQSP* INV170295891')),
  ('director_n26_2025-02-24_1723_firefliesai', '2025-02-24', 'Fireflies.ai', 1723, 'Bills', jsonb_build_object('imported_from', '2025_txn_n26.csv', 'account_name', 'Bills', 'paid_by', 'director', 'bank_description', 'FIREFLIES.AI', 'original_currency', 'USD', 'original_amount', '18')),
  ('director_n26_2025-03-01_481_firefliesai', '2025-03-01', 'Fireflies.ai', 481, 'Bills', jsonb_build_object('imported_from', '2025_txn_n26.csv', 'account_name', 'Bills', 'paid_by', 'director', 'bank_description', 'FIREFLIES.AI', 'original_currency', 'USD', 'original_amount', '5')),
  ('director_n26_2025-03-21_1375_wwwaicarouselscom', '2025-03-21', 'AICarousels', 1375, 'Bills', jsonb_build_object('imported_from', '2025_txn_n26.csv', 'account_name', 'Bills', 'paid_by', 'director', 'bank_description', 'WWW.AICAROUSELS.COM', 'original_currency', 'USD', 'original_amount', '14.95')),
  ('director_n26_2025-04-19_1319_wwwaicarouselscom', '2025-04-19', 'AICarousels', 1319, 'Bills', jsonb_build_object('imported_from', '2025_txn_n26.csv', 'account_name', 'Bills', 'paid_by', 'director', 'bank_description', 'WWW.AICAROUSELS.COM', 'original_currency', 'USD', 'original_amount', '14.95')),
  ('director_n26_2025-05-19_1342_wwwaicarouselscom', '2025-05-19', 'AICarousels', 1342, 'Bills', jsonb_build_object('imported_from', '2025_txn_n26.csv', 'account_name', 'Bills', 'paid_by', 'director', 'bank_description', 'WWW.AICAROUSELS.COM', 'original_currency', 'USD', 'original_amount', '14.95')),
  ('director_n26_2025-06-13_119_ionosltdrvk17494743', '2025-06-13', 'IONOS', 119, 'Bills', jsonb_build_object('imported_from', '2025_txn_n26.csv', 'account_name', 'Bills', 'paid_by', 'director', 'bank_description', 'IONOS Ltd. RVK17494743', 'original_currency', 'GBP', 'original_amount', '1')),
  ('director_n26_2025-06-20_1303_wwwaicarouselscom', '2025-06-20', 'AICarousels', 1303, 'Bills', jsonb_build_object('imported_from', '2025_txn_n26.csv', 'account_name', 'Bills', 'paid_by', 'director', 'bank_description', 'WWW.AICAROUSELS.COM', 'original_currency', 'USD', 'original_amount', '14.95')),
  ('director_n26_2025-07-20_1291_wwwaicarouselscom', '2025-07-20', 'AICarousels', 1291, 'Bills', jsonb_build_object('imported_from', '2025_txn_n26.csv', 'account_name', 'Bills', 'paid_by', 'director', 'bank_description', 'WWW.AICAROUSELS.COM', 'original_currency', 'USD', 'original_amount', '14.95')),
  ('director_n26_2025-08-09_510_didstudio', '2025-08-09', 'D-ID', 510, 'Car and Travel', jsonb_build_object('imported_from', '2025_txn_n26.csv', 'account_name', 'Car and Travel', 'paid_by', 'director', 'bank_description', 'D-ID STUDIO', 'original_currency', 'USD', 'original_amount', '5.9')),
  ('director_n26_2025-02-01_1636_otterai', '2025-02-01', 'Otter.ai', 1636, 'Living Expenses', jsonb_build_object('imported_from', '2025_txn_n26.csv', 'account_name', 'Living Expenses', 'paid_by', 'director', 'bank_description', 'OTTER.AI', 'original_currency', 'USD', 'original_amount', '16.99')),
  ('director_n26_2025-03-02_1637_otterai', '2025-03-02', 'Otter.ai', 1637, 'Main Account', jsonb_build_object('imported_from', '2025_txn_n26.csv', 'account_name', 'Main Account', 'paid_by', 'director', 'bank_description', 'OTTER.AI', 'original_currency', 'USD', 'original_amount', '16.99')),
  ('director_n26_2025-03-04_1253_otterai', '2025-03-04', 'Otter.ai', 1253, 'Main Account', jsonb_build_object('imported_from', '2025_txn_n26.csv', 'account_name', 'Main Account', 'paid_by', 'director', 'bank_description', 'OTTER.AI', 'original_currency', 'USD', 'original_amount', '13.01')),
  ('director_n26_2025-05-18_11314_projectmanagementins', '2025-05-18', 'Project Management Institute', 11314, 'Main Account', jsonb_build_object('imported_from', '2025_txn_n26.csv', 'account_name', 'Main Account', 'paid_by', 'director', 'bank_description', 'Project Management Ins', 'original_currency', 'USD', 'original_amount', '126')),
  ('director_n26_2025-05-21_10165_linkedinsn610849224', '2025-05-21', 'LinkedIn Sales Navigator', 10165, 'Main Account', jsonb_build_object('imported_from', '2025_txn_n26.csv', 'account_name', 'Main Account', 'paid_by', 'director', 'bank_description', 'LINKEDIN SN *610849224')),
  ('director_n26_2025-06-06_1075_paddlenetaislides', '2025-06-06', 'AI Slides (Paddle)', 1075, 'Main Account', jsonb_build_object('imported_from', '2025_txn_n26.csv', 'account_name', 'Main Account', 'paid_by', 'director', 'bank_description', 'PADDLE.NET* AISLIDES'))
) AS v(sid, d, who, cents, acct, raw)
ON CONFLICT (source, source_id) DO NOTHING;
