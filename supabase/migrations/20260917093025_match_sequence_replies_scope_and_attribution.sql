-- Three corrections to match_sequence_replies(), all found by Codex on PR #46.
-- A follow-up migration rather than an edit to 20260917083104: that one is
-- already applied, and a committed file that no longer matches what ran is how
-- migration history stops being evidence.
--
-- 1. TENANT SCOPE. The function is `security definer`, so it runs with RLS
--    bypassed and the joins were the only thing deciding what it could reach —
--    and they ignored user_id entirely. Two CRM users holding the same external
--    address in their contacts, both sending a subject that matched, and one
--    user's inbound mail would stamp the other's send and link it to an email
--    they cannot otherwise read. One tenant today (1 user, 1 mailbox), so this
--    is latent rather than live, but a security-definer function is exactly
--    where latent cross-tenant reads become real the day a second user exists.
--
--    Scoped on sequence_enrollments.user_id: it is the owner of the send and it
--    is fully populated, where sequence_emails.user_id has a null.
--
-- 2. ONE SEND PER REPLY. The old query partitioned candidates by se.id, so each
--    send independently picked its earliest reply. A single inbound message
--    satisfies `received_at > sent_at` for EVERY earlier send with the same
--    subject, so one reply marked all of them and inflated the totals. Live in
--    shape already: magda@skillstudio.ai has five "Message from us" sends from
--    the Welcome series of 30 Jan 2026, and one reply would have stamped all
--    five.
--
--    Now ranked from the message's side first — an inbound is attributed to the
--    most recent send it could be answering — and only then does each send take
--    its earliest remaining reply.
--
-- 3. Unchanged but restated: matching is contact + normalised subject. See
--    20260917083104 for why not thread_id and why not address alone.

create or replace function public.match_sequence_replies()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  with pairs as (
    select
      se.id         as sequence_email_id,
      m.id          as email_id,
      m.received_at,
      se.sent_at
    from public.sequence_emails se
    join public.sequence_enrollments e on e.id = se.enrollment_id
    join public.contacts c
      on c.id = e.contact_id
     and c.user_id = e.user_id
    join public.emails m
      on m.direction = 'inbound'
     and m.user_id = e.user_id
     and lower(m.from_email) = lower(c.email)
     and m.received_at > se.sent_at
     and public.normalise_email_subject(m.subject)
         = public.normalise_email_subject(se.subject)
    where se.sent_at is not null
      and se.replied_at is null
      and c.email is not null
      and e.user_id is not null
      and c.user_id is not null
      and m.user_id is not null
  ),
  -- Each inbound message answers exactly one send: the most recent one that
  -- preceded it. Without this an old send keeps claiming replies to newer runs
  -- of the same campaign.
  attributed as (
    select *,
           row_number() over (
             partition by email_id order by sent_at desc, sequence_email_id
           ) as send_rank
    from pairs
  ),
  -- Then each send takes the earliest reply attributed to it.
  chosen as (
    select *,
           row_number() over (
             partition by sequence_email_id order by received_at asc, email_id
           ) as reply_rank
    from attributed
    where send_rank = 1
  )
  update public.sequence_emails se
     set replied_at = chosen.received_at,
         replied_email_id = chosen.email_id
    from chosen
   where chosen.sequence_email_id = se.id
     and chosen.reply_rank = 1;

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

comment on function public.match_sequence_replies() is
  'Stamps replied_at on any sent sequence_email whose recipient later sent an '
  'inbound message on the same subject, within one owner. Each inbound message '
  'is attributed to a single send — the most recent one preceding it — so a '
  'repeated campaign cannot count one reply many times. Idempotent: only fills '
  'nulls. Returns the number of rows stamped.';

revoke all on function public.match_sequence_replies() from public;
revoke all on function public.match_sequence_replies() from anon;
grant execute on function public.match_sequence_replies() to service_role;
