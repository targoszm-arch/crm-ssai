SELECT cron.schedule(
  'sync-leads-apollo-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://getqcxnjsohtlagscmfc.supabase.co/functions/v1/sync-leads-apollo',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdldHFjeG5qc29odGxhZ3NjbWZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NjMyNDksImV4cCI6MjA3NzMzOTI0OX0.pUQXYLcuZXvYpwUPZGmwAcPW_eMf3J7qEtuTQYh-xZs"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);