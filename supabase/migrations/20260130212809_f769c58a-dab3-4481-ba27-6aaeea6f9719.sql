-- Create lms_leads table for LMS integration
CREATE TABLE public.lms_leads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,  -- CRM owner (multi-tenant)
    
    -- LMS user info
    lms_user_id text,  -- External ID from LMS
    full_name text NOT NULL,
    email text NOT NULL,
    role text,
    
    -- Company details from LMS
    company_size text,
    use_case text,
    learning_objectives text,
    
    -- Status fields
    marketing_consent boolean DEFAULT false,
    verified boolean DEFAULT false,
    
    -- Plan & credits
    plan text,
    credits_used integer DEFAULT 0,
    credits_total integer DEFAULT 0,
    
    -- Timestamps
    lms_created_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    
    -- Relationships to CRM entities
    contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
    company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
    
    -- Additional metadata
    raw_payload jsonb,
    source text DEFAULT 'skillstudio',
    
    -- Unique constraint on email per user to prevent duplicates
    CONSTRAINT lms_leads_email_user_unique UNIQUE (email, user_id)
);

-- Indexes for performance
CREATE INDEX idx_lms_leads_user_id ON lms_leads(user_id);
CREATE INDEX idx_lms_leads_email ON lms_leads(email);
CREATE INDEX idx_lms_leads_contact_id ON lms_leads(contact_id);
CREATE INDEX idx_lms_leads_company_id ON lms_leads(company_id);
CREATE INDEX idx_lms_leads_lms_user_id ON lms_leads(lms_user_id);

-- Enable RLS
ALTER TABLE lms_leads ENABLE ROW LEVEL SECURITY;

-- RLS policies (user-scoped)
CREATE POLICY "Users can read own lms_leads"
ON lms_leads FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own lms_leads"
ON lms_leads FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own lms_leads"
ON lms_leads FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own lms_leads"
ON lms_leads FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- Updated at trigger
CREATE TRIGGER update_lms_leads_updated_at
BEFORE UPDATE ON lms_leads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();