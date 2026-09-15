-- A nightly CRM -> Peak Focus push, created DISABLED.
--
-- WHY DISABLED. The push has still never run. Its dry run says 3 inserts, 8 updates and
-- one exclusion, which is a reviewable change -- but a recurring job that overwrites
-- another system's client roster should not be switched on in the same breath as being
-- written. Run the first push by hand, read peak_focus_push_runs.report, and only then
-- enable this. The last line of this file is the one command that does it.
--
-- WHY NOT THE ANON KEY, which is how the other two cron jobs here authenticate. Those call
-- functions with verify_jwt = false. push-peak-focus is verify_jwt = true and calls
-- auth.getUser(), and an anon key resolves to no user -- a cron built the same way would
-- 401 every night and the only evidence would be an ok = false row nobody reads. So it
-- presents PEAK_FOCUS_PUSH_KEY instead, and the function treats that as the scheduler.
--
-- WHY VAULT. The existing jobs carry their key inline in cron.job.command, which is fine
-- for the anon key because that key is public. PEAK_FOCUS_PUSH_KEY is not, and
-- cron.job.command is plain text in a table. Vault keeps it encrypted at rest and the job
-- reads it at fire time.
--
-- 06:00 UTC, not 09:00: meetalfred-daily-sync already holds 09:00, and there is no reason
-- for the two to contend.

-- Before enabling, both of these must exist:
--
--   1. The Function secrets on this project:
--        supabase secrets set PEAK_FOCUS_SERVICE_ROLE_KEY=<peak focus service_role key> \
--          --project-ref getqcxnjsohtlagscmfc
--        supabase secrets set PEAK_FOCUS_PUSH_KEY=<a long random string> \
--          --project-ref getqcxnjsohtlagscmfc
--
--   2. The same push key in Vault, so this job can send it:
--        select vault.create_secret('<the same long random string>', 'peak_focus_push_key');

do $$
declare
  v_jobid bigint;
begin
  v_jobid := cron.schedule(
    'peak-focus-daily-push',
    '0 6 * * *',
    $job$
    select net.http_post(
      url := 'https://getqcxnjsohtlagscmfc.supabase.co/functions/v1/push-peak-focus',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        -- Null when the Vault secret is absent, which the function rejects as
        -- unauthenticated. Failing shut is the right shape: a push that cannot prove who
        -- it is must not run.
        'x-api-key', (select decrypted_secret from vault.decrypted_secrets
                      where name = 'peak_focus_push_key')
      ),
      -- The whole point. Without this the nightly job would dry-run forever and look
      -- healthy while syncing nothing -- the same failure mode as the inbound mirror that
      -- never ran.
      body := '{"dry_run": false}'::jsonb
    );
    $job$
  );

  -- Created asleep. cron.job is not directly writable by the migration role, so
  -- `update cron.job set active = false` fails with "permission denied for table job";
  -- alter_job is the supported way in.
  perform cron.alter_job(v_jobid, active := false);
end
$$;

-- To turn it on, once the first manual push has been reviewed:
--   select cron.alter_job(
--     (select jobid from cron.job where jobname = 'peak-focus-daily-push'),
--     active := true);
