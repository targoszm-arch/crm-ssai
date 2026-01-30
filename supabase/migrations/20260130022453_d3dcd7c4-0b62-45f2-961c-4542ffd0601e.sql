-- Add linkedin_conversation_url and company_name columns to linkedin_messages
ALTER TABLE linkedin_messages 
ADD COLUMN IF NOT EXISTS linkedin_conversation_url text,
ADD COLUMN IF NOT EXISTS company_name text;

-- Create campaigns table for Meet Alfred campaigns
CREATE TABLE IF NOT EXISTS campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meetalfred_id integer UNIQUE,
  name text NOT NULL,
  type text DEFAULT 'linkedin',
  status text DEFAULT 'active',
  audience text,
  sent_count integer DEFAULT 0,
  open_rate numeric DEFAULT 0,
  conversion_rate numeric DEFAULT 0,
  sequence_type text,
  total_leads integer DEFAULT 0,
  last_synced_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access on campaigns" ON campaigns FOR ALL USING (true) WITH CHECK (true);

-- Create activities table for tracking customer interactions
CREATE TABLE IF NOT EXISTS activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  activity_type text NOT NULL,
  description text,
  source text,
  source_id text,
  metadata jsonb,
  occurred_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activities_contact ON activities(contact_id);
CREATE INDEX IF NOT EXISTS idx_activities_company ON activities(company_id);
CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_activities_occurred ON activities(occurred_at DESC);

ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access on activities" ON activities FOR ALL USING (true) WITH CHECK (true);

-- Create sequences table for email automation templates
CREATE TABLE IF NOT EXISTS sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  trigger_type text NOT NULL,
  status text DEFAULT 'draft',
  steps jsonb NOT NULL DEFAULT '[]',
  from_email text,
  from_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access on sequences" ON sequences FOR ALL USING (true) WITH CHECK (true);

-- Create sequence_enrollments table to track contacts in sequences
CREATE TABLE IF NOT EXISTS sequence_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id uuid REFERENCES sequences(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE,
  current_step integer DEFAULT 0,
  status text DEFAULT 'active',
  enrolled_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  next_email_at timestamptz,
  metadata jsonb
);

CREATE INDEX IF NOT EXISTS idx_enrollments_sequence ON sequence_enrollments(sequence_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_contact ON sequence_enrollments(contact_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON sequence_enrollments(status);
CREATE INDEX IF NOT EXISTS idx_enrollments_next_email ON sequence_enrollments(next_email_at);

ALTER TABLE sequence_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access on sequence_enrollments" ON sequence_enrollments FOR ALL USING (true) WITH CHECK (true);

-- Create sequence_emails table to log sent emails and tracking
CREATE TABLE IF NOT EXISTS sequence_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid REFERENCES sequence_enrollments(id) ON DELETE CASCADE,
  step_number integer,
  subject text,
  body_html text,
  sent_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  bounced_at timestamptz,
  resend_message_id text,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sequence_emails_enrollment ON sequence_emails(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_sequence_emails_resend ON sequence_emails(resend_message_id);

ALTER TABLE sequence_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access on sequence_emails" ON sequence_emails FOR ALL USING (true) WITH CHECK (true);

-- Insert default sequence templates
INSERT INTO sequences (name, description, trigger_type, status, steps) VALUES
('Welcome New Customers', 'Automated welcome sequence for new customers', 'new_customer', 'active', '[
  {"day": 0, "subject": "Welcome to our community!", "template": "welcome_intro"},
  {"day": 3, "subject": "Getting started tips", "template": "welcome_tips"},
  {"day": 7, "subject": "Discover our best features", "template": "welcome_features"},
  {"day": 14, "subject": "How are you finding things?", "template": "welcome_checkin"}
]'),
('Cross-sell / Upsell', 'Promote related products after purchase', 'post_purchase', 'active', '[
  {"day": 3, "subject": "You might also love these...", "template": "upsell_recommendations"},
  {"day": 7, "subject": "Success story: How others use our products", "template": "upsell_case_study"},
  {"day": 14, "subject": "Exclusive offer just for you", "template": "upsell_offer"}
]'),
('Webinar Invitation', 'Drive registrations for upcoming webinars', 'manual', 'draft', '[
  {"day": 0, "subject": "You''re invited: Join our upcoming webinar", "template": "webinar_invite"},
  {"day": 2, "subject": "Reminder: Webinar in 2 days", "template": "webinar_reminder"},
  {"day": 4, "subject": "Starting soon! Join us today", "template": "webinar_today"},
  {"day": 5, "subject": "Recording available: Watch now", "template": "webinar_recording"}
]'),
('Email Course / Training', 'Educational drip content over time', 'signup', 'active', '[
  {"day": 0, "subject": "Lesson 1: Getting Started", "template": "course_lesson1"},
  {"day": 2, "subject": "Lesson 2: Building Your Foundation", "template": "course_lesson2"},
  {"day": 4, "subject": "Lesson 3: Advanced Techniques", "template": "course_lesson3"},
  {"day": 6, "subject": "Lesson 4: Pro Tips & Tricks", "template": "course_lesson4"},
  {"day": 8, "subject": "Congratulations! What''s Next?", "template": "course_graduation"}
]'),
('Content Offer Follow-up', 'Nurture leads after content download', 'content_download', 'active', '[
  {"day": 0, "subject": "Here''s your download", "template": "content_delivery"},
  {"day": 2, "subject": "More resources you''ll find useful", "template": "content_related"},
  {"day": 5, "subject": "How we can help you succeed", "template": "content_intro"},
  {"day": 10, "subject": "Quick question for you", "template": "content_followup"}
]')
ON CONFLICT DO NOTHING;