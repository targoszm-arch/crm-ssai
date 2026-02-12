
-- Fix 1: Make email-attachments bucket private
UPDATE storage.buckets SET public = false WHERE id = 'email-attachments';

-- Remove any public read policy on email-attachments
DROP POLICY IF EXISTS "Public read access for email attachments" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view email attachments" ON storage.objects;

-- Ensure user-scoped read policy exists
CREATE POLICY "Users can read own email attachments"
ON storage.objects
FOR SELECT
USING (bucket_id = 'email-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Fix 2: Create a safe view for email_accounts that excludes tokens
CREATE OR REPLACE VIEW public.email_accounts_safe AS
SELECT id, user_id, provider, email_address, expires_at, created_at, updated_at
FROM public.email_accounts;

-- Grant access to the view
GRANT SELECT ON public.email_accounts_safe TO authenticated;
GRANT SELECT ON public.email_accounts_safe TO anon;
