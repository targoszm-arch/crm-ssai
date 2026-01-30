-- Add unique constraint on leads.email for proper upsert handling
CREATE UNIQUE INDEX IF NOT EXISTS leads_email_unique ON leads (email) WHERE email IS NOT NULL;