-- Where a sequence came from, so an import can be re-run, audited, and bulk-pruned.
--
-- Context: the Kit account holds 47 sequences. Most are Kit's own starter library — ramen
-- lessons, veggie burgers, "A Crash Course in Costumes", "WFH Productivity Mastery" — not
-- Skill Studio's. Importing them without recording which is which would leave 47
-- indistinguishable drafts to sort through one at a time.
--
-- source_note carries the classification and the reason for it, so the stock ones can be
-- deleted in a single statement:
--   delete from sequences where source = 'kit_import' and source_note like 'STOCK%';

alter table public.sequences
  add column if not exists kit_sequence_id bigint,
  add column if not exists source          text,
  add column if not exists source_note     text;

comment on column public.sequences.kit_sequence_id is
  'Kit''s own sequence id. The idempotency key for re-importing from Kit.';
comment on column public.sequences.source is
  'Where this sequence came from: kit_import, authored, or null for pre-existing.';
comment on column public.sequences.source_note is
  'Classification and reasoning — in particular whether this is Kit''s starter-library content rather than Skill Studio''s.';

-- Tenant-scoped, per the lesson from 20260831004500: a bare unique index on a provider id
-- lets one tenant's row block another's.
create unique index if not exists idx_sequences_kit_import
  on public.sequences (user_id, kit_sequence_id)
  where kit_sequence_id is not null;

alter table public.email_templates
  add column if not exists kit_email_id bigint,
  add column if not exists source       text;

comment on column public.email_templates.kit_email_id is
  'Kit''s own sequence-email id, so a later pass can fill body_html from Kit without duplicating rows.';

create unique index if not exists idx_email_templates_kit_email
  on public.email_templates (user_id, kit_email_id)
  where kit_email_id is not null;

-- NOTE ON THE DATA. The import itself (47 sequences, 69 email templates) was applied
-- directly rather than committed here, because it is account-specific data keyed to one
-- Kit workspace, not schema. It is fully auditable from the data: every imported row
-- carries kit_sequence_id / kit_email_id, so what came from Kit and what did not is a
-- query, not a guess. Bodies were deliberately NOT carried over — Kit's are its own demo
-- copy wrapped in Kit's markup — and kit_email_id is what a later body-fill pass would
-- join on.
