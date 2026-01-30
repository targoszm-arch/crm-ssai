-- ============================================
-- SECURITY FIX: Add user_id columns and proper RLS policies
-- This migration adds user ownership to all data tables
-- ============================================

-- Step 1: Add user_id column to all data tables that don't have it

-- contacts table
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- companies table  
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- emails table
ALTER TABLE public.emails ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- deals table
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- activities table
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- calendar_events table
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- campaigns table
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- leads table
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- meeting_notes table
ALTER TABLE public.meeting_notes ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- linkedin_connections table
ALTER TABLE public.linkedin_connections ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- linkedin_messages table
ALTER TABLE public.linkedin_messages ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- pipelines table
ALTER TABLE public.pipelines ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- pipeline_stages table
ALTER TABLE public.pipeline_stages ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- sequences table
ALTER TABLE public.sequences ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- sequence_enrollments table
ALTER TABLE public.sequence_enrollments ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- sequence_emails table
ALTER TABLE public.sequence_emails ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- email_templates table
ALTER TABLE public.email_templates ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- email_tracking_events table
ALTER TABLE public.email_tracking_events ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- lists table
ALTER TABLE public.lists ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- tasks table
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- projects table
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- proposals table
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- proposal_items table
ALTER TABLE public.proposal_items ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- invoices table
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- sales_opportunities table
ALTER TABLE public.sales_opportunities ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- project_documents table
ALTER TABLE public.project_documents ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- time_tracking table (user_id column exists but is text type, we need to add a new uuid column)
ALTER TABLE public.time_tracking ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- discovery_responses table
ALTER TABLE public.discovery_responses ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 2: Migrate existing data to first registered user (if any data exists without user_id)
DO $$
DECLARE
  first_user_id uuid;
BEGIN
  -- Get the first registered user's ID
  SELECT id INTO first_user_id FROM auth.users ORDER BY created_at LIMIT 1;
  
  IF first_user_id IS NOT NULL THEN
    -- Update all tables with NULL user_id
    UPDATE public.contacts SET user_id = first_user_id WHERE user_id IS NULL;
    UPDATE public.companies SET user_id = first_user_id WHERE user_id IS NULL;
    UPDATE public.emails SET user_id = first_user_id WHERE user_id IS NULL;
    UPDATE public.deals SET user_id = first_user_id WHERE user_id IS NULL;
    UPDATE public.activities SET user_id = first_user_id WHERE user_id IS NULL;
    UPDATE public.calendar_events SET user_id = first_user_id WHERE user_id IS NULL;
    UPDATE public.campaigns SET user_id = first_user_id WHERE user_id IS NULL;
    UPDATE public.leads SET user_id = first_user_id WHERE user_id IS NULL;
    UPDATE public.meeting_notes SET user_id = first_user_id WHERE user_id IS NULL;
    UPDATE public.linkedin_connections SET user_id = first_user_id WHERE user_id IS NULL;
    UPDATE public.linkedin_messages SET user_id = first_user_id WHERE user_id IS NULL;
    UPDATE public.pipelines SET user_id = first_user_id WHERE user_id IS NULL;
    UPDATE public.pipeline_stages SET user_id = first_user_id WHERE user_id IS NULL;
    UPDATE public.sequences SET user_id = first_user_id WHERE user_id IS NULL;
    UPDATE public.sequence_enrollments SET user_id = first_user_id WHERE user_id IS NULL;
    UPDATE public.sequence_emails SET user_id = first_user_id WHERE user_id IS NULL;
    UPDATE public.email_templates SET user_id = first_user_id WHERE user_id IS NULL;
    UPDATE public.email_tracking_events SET user_id = first_user_id WHERE user_id IS NULL;
    UPDATE public.lists SET user_id = first_user_id WHERE user_id IS NULL;
    UPDATE public.tasks SET user_id = first_user_id WHERE user_id IS NULL;
    UPDATE public.projects SET user_id = first_user_id WHERE user_id IS NULL;
    UPDATE public.proposals SET user_id = first_user_id WHERE user_id IS NULL;
    UPDATE public.proposal_items SET user_id = first_user_id WHERE user_id IS NULL;
    UPDATE public.invoices SET user_id = first_user_id WHERE user_id IS NULL;
    UPDATE public.sales_opportunities SET user_id = first_user_id WHERE user_id IS NULL;
    UPDATE public.project_documents SET user_id = first_user_id WHERE user_id IS NULL;
    UPDATE public.time_tracking SET owner_user_id = first_user_id WHERE owner_user_id IS NULL;
    UPDATE public.discovery_responses SET user_id = first_user_id WHERE user_id IS NULL;
    
    -- Fix email_accounts with hardcoded user_id (cast text to uuid)
    UPDATE public.email_accounts 
    SET user_id = first_user_id 
    WHERE user_id = '00000000-0000-0000-0000-000000000001'::uuid;
  END IF;
END $$;

-- Step 3: Drop all existing permissive policies

-- contacts
DROP POLICY IF EXISTS "Authenticated users can delete contacts" ON public.contacts;
DROP POLICY IF EXISTS "Authenticated users can insert contacts" ON public.contacts;
DROP POLICY IF EXISTS "Authenticated users can read contacts" ON public.contacts;
DROP POLICY IF EXISTS "Authenticated users can update contacts" ON public.contacts;

-- companies
DROP POLICY IF EXISTS "Allow public delete access on companies" ON public.companies;
DROP POLICY IF EXISTS "Allow public insert access on companies" ON public.companies;
DROP POLICY IF EXISTS "Allow public read access on companies" ON public.companies;
DROP POLICY IF EXISTS "Allow public update access on companies" ON public.companies;

-- emails
DROP POLICY IF EXISTS "Allow public delete access on emails" ON public.emails;
DROP POLICY IF EXISTS "Allow public insert access on emails" ON public.emails;
DROP POLICY IF EXISTS "Allow public read access on emails" ON public.emails;
DROP POLICY IF EXISTS "Allow public update access on emails" ON public.emails;

-- email_accounts
DROP POLICY IF EXISTS "Allow public delete access on email_accounts" ON public.email_accounts;
DROP POLICY IF EXISTS "Allow public insert access on email_accounts" ON public.email_accounts;
DROP POLICY IF EXISTS "Allow public read access on email_accounts" ON public.email_accounts;
DROP POLICY IF EXISTS "Allow public update access on email_accounts" ON public.email_accounts;

-- deals
DROP POLICY IF EXISTS "Allow public access on deals" ON public.deals;

-- activities
DROP POLICY IF EXISTS "Allow public access on activities" ON public.activities;

-- calendar_events
DROP POLICY IF EXISTS "Allow public delete access on calendar_events" ON public.calendar_events;
DROP POLICY IF EXISTS "Allow public insert access on calendar_events" ON public.calendar_events;
DROP POLICY IF EXISTS "Allow public read access on calendar_events" ON public.calendar_events;
DROP POLICY IF EXISTS "Allow public update access on calendar_events" ON public.calendar_events;

-- campaigns
DROP POLICY IF EXISTS "Allow public access on campaigns" ON public.campaigns;

-- leads
DROP POLICY IF EXISTS "Allow public delete access on leads" ON public.leads;
DROP POLICY IF EXISTS "Allow public insert access on leads" ON public.leads;
DROP POLICY IF EXISTS "Allow public read access on leads" ON public.leads;
DROP POLICY IF EXISTS "Allow public update access on leads" ON public.leads;

-- meeting_notes
DROP POLICY IF EXISTS "Allow public delete access on meeting_notes" ON public.meeting_notes;
DROP POLICY IF EXISTS "Allow public insert access on meeting_notes" ON public.meeting_notes;
DROP POLICY IF EXISTS "Allow public read access on meeting_notes" ON public.meeting_notes;
DROP POLICY IF EXISTS "Allow public update access on meeting_notes" ON public.meeting_notes;

-- linkedin_connections
DROP POLICY IF EXISTS "Allow public access on linkedin_connections" ON public.linkedin_connections;

-- linkedin_messages
DROP POLICY IF EXISTS "Allow public access on linkedin_messages" ON public.linkedin_messages;

-- linkedin_accounts
DROP POLICY IF EXISTS "Allow public access on linkedin_accounts" ON public.linkedin_accounts;

-- pipelines
DROP POLICY IF EXISTS "Allow public access on pipelines" ON public.pipelines;

-- pipeline_stages
DROP POLICY IF EXISTS "Allow public access on pipeline_stages" ON public.pipeline_stages;

-- sequences
DROP POLICY IF EXISTS "Allow public access on sequences" ON public.sequences;

-- sequence_enrollments
DROP POLICY IF EXISTS "Allow public access on sequence_enrollments" ON public.sequence_enrollments;

-- sequence_emails
DROP POLICY IF EXISTS "Allow public access on sequence_emails" ON public.sequence_emails;

-- email_templates
DROP POLICY IF EXISTS "Allow public delete access on email_templates" ON public.email_templates;
DROP POLICY IF EXISTS "Allow public insert access on email_templates" ON public.email_templates;
DROP POLICY IF EXISTS "Allow public read access on email_templates" ON public.email_templates;
DROP POLICY IF EXISTS "Allow public update access on email_templates" ON public.email_templates;

-- email_tracking_events
DROP POLICY IF EXISTS "Allow public access on email_tracking_events" ON public.email_tracking_events;

-- lists
DROP POLICY IF EXISTS "Allow public access on lists" ON public.lists;

-- tasks
DROP POLICY IF EXISTS "Allow public access on tasks" ON public.tasks;

-- projects
DROP POLICY IF EXISTS "Allow public access on projects" ON public.projects;

-- proposals
DROP POLICY IF EXISTS "Allow public access on proposals" ON public.proposals;

-- proposal_items
DROP POLICY IF EXISTS "Authenticated users can delete proposal_items" ON public.proposal_items;
DROP POLICY IF EXISTS "Authenticated users can insert proposal_items" ON public.proposal_items;
DROP POLICY IF EXISTS "Authenticated users can read proposal_items" ON public.proposal_items;
DROP POLICY IF EXISTS "Authenticated users can update proposal_items" ON public.proposal_items;

-- invoices
DROP POLICY IF EXISTS "Allow public access on invoices" ON public.invoices;

-- sales_opportunities
DROP POLICY IF EXISTS "Allow public access on sales_opportunities" ON public.sales_opportunities;

-- project_documents
DROP POLICY IF EXISTS "Allow public access on project_documents" ON public.project_documents;

-- time_tracking
DROP POLICY IF EXISTS "Allow public access on time_tracking" ON public.time_tracking;

-- discovery_responses
DROP POLICY IF EXISTS "Allow public delete access on discovery_responses" ON public.discovery_responses;
DROP POLICY IF EXISTS "Allow public insert access on discovery_responses" ON public.discovery_responses;
DROP POLICY IF EXISTS "Allow public read access on discovery_responses" ON public.discovery_responses;
DROP POLICY IF EXISTS "Allow public update access on discovery_responses" ON public.discovery_responses;

-- Step 4: Create user-scoped RLS policies for all tables

-- contacts
CREATE POLICY "Users can read own contacts" ON public.contacts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own contacts" ON public.contacts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own contacts" ON public.contacts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own contacts" ON public.contacts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- companies
CREATE POLICY "Users can read own companies" ON public.companies FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own companies" ON public.companies FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own companies" ON public.companies FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own companies" ON public.companies FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- emails
CREATE POLICY "Users can read own emails" ON public.emails FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own emails" ON public.emails FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own emails" ON public.emails FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own emails" ON public.emails FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- email_accounts (sensitive - contains OAuth tokens)
CREATE POLICY "Users can read own email_accounts" ON public.email_accounts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own email_accounts" ON public.email_accounts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own email_accounts" ON public.email_accounts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own email_accounts" ON public.email_accounts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- deals
CREATE POLICY "Users can read own deals" ON public.deals FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own deals" ON public.deals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own deals" ON public.deals FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own deals" ON public.deals FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- activities
CREATE POLICY "Users can read own activities" ON public.activities FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own activities" ON public.activities FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own activities" ON public.activities FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own activities" ON public.activities FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- calendar_events
CREATE POLICY "Users can read own calendar_events" ON public.calendar_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own calendar_events" ON public.calendar_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own calendar_events" ON public.calendar_events FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own calendar_events" ON public.calendar_events FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- campaigns
CREATE POLICY "Users can read own campaigns" ON public.campaigns FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own campaigns" ON public.campaigns FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own campaigns" ON public.campaigns FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own campaigns" ON public.campaigns FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- leads
CREATE POLICY "Users can read own leads" ON public.leads FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own leads" ON public.leads FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own leads" ON public.leads FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own leads" ON public.leads FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- meeting_notes
CREATE POLICY "Users can read own meeting_notes" ON public.meeting_notes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own meeting_notes" ON public.meeting_notes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own meeting_notes" ON public.meeting_notes FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own meeting_notes" ON public.meeting_notes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- linkedin_connections
CREATE POLICY "Users can read own linkedin_connections" ON public.linkedin_connections FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own linkedin_connections" ON public.linkedin_connections FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own linkedin_connections" ON public.linkedin_connections FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own linkedin_connections" ON public.linkedin_connections FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- linkedin_messages
CREATE POLICY "Users can read own linkedin_messages" ON public.linkedin_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own linkedin_messages" ON public.linkedin_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own linkedin_messages" ON public.linkedin_messages FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own linkedin_messages" ON public.linkedin_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- linkedin_accounts
CREATE POLICY "Users can read own linkedin_accounts" ON public.linkedin_accounts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own linkedin_accounts" ON public.linkedin_accounts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own linkedin_accounts" ON public.linkedin_accounts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own linkedin_accounts" ON public.linkedin_accounts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- pipelines
CREATE POLICY "Users can read own pipelines" ON public.pipelines FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own pipelines" ON public.pipelines FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own pipelines" ON public.pipelines FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own pipelines" ON public.pipelines FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- pipeline_stages
CREATE POLICY "Users can read own pipeline_stages" ON public.pipeline_stages FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own pipeline_stages" ON public.pipeline_stages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own pipeline_stages" ON public.pipeline_stages FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own pipeline_stages" ON public.pipeline_stages FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- sequences
CREATE POLICY "Users can read own sequences" ON public.sequences FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sequences" ON public.sequences FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sequences" ON public.sequences FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own sequences" ON public.sequences FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- sequence_enrollments
CREATE POLICY "Users can read own sequence_enrollments" ON public.sequence_enrollments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sequence_enrollments" ON public.sequence_enrollments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sequence_enrollments" ON public.sequence_enrollments FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own sequence_enrollments" ON public.sequence_enrollments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- sequence_emails
CREATE POLICY "Users can read own sequence_emails" ON public.sequence_emails FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sequence_emails" ON public.sequence_emails FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sequence_emails" ON public.sequence_emails FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own sequence_emails" ON public.sequence_emails FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- email_templates
CREATE POLICY "Users can read own email_templates" ON public.email_templates FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own email_templates" ON public.email_templates FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own email_templates" ON public.email_templates FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own email_templates" ON public.email_templates FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- email_tracking_events
CREATE POLICY "Users can read own email_tracking_events" ON public.email_tracking_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own email_tracking_events" ON public.email_tracking_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own email_tracking_events" ON public.email_tracking_events FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own email_tracking_events" ON public.email_tracking_events FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- lists
CREATE POLICY "Users can read own lists" ON public.lists FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own lists" ON public.lists FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own lists" ON public.lists FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own lists" ON public.lists FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- tasks
CREATE POLICY "Users can read own tasks" ON public.tasks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tasks" ON public.tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tasks" ON public.tasks FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tasks" ON public.tasks FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- projects
CREATE POLICY "Users can read own projects" ON public.projects FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own projects" ON public.projects FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON public.projects FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects" ON public.projects FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- proposals
CREATE POLICY "Users can read own proposals" ON public.proposals FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own proposals" ON public.proposals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own proposals" ON public.proposals FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own proposals" ON public.proposals FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- proposal_items
CREATE POLICY "Users can read own proposal_items" ON public.proposal_items FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own proposal_items" ON public.proposal_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own proposal_items" ON public.proposal_items FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own proposal_items" ON public.proposal_items FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- invoices
CREATE POLICY "Users can read own invoices" ON public.invoices FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own invoices" ON public.invoices FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own invoices" ON public.invoices FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own invoices" ON public.invoices FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- sales_opportunities
CREATE POLICY "Users can read own sales_opportunities" ON public.sales_opportunities FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sales_opportunities" ON public.sales_opportunities FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sales_opportunities" ON public.sales_opportunities FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own sales_opportunities" ON public.sales_opportunities FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- project_documents
CREATE POLICY "Users can read own project_documents" ON public.project_documents FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own project_documents" ON public.project_documents FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own project_documents" ON public.project_documents FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own project_documents" ON public.project_documents FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- time_tracking (uses owner_user_id instead of user_id due to existing text column)
CREATE POLICY "Users can read own time_tracking" ON public.time_tracking FOR SELECT TO authenticated USING (auth.uid() = owner_user_id);
CREATE POLICY "Users can insert own time_tracking" ON public.time_tracking FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_user_id);
CREATE POLICY "Users can update own time_tracking" ON public.time_tracking FOR UPDATE TO authenticated USING (auth.uid() = owner_user_id);
CREATE POLICY "Users can delete own time_tracking" ON public.time_tracking FOR DELETE TO authenticated USING (auth.uid() = owner_user_id);

-- discovery_responses
CREATE POLICY "Users can read own discovery_responses" ON public.discovery_responses FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own discovery_responses" ON public.discovery_responses FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own discovery_responses" ON public.discovery_responses FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own discovery_responses" ON public.discovery_responses FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Step 5: Create indexes on user_id columns for performance
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON public.contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_companies_user_id ON public.companies(user_id);
CREATE INDEX IF NOT EXISTS idx_emails_user_id ON public.emails(user_id);
CREATE INDEX IF NOT EXISTS idx_deals_user_id ON public.deals(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_user_id ON public.activities(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON public.calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON public.campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON public.leads(user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_notes_user_id ON public.meeting_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_connections_user_id ON public.linkedin_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_messages_user_id ON public.linkedin_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_pipelines_user_id ON public.pipelines(user_id);
CREATE INDEX IF NOT EXISTS idx_sequences_user_id ON public.sequences(user_id);
CREATE INDEX IF NOT EXISTS idx_lists_user_id ON public.lists(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON public.tasks(user_id);