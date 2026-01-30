-- Add folder and labels to emails table
ALTER TABLE emails 
  ADD COLUMN IF NOT EXISTS folder text DEFAULT 'inbox',
  ADD COLUMN IF NOT EXISTS email_labels text,
  ADD COLUMN IF NOT EXISTS is_tracked boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS open_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS click_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS deal_id uuid REFERENCES deals(id),
  ADD COLUMN IF NOT EXISTS has_attachments boolean DEFAULT false;

-- Create email_tracking_events table
CREATE TABLE IF NOT EXISTS email_tracking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id uuid REFERENCES emails(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('open', 'click')),
  link_url text,
  user_agent text,
  ip_address text,
  occurred_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on email_tracking_events
ALTER TABLE email_tracking_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public access on email_tracking_events"
  ON email_tracking_events FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create pipelines table
CREATE TABLE IF NOT EXISTS pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on pipelines
ALTER TABLE pipelines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public access on pipelines"
  ON pipelines FOR ALL
  USING (true)
  WITH CHECK (true);

-- Insert default pipeline
INSERT INTO pipelines (name, is_default) VALUES ('Enterprise Pipeline', true);

-- Create pipeline_stages table
CREATE TABLE IF NOT EXISTS pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid REFERENCES pipelines(id) ON DELETE CASCADE,
  name text NOT NULL,
  position integer NOT NULL,
  color text DEFAULT '#10b981',
  is_won boolean DEFAULT false,
  is_lost boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on pipeline_stages
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public access on pipeline_stages"
  ON pipeline_stages FOR ALL
  USING (true)
  WITH CHECK (true);

-- Insert default stages
INSERT INTO pipeline_stages (pipeline_id, name, position, color, is_won, is_lost) VALUES
  ((SELECT id FROM pipelines WHERE is_default LIMIT 1), 'Marketing Qualified', 0, '#6b7280', false, false),
  ((SELECT id FROM pipelines WHERE is_default LIMIT 1), 'Contact Made', 1, '#6b7280', false, false),
  ((SELECT id FROM pipelines WHERE is_default LIMIT 1), 'Sales Qualified', 2, '#22c55e', false, false),
  ((SELECT id FROM pipelines WHERE is_default LIMIT 1), 'Demo Done', 3, '#22c55e', false, false),
  ((SELECT id FROM pipelines WHERE is_default LIMIT 1), '1st Follow Up', 4, '#f59e0b', false, false),
  ((SELECT id FROM pipelines WHERE is_default LIMIT 1), '2nd Follow Up', 5, '#f59e0b', false, false),
  ((SELECT id FROM pipelines WHERE is_default LIMIT 1), 'Intention to Buy', 6, '#3b82f6', false, false),
  ((SELECT id FROM pipelines WHERE is_default LIMIT 1), 'Closed Won', 7, '#10b981', true, false),
  ((SELECT id FROM pipelines WHERE is_default LIMIT 1), 'Closed Lost', 8, '#ef4444', false, true);

-- Update deals table with new columns
ALTER TABLE deals 
  ADD COLUMN IF NOT EXISTS pipeline_id uuid REFERENCES pipelines(id),
  ADD COLUMN IF NOT EXISTS position integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source_channel text,
  ADD COLUMN IF NOT EXISTS source_channel_id text,
  ADD COLUMN IF NOT EXISTS lead_source text,
  ADD COLUMN IF NOT EXISTS labels text;

-- Set default pipeline for existing deals
UPDATE deals SET pipeline_id = (SELECT id FROM pipelines WHERE is_default LIMIT 1) WHERE pipeline_id IS NULL;

-- Add contact engagement metrics
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS total_emails_sent integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_opens integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_clicks integer DEFAULT 0;