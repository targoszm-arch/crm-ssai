-- Add Apollo sync tracking columns to lms_leads
ALTER TABLE public.lms_leads
  ADD COLUMN IF NOT EXISTS apollo_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS apollo_contact_id text;