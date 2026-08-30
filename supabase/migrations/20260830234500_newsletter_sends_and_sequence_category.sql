-- Newsletters, and a category to group sequences by.
--
-- Newsletters are NOT sequences and their analytics do not line up. A sequence has
-- per-recipient rows in sequence_emails, so open and click rates are computable. A Content
-- Lab newsletter is a single broadcast: it reports a recipient count and a send status and
-- nothing per-person. Forcing them into the sequence analytics view would mean inventing
-- rates that do not exist, so they get their own table and their own tab.
--
-- On the Content Lab rule: Content Lab is a public product and is not wired to this CRM.
-- This table is a local MIRROR, filled by the CRM PULLING from Content Lab's public API —
-- the same one any other customer would use. Content Lab is not modified, holds no
-- CRM-specific code, and does not push here.

create table if not exists public.newsletter_sends (
  -- Content Lab's own schedule id, so re-syncing updates rather than duplicates.
  id                     uuid primary key,
  user_id                uuid references auth.users(id) on delete cascade,

  content_lab_article_id text,
  subject_line           text,
  preview_text           text,

  audience_type          text,
  audience_id            text,

  scheduled_at           timestamptz,
  sent_at                timestamptz,
  status                 text,
  recipient_count        integer,
  error_message          text,

  -- Everything Content Lab returned, so a later field addition needs no migration.
  raw                    jsonb,
  synced_at              timestamptz not null default now(),
  created_at             timestamptz,
  updated_at             timestamptz
);

create index if not exists idx_newsletter_sends_sent
  on public.newsletter_sends (sent_at desc nulls last);
create index if not exists idx_newsletter_sends_status
  on public.newsletter_sends (status);

alter table public.newsletter_sends enable row level security;

drop policy if exists "Users can read own newsletter sends"   on public.newsletter_sends;
drop policy if exists "Users can write own newsletter sends"  on public.newsletter_sends;

create policy "Users can read own newsletter sends" on public.newsletter_sends
  for select to authenticated using (auth.uid() = user_id or user_id is null);
create policy "Users can write own newsletter sends" on public.newsletter_sends
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- A sequence's category. The analytics page could only ever show one sequence at a time,
-- so when a category has been run more than once there was no way to see the runs together.
alter table public.sequences add column if not exists category text;

comment on column public.sequences.category is
  'Groups sequences that serve the same purpose so repeated runs can be compared. Falls back to trigger_type when unset.';

-- Seed categories from what the sequences already are.
update sequences set category = 'Topic'      where category is null and name ilike 'Topic —%';
update sequences set category = 'Onboarding' where category is null and name in ('Welcome & Nurture', 'Indoctrination');
update sequences set category = 'Sales'      where category is null and name in ('Product Sales Sequence', 'Abandoned Checkout Recovery');
update sequences set category = 'Customer'   where category is null and name in ('Course Welcome & Onboarding', 'Course Completion & Upsell', 'Ask for a Review');
update sequences set category = 'Retention'  where category is null and name = 'Re-engagement';
update sequences set category = coalesce(trigger_type, 'Uncategorised') where category is null;

create index if not exists idx_sequences_category on public.sequences (category);
