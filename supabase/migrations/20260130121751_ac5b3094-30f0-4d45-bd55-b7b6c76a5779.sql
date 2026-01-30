-- Enable pg_cron and pg_net extensions for scheduled HTTP calls
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Grant usage to postgres role (required for pg_cron)
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Schedule daily MeetAlfred sync at 9:00 AM UTC
SELECT cron.schedule(
  'meetalfred-daily-sync',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://getqcxnjsohtlagscmfc.supabase.co/functions/v1/meetalfred-sync',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdldHFjeG5qc29odGxhZ3NjbWZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NjMyNDksImV4cCI6MjA3NzMzOTI0OX0.pUQXYLcuZXvYpwUPZGmwAcPW_eMf3J7qEtuTQYh-xZs"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);