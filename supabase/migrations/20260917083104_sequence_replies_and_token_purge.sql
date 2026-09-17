-- Two fixes to the same thing: making sequence analytics tell the truth.
--
-- 1. A reply is the outcome the trial-nudge copy actually asks for — it ends
--    "Reply to this email with one document" and "Reply 'stop' and I'll take
--    you off the list". Three people replied to the 16 Sep send and the app
--    had nowhere to show it, because sequence_emails has no reply column and
--    Resend cannot supply one: it is a send-only ESP and replies land in the
--    connected Gmail mailbox, not in a webhook.
--
-- 2. email_tracking_events.link_url has been storing live Supabase auth
--    tokens. See the purge at the bottom.

-- ---------------------------------------------------------------------------
-- 1. Replies
-- ---------------------------------------------------------------------------

alter table public.sequence_emails
  add column if not exists replied_at timestamptz,
  add column if not exists replied_email_id uuid references public.emails(id) on delete set null;

comment on column public.sequence_emails.replied_at is
  'When the recipient replied to this send, detected from synced inbound mail. '
  'Null means no reply found, which is not the same as no reply: it also reads '
  'null when Gmail sync has not run or the mailbox is not connected.';

comment on column public.sequence_emails.replied_email_id is
  'The inbound emails row the reply was found in, so the UI can open the actual '
  'message rather than just assert that one exists.';

create index if not exists sequence_emails_replied_at_idx
  on public.sequence_emails (replied_at)
  where replied_at is not null;

-- Strip any number of reply/forward prefixes so "Re: Re: Fwd: Subject" compares
-- equal to "Subject". Deliberately not a plain ILIKE '%subject%': a subject like
-- "Infographics" would then match a send titled "Infographics for your course".
create or replace function public.normalise_email_subject(subject text)
returns text
language sql
immutable
as $$
  select nullif(
    btrim(
      regexp_replace(
        lower(coalesce(subject, '')),
        '^(\s*(re|aw|sv|fwd|fw|vs)\s*(\[\d+\])?\s*:\s*)+',
        '',
        'i'
      )
    ),
    ''
  );
$$;

comment on function public.normalise_email_subject(text) is
  'Lowercased subject with every leading Re:/Fwd:/AW:/SV: prefix removed, for '
  'matching a reply to the message it replies to.';

-- Why subject and not thread_id: the send goes out through Resend, so there is
-- no outbound Gmail message and therefore no thread to join on. Both reply
-- threads in the mailbox on 17 Sep 2026 contained the inbound message ONLY.
-- Subject is what is actually available, and it is precise here because the
-- reply carries "Re: " + the exact subject line the sequence sent.
--
-- This correctness matters: matching on "any inbound mail from this contact
-- after we sent" would have counted an unrelated ongoing thread ("Re:
-- Infographics", a live client conversation) as a campaign reply, reporting 3
-- replies where there are 2.
create or replace function public.match_sequence_replies()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  with candidate as (
    select
      se.id as sequence_email_id,
      m.id  as email_id,
      m.received_at,
      row_number() over (
        partition by se.id order by m.received_at asc
      ) as rn
    from public.sequence_emails se
    join public.sequence_enrollments e on e.id = se.enrollment_id
    join public.contacts c on c.id = e.contact_id
    join public.emails m
      on m.direction = 'inbound'
     and lower(m.from_email) = lower(c.email)
     and m.received_at > se.sent_at
     and public.normalise_email_subject(m.subject)
         = public.normalise_email_subject(se.subject)
    where se.sent_at is not null
      and se.replied_at is null
      and c.email is not null
  )
  update public.sequence_emails se
     set replied_at = candidate.received_at,
         replied_email_id = candidate.email_id
    from candidate
   where candidate.sequence_email_id = se.id
     and candidate.rn = 1;

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

comment on function public.match_sequence_replies() is
  'Stamps replied_at on any sent sequence_email whose recipient later sent an '
  'inbound message on the same subject. Idempotent — only fills nulls, so it is '
  'safe to call on every mail sync. Returns the number of rows stamped.';

revoke all on function public.match_sequence_replies() from public;
revoke all on function public.match_sequence_replies() from anon;
grant execute on function public.match_sequence_replies() to service_role;

-- Backfill everything already in the mailbox.
select public.match_sequence_replies();

-- ---------------------------------------------------------------------------
-- 2. Purge auth tokens captured from another product's mail
-- ---------------------------------------------------------------------------
--
-- resend-webhook falls back to matching an event by RECIPIENT when the Resend
-- message id matches no sequence_email. Content Lab sends its Supabase Auth
-- mail through the same Resend account, from team@skillstudio.ai — the same
-- domain the CRM sends campaigns from, so nothing separated them. Every click
-- on a Content Lab magic link therefore landed here, and link_url stored the
-- URL verbatim:
--
--   .../auth/v1/verify?token=<single-use sign-in credential>&type=magiclink
--
-- That is a credential for a different product sitting in this database, and
-- two of them were additionally mis-attributed to a CRM send. The webhook gate
-- that stops new ones is in the function change alongside this migration; this
-- clears what is already stored.
--
-- Rows are deleted rather than redacted: they are not this CRM's events at all,
-- so redacting the URL would leave a click on a campaign that never happened
-- and overstate the click column.
delete from public.email_tracking_events
where link_url ~* '/auth/v1/(verify|confirm)\?'
   or link_url ~* '[?&]token(_hash)?=';

-- Deliberately NOT resetting sequence_emails click counters here. The fallback
-- path only ever inserted a tracking event; it never advanced clicked_at,
-- unique_clicks or total_clicks, so no send is claiming a click it did not get.
-- Checked before writing this: the single row in the table carrying a
-- clicked_at is the Welcome series send of 30 Jan 2026, whose click predates
-- email_tracking_events entirely and has no event row to back it. A
-- "reset any clicked_at with no matching event" sweep would have erased it.
