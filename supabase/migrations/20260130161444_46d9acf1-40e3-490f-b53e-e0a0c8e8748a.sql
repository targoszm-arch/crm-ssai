-- Add tracking columns to sequence_emails
ALTER TABLE sequence_emails 
ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS bounce_type TEXT,
ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS spam_reported_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS unique_opens INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_opens INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS unique_clicks INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_clicks INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS link_url TEXT;

-- Fix double-encoded steps in sequences table
UPDATE sequences 
SET steps = (steps #>> '{}')::jsonb
WHERE jsonb_typeof(steps) = 'string';