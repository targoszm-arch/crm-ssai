-- Tenant-scope the unique indexes that meetalfred-sync upserts against.
--
-- These are all globally unique on a natural key from LinkedIn or Meet Alfred:
--
--   linkedin_connections_linkedin_id_key        (linkedin_id)
--   linkedin_messages_sender_timestamp_key      (sender_linkedin_id, message_timestamp)
--   campaigns_meetalfred_id_key                 (meetalfred_id)
--   leads_email_unique / leads_email_key        (email) where email is not null
--
-- The sync runs with the service role, which bypasses RLS, and now stamps user_id on every
-- write. Together with a global conflict target that is a data-takeover waiting to happen:
-- two accounts syncing the same LinkedIn person would collide on one row, and the upsert
-- would rewrite that row's user_id to whichever synced last — moving another account's
-- record rather than creating one.
--
-- Making the keys composite is what actually makes the ownership stamp safe. It is a no-op
-- for existing data: every row currently belongs to a single owner, so no new duplicates
-- become possible.
--
-- leads carries two identical partial indexes on email; the redundant one is dropped rather
-- than duplicated in composite form.

alter table public.linkedin_connections drop constraint if exists linkedin_connections_linkedin_id_key;
drop index if exists public.linkedin_connections_linkedin_id_key;
create unique index if not exists linkedin_connections_owner_linkedin_id_key
  on public.linkedin_connections (user_id, linkedin_id);

alter table public.linkedin_messages drop constraint if exists linkedin_messages_sender_timestamp_key;
drop index if exists public.linkedin_messages_sender_timestamp_key;
create unique index if not exists linkedin_messages_owner_sender_timestamp_key
  on public.linkedin_messages (user_id, sender_linkedin_id, message_timestamp);

alter table public.campaigns drop constraint if exists campaigns_meetalfred_id_key;
drop index if exists public.campaigns_meetalfred_id_key;
create unique index if not exists campaigns_owner_meetalfred_id_key
  on public.campaigns (user_id, meetalfred_id);

alter table public.leads drop constraint if exists leads_email_key;
drop index if exists public.leads_email_key;
drop index if exists public.leads_email_unique;
create unique index if not exists leads_owner_email_key
  on public.leads (user_id, email) where email is not null;
