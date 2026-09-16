-- Make (source, source_id) a PLAIN unique index instead of a partial one.
--
-- 20260916120000 created it as `... WHERE source_id IS NOT NULL`. That index
-- is unusable as an ON CONFLICT target through PostgREST: supabase-js sends
-- `?on_conflict=source,source_id`, and Postgres will only use a partial index
-- for ON CONFLICT when the statement repeats the index predicate — which
-- PostgREST has no way to express. Every upsert from the browser or from an
-- edge function therefore failed with
--
--   42P10: there is no unique or exclusion constraint matching the
--          ON CONFLICT specification
--
-- which is the 400 the CSV import returned. It would equally have broken
-- sync-stripe-income, sync-revolut and sync-gmail-receipts the moment their
-- secrets were set, since all three upsert on the same pair.
--
-- Dropping the predicate changes nothing that the predicate was protecting:
-- Postgres treats NULLs as distinct in a unique index by default, so manual
-- rows with a NULL source_id remain unconstrained, which is exactly what the
-- WHERE clause was there to allow.

DROP INDEX IF EXISTS public.finance_transactions_source_id_idx;

CREATE UNIQUE INDEX IF NOT EXISTS finance_transactions_source_id_idx
  ON public.finance_transactions (source, source_id);
