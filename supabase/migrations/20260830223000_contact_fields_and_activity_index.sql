-- Contact fields, chosen against Apollo's standard contact schema.
--
-- Apollo carries ~80 system fields. Most are B2B-database furniture we are deliberately not
-- rebuilding (six phone variants, education, awards, certifications, email confidence
-- scoring). These are the ones that change what this CRM can actually do.

-- Deliverability. 4,023 contacts have an email address and we know nothing about whether any
-- of them are real. Sending to unverified addresses is how a domain gets burned, which is
-- the exact risk the two-machine rule exists to manage. Apollo: "Primary email status".
alter table contacts add column if not exists email_status          text;
alter table contacts add column if not exists email_last_verified_at timestamptz;

-- Location, structured. Today there is only work_location, which is free text, so "is this
-- person in the EU" — the question that decides the consent basis — is unanswerable by query.
alter table contacts add column if not exists country     text;
alter table contacts add column if not exists city        text;
alter table contacts add column if not exists region      text;
alter table contacts add column if not exists time_zone   text;

-- Send time. Kit's sequences all carry a send hour; a send hour is meaningless without
-- knowing the recipient's zone.

-- Provenance. Right now a contact's origin can only be inferred by joining to leads or
-- activities. Apollo puts it on the record.
alter table contacts add column if not exists source text;

-- Apollo splits the org function out of the job title. We have `function` as free text.
alter table contacts add column if not exists department text;

-- Explicit suppression, separate from marketing_status. marketing_status is one text column
-- doing several jobs at once ('Subscribed', 'No consent', 'Unsubscribed', 'Bounced',
-- 'Archived'); a hard do-not-contact should not be something a status change can silently
-- overwrite. Apollo: is_dnc_listed / call_opted_out.
alter table contacts add column if not exists do_not_contact boolean not null default false;

-- "Started a new role" is the strongest B2B buying signal there is, and buying_signals is
-- currently free text nobody can query.
alter table contacts add column if not exists current_job_start_date date;

-- Completes the social set (facebook_url and instagram_url already exist).
alter table contacts add column if not exists twitter_url text;

comment on column contacts.email_status is
  'Deliverability of the email address: verified | guessed | unavailable | bounced. Null means never checked — treat as unverified, not as safe.';
comment on column contacts.do_not_contact is
  'Hard suppression. Independent of marketing_status so a status change cannot clear it.';
comment on column contacts.source is
  'Where this contact came from: meetalfred, lms, apollo, manual, import.';

create index if not exists idx_contacts_do_not_contact on contacts (do_not_contact) where do_not_contact;
create index if not exists idx_contacts_country        on contacts (country);
create index if not exists idx_contacts_email_status   on contacts (email_status);

-- The contact timeline now reads activities per contact, against 62,783 rows and growing.
create index if not exists idx_activities_contact_occurred
  on activities (contact_id, occurred_at desc);

-- Backfill source from the leads table, which is the only place provenance is recorded.
update contacts c
   set source = 'meetalfred'
  from leads l
 where l.contact_id = c.id
   and c.source is null
   and l.source like 'Meet Alfred%';
