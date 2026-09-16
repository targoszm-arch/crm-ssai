-- email_tracking_events could only ever hold an open or a click.
--
-- The table is the CRM's email event log, but its check constraint allowed exactly
-- 'open' and 'click'. Anything else -- a bounce, a spam complaint, an unsubscribe --
-- failed the insert. Since resend-webhook logs and swallows insert errors, those
-- events would have vanished with only a line in the function logs to show for it.
--
-- That matters now because the webhook is being taught to record events it cannot tie
-- to a sequence_emails row (the common case for any send composed outside the sequence
-- engine). Content Lab has been doing this since March and stores open, click and
-- unsubscribe in newsletter_events; bounce and complaint are worth keeping here too,
-- because they are what tells you a send is damaging the domain.
--
-- 'sent' and 'delivered' are deliberately NOT allowed. Content Lab skips them and
-- infers delivery from the absence of a bounce; storing one row per recipient per send
-- would swamp the table for a signal nobody reads.

alter table public.email_tracking_events
  drop constraint if exists email_tracking_events_event_type_check;

alter table public.email_tracking_events
  add constraint email_tracking_events_event_type_check
  check (event_type = any (array['open','click','bounce','complaint','unsubscribe']));

comment on column public.email_tracking_events.event_type is
  'open | click | bounce | complaint | unsubscribe. Deliveries are not stored -- absence of a bounce is the delivery signal, same convention as Content Lab''s newsletter_events.';
