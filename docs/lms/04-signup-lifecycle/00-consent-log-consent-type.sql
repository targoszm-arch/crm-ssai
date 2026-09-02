-- Give marketing_consent_log a consent_type, so a granted row can say WHICH consent.
--
-- WHY. The spec for these webhooks asked for
--   marketing_consent_log.action = 'product_emails_granted_at_signup'
--   marketing_consent_log.action = 'marketing_emails_granted'
--   marketing_consent_log.entity_type = 'user'
-- All three fail on insert. The live CHECK constraints are:
--   action      IN ('consent_requested','consent_granted','consent_denied','consent_revoked')
--   entity_type IN ('profile','contact')
-- so those inserts would throw 23514 and the consent evidence would silently never
-- be written — the exact failure the audit log exists to prevent.
--
-- The constraint is right and the spec's intent is right; what was missing is a column.
-- `action` says what happened, `entity_type` says to whom, and nothing said which
-- consent it was about. Product consent granted at signup and marketing consent granted
-- from an opt-in link are both `consent_granted` against a `profile` and were, until now,
-- indistinguishable in the log.
--
-- Additive and nullable, so every existing row stays valid and the table stays
-- append-only. No CHECK on the new column: gdpr_consents.consent_type has no CHECK
-- either, and the log must be able to record a consent type that state table later drops.

alter table public.marketing_consent_log
  add column if not exists consent_type text;

comment on column public.marketing_consent_log.consent_type is
  'Which consent the action refers to — a bare noun matching gdpr_consents.consent_type (''product'', ''marketing''). Null on rows written before 2026-09-01, which are all marketing.';

-- Rows written before this column existed were all marketing consent: the table was
-- built for the marketing opt-in flow and product consent was never logged.
update public.marketing_consent_log
set consent_type = 'marketing'
where consent_type is null;

-- Reading the evidence for one person is the query a DPA review actually runs.
create index if not exists idx_marketing_consent_log_entity
  on public.marketing_consent_log (entity_id, consent_type, created_at desc);
