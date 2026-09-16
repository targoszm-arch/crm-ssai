-- email_tracking_events could not record which sequence send an event belonged to.
--
-- `email_id` references `emails`, the mailbox-sync table. `resend-webhook` has been
-- writing a `sequence_emails` id into it on every Resend-delivered click, which
-- violates the foreign key; the handler logs insert errors and continues, so those
-- clicks were dropped in silence rather than failing loudly.
--
-- `useSequenceAnalytics` then joins tracking events to sequence emails on that same
-- column, comparing `emails` ids against `sequence_emails` ids. It can never match,
-- which is why the timeline and link-performance panels are empty no matter how many
-- events arrive.
--
-- A separate column, because the two really are different things: `email_id` points at
-- a message in the mailbox, `sequence_email_id` at a send the sequence engine made.
alter table public.email_tracking_events
  add column if not exists sequence_email_id uuid
  references public.sequence_emails(id) on delete cascade;

comment on column public.email_tracking_events.sequence_email_id is
  'The sequence_emails row this event belongs to. Null for events that are not from a '
  'sequence send. Distinct from email_id, which references the emails (mailbox) table.';

-- The analytics hook filters by this column for a whole campaign at a time.
create index if not exists email_tracking_events_sequence_email_id_idx
  on public.email_tracking_events (sequence_email_id)
  where sequence_email_id is not null;
