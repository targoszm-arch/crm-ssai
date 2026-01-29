-- Create calendar_events table
CREATE TABLE public.calendar_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID REFERENCES public.email_accounts(id) ON DELETE CASCADE,
  google_event_id TEXT NOT NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  all_day BOOLEAN DEFAULT false,
  attendees TEXT[] DEFAULT '{}',
  meeting_link TEXT,
  status TEXT DEFAULT 'confirmed',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(account_id, google_event_id)
);

-- Enable RLS
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for public access (matching existing pattern)
CREATE POLICY "Allow public read access on calendar_events" 
ON public.calendar_events 
FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert access on calendar_events" 
ON public.calendar_events 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public update access on calendar_events" 
ON public.calendar_events 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow public delete access on calendar_events" 
ON public.calendar_events 
FOR DELETE 
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_calendar_events_updated_at
BEFORE UPDATE ON public.calendar_events
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_calendar_events_account_id ON public.calendar_events(account_id);
CREATE INDEX idx_calendar_events_start_time ON public.calendar_events(start_time);
CREATE INDEX idx_calendar_events_contact_id ON public.calendar_events(contact_id);