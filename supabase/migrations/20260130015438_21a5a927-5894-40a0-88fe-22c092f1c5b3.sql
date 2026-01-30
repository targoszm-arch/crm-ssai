-- Add email signatures table for global signature
CREATE TABLE public.email_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  signature_html text NOT NULL DEFAULT '',
  signature_text text NOT NULL DEFAULT '',
  is_default boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_signatures ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can read their own signatures" 
ON public.email_signatures 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own signatures" 
ON public.email_signatures 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own signatures" 
ON public.email_signatures 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own signatures" 
ON public.email_signatures 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add columns to linkedin_messages for better data from Meet Alfred
ALTER TABLE public.linkedin_messages 
ADD COLUMN IF NOT EXISTS sender_name text,
ADD COLUMN IF NOT EXISTS campaign_name text,
ADD COLUMN IF NOT EXISTS profile_url text;