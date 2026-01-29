-- Create email_accounts table
CREATE TABLE public.email_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL DEFAULT 'google',
  email_address TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on email_accounts
ALTER TABLE public.email_accounts ENABLE ROW LEVEL SECURITY;

-- RLS policies for email_accounts (public access for now since no auth)
CREATE POLICY "Allow public read access on email_accounts" ON public.email_accounts FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on email_accounts" ON public.email_accounts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on email_accounts" ON public.email_accounts FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access on email_accounts" ON public.email_accounts FOR DELETE USING (true);

-- Create emails table
CREATE TABLE public.emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID REFERENCES public.email_accounts(id) ON DELETE CASCADE,
  gmail_id TEXT NOT NULL,
  thread_id TEXT,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  subject TEXT,
  snippet TEXT,
  body_html TEXT,
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_emails TEXT[],
  received_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_read BOOLEAN DEFAULT false,
  direction TEXT DEFAULT 'inbound',
  labels TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(account_id, gmail_id)
);

-- Enable RLS on emails
ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;

-- RLS policies for emails (public access for now since no auth)
CREATE POLICY "Allow public read access on emails" ON public.emails FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on emails" ON public.emails FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on emails" ON public.emails FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access on emails" ON public.emails FOR DELETE USING (true);

-- Create updated_at trigger for email_accounts
CREATE TRIGGER update_email_accounts_updated_at
BEFORE UPDATE ON public.email_accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create updated_at trigger for emails
CREATE TRIGGER update_emails_updated_at
BEFORE UPDATE ON public.emails
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();