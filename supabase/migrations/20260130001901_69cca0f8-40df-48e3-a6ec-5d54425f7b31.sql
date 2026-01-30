-- Create meeting_notes table for storing Fireflies meeting summaries
CREATE TABLE public.meeting_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  fireflies_meeting_id TEXT UNIQUE,
  title TEXT NOT NULL,
  meeting_date TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_minutes INTEGER,
  participants TEXT[] DEFAULT '{}',
  overview TEXT,
  action_items JSONB DEFAULT '[]',
  summary TEXT,
  bullet_gist TEXT,
  transcript_url TEXT,
  audio_url TEXT,
  meeting_type TEXT,
  raw_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.meeting_notes ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated access
CREATE POLICY "Allow public read access on meeting_notes"
ON public.meeting_notes FOR SELECT
USING (true);

CREATE POLICY "Allow public insert access on meeting_notes"
ON public.meeting_notes FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow public update access on meeting_notes"
ON public.meeting_notes FOR UPDATE
USING (true);

CREATE POLICY "Allow public delete access on meeting_notes"
ON public.meeting_notes FOR DELETE
USING (true);

-- Create index for faster lookups by contact
CREATE INDEX idx_meeting_notes_contact_id ON public.meeting_notes(contact_id);
CREATE INDEX idx_meeting_notes_company_id ON public.meeting_notes(company_id);
CREATE INDEX idx_meeting_notes_meeting_date ON public.meeting_notes(meeting_date DESC);

-- Create trigger for updated_at
CREATE TRIGGER update_meeting_notes_updated_at
BEFORE UPDATE ON public.meeting_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();