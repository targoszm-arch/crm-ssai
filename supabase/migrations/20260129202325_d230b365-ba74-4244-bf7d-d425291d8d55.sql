-- Add new columns to companies table for CSV data import
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS linkedin_url TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS foundation_date DATE;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS twitter_followers INTEGER;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS domains TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS categories TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS connection_strength TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS last_interaction TIMESTAMPTZ;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS estimated_arr NUMERIC;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS funding_raised NUMERIC;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS employee_range TEXT;