-- Per-recipient newsletter engagement, so a newsletter can be opened and read like a
-- sequence rather than being a row in a list.
--
-- CORRECTION to 20260830234500. That migration's comment claims a newsletter "reports a
-- recipient count and a send status and nothing per-person", and the Newsletters tab
-- repeated it as a banner. That is wrong, and it was wrong when written. Content Lab does
-- not send a newsletter as one Resend broadcast; it sends one Resend email PER RECIPIENT,
-- and Resend keeps delivered/opened/clicked/bounced per email. The 3 Aug send has 48
-- unique opens and 20 unique clicks sitting in Resend. It was never true that the data did
-- not exist — the CRM was not looking for it.
--
-- The mirror is still a mirror and Content Lab is still untouched. Engagement comes from
-- RESEND, which is the lifecycle sender in the LMS -> CRM -> Resend chain and is read
-- here, never written. No Content Lab table is read and no CRM-specific code goes into it.

create table if not exists public.newsletter_recipients (
  id                 uuid primary key default gen_random_uuid(),
  newsletter_send_id uuid not null references public.newsletter_sends(id) on delete cascade,
  user_id            uuid references auth.users(id) on delete cascade,

  -- Resend's own email id. The idempotency key for re-syncing.
  resend_email_id    text not null,
  email              text not null,
  recipient_name     text,

  -- Resend's terminal status, not a step in a funnel: 'clicked' already implies opened and
  -- delivered, 'opened' already implies delivered. The aggregates below count it that way.
  status             text,
  sent_at            timestamptz,

  -- The whole point of storing recipients rather than counts: these people are already in
  -- the CRM, so a newsletter open is a contact-level signal and can be segmented on.
  contact_id         uuid references public.contacts(id) on delete set null,

  synced_at          timestamptz not null default now()
);

-- Tenant-scoped, following 20260831004500: a bare unique index on a provider id lets one
-- tenant's row block another's, and the service role writes here.
create unique index if not exists idx_newsletter_recipients_resend
  on public.newsletter_recipients (user_id, resend_email_id);
create index if not exists idx_newsletter_recipients_send
  on public.newsletter_recipients (newsletter_send_id);
create index if not exists idx_newsletter_recipients_contact
  on public.newsletter_recipients (contact_id) where contact_id is not null;
create index if not exists idx_newsletter_recipients_email
  on public.newsletter_recipients (lower(email));

alter table public.newsletter_recipients enable row level security;

drop policy if exists "Users can read own newsletter recipients"  on public.newsletter_recipients;
drop policy if exists "Users can write own newsletter recipients" on public.newsletter_recipients;

create policy "Users can read own newsletter recipients" on public.newsletter_recipients
  for select to authenticated using (auth.uid() = user_id or user_id is null);
create policy "Users can write own newsletter recipients" on public.newsletter_recipients
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- Aggregates cached on the send, so the list can show a rate per row without reading every
-- recipient. Recomputed from newsletter_recipients, never written by hand.
alter table public.newsletter_sends
  add column if not exists delivered_count   integer,
  add column if not exists opened_count      integer,
  add column if not exists clicked_count     integer,
  add column if not exists bounced_count     integer,
  add column if not exists suppressed_count  integer,
  add column if not exists metrics_synced_at timestamptz;

comment on column public.newsletter_sends.opened_count is
  'Unique recipients who opened, from newsletter_recipients. Null means metrics have never been synced for this send, which is not the same as zero opens.';


-- One definition of how a status column becomes counts, so the sync function and anything
-- later cannot each invent their own.
create or replace function public.refresh_newsletter_metrics(p_newsletter_send_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.newsletter_sends s
  set delivered_count  = m.delivered,
      opened_count     = m.opened,
      clicked_count    = m.clicked,
      bounced_count    = m.bounced,
      suppressed_count = m.suppressed,
      metrics_synced_at = now()
  from (
    select
      -- Terminal statuses, so each stage counts the ones past it too.
      count(*) filter (where lower(status) in ('delivered', 'opened', 'clicked')) as delivered,
      count(*) filter (where lower(status) in ('opened', 'clicked'))              as opened,
      count(*) filter (where lower(status) = 'clicked')                           as clicked,
      count(*) filter (where lower(status) = 'bounced')                           as bounced,
      count(*) filter (where lower(status) = 'suppressed')                        as suppressed
    from public.newsletter_recipients
    where newsletter_send_id = p_newsletter_send_id
  ) m
  where s.id = p_newsletter_send_id;
end;
$$;

comment on function public.refresh_newsletter_metrics(uuid) is
  'Recomputes the cached counts on newsletter_sends from newsletter_recipients.';


-- Attach each recipient to the CRM contact they already are, matched on email within the
-- same tenant. Kept as a function rather than a join in the UI because a newsletter open
-- is a contact-level signal: once contact_id is set, these people can be labelled and
-- segmented like any other engagement.
create or replace function public.link_newsletter_recipients_to_contacts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_linked integer;
begin
  with matched as (
    select r.id as recipient_id,
           -- A duplicate email inside one tenant would otherwise make the update
           -- non-deterministic; oldest contact wins, consistently.
           (
             select c.id
             from public.contacts c
             where c.user_id = r.user_id
               and lower(c.email) = lower(r.email)
             order by c.created_at nulls last, c.id
             limit 1
           ) as contact_id
    from public.newsletter_recipients r
    where r.contact_id is null
      and r.user_id is not null
      and coalesce(r.email, '') <> ''
  )
  update public.newsletter_recipients r
  set contact_id = m.contact_id
  from matched m
  where r.id = m.recipient_id
    and m.contact_id is not null;

  get diagnostics v_linked = row_count;
  return v_linked;
end;
$$;

comment on function public.link_newsletter_recipients_to_contacts() is
  'Backfills newsletter_recipients.contact_id by email, scoped to the owning tenant.';
