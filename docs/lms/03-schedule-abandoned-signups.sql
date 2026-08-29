-- Schedule check-abandoned-signups — run against the LMS project (oxlujbymtjugefaqmwuy).
--
-- Current state (29 Aug 2026): the function is deployed at version 64 and has NEVER sent.
-- 74 signup_sessions sit incomplete with reminder_sent_at null. It has verify_jwt = true
-- and nothing is calling it.
--
-- This keeps verify_jwt = true and calls it from pg_cron with the service role key, rather
-- than opening the endpoint up. The key is read from Vault, never inlined in the job.
--
-- READ THIS BEFORE RUNNING: the first execution emails up to 50 real people who abandoned
-- signup, some of them months ago. Check what the backlog looks like first (query at the
-- bottom), and consider clearing anything older than you're comfortable contacting.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Store the service role key in Vault once. Replace the placeholder, run, then delete the
-- line from your history — do not commit the real key anywhere.
-- select vault.create_secret('<SERVICE_ROLE_KEY>', 'service_role_key', 'For scheduled edge function calls');

select cron.schedule(
  'check-abandoned-signups-hourly',
  '17 * * * *',  -- hourly at :17, off the top of the hour so it isn't queued behind everything else
  $$
  select net.http_post(
    url     := 'https://oxlujbymtjugefaqmwuy.supabase.co/functions/v1/check-abandoned-signups',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- Confirm it registered:
--   select jobname, schedule, active from cron.job;
-- Watch the first few runs:
--   select jobid, status, return_message, start_time from cron.job_run_details
--   where jobid = (select jobid from cron.job where jobname = 'check-abandoned-signups-hourly')
--   order by start_time desc limit 10;
-- Pause it:
--   select cron.unschedule('check-abandoned-signups-hourly');

-- The backlog this will email on first run — look at this BEFORE scheduling:
select
  count(*)                                                as waiting,
  count(*) filter (where created_at > now() - interval '30 days') as last_30_days,
  count(*) filter (where created_at < now() - interval '90 days') as older_than_90_days,
  min(created_at)::date                                   as oldest
from signup_sessions
where completed_at is null and reminder_sent_at is null;

-- To skip the stale ones rather than emailing someone about a signup they abandoned in
-- February, mark them as already reminded (this sends nothing):
--   update signup_sessions set reminder_sent_at = now()
--   where completed_at is null and reminder_sent_at is null
--     and created_at < now() - interval '30 days';
