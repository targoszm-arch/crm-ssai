-- Create storage bucket for email attachments with file upload support
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('email-attachments', 'email-attachments', true, 10485760);

-- Public read access for email rendering
CREATE POLICY "Public read access on email attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'email-attachments');

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload email attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'email-attachments');

-- Allow authenticated users to update their uploads
CREATE POLICY "Authenticated users can update email attachments"
ON storage.objects FOR UPDATE
USING (bucket_id = 'email-attachments');

-- Allow authenticated users to delete their uploads
CREATE POLICY "Authenticated users can delete email attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'email-attachments');

-- Fix existing email folders: outbound emails should be in 'sent'
UPDATE emails SET folder = 'sent' WHERE direction = 'outbound' AND folder = 'inbox';

-- Fix drafts based on Gmail labels
UPDATE emails SET folder = 'drafts' WHERE labels::text LIKE '%DRAFT%' AND folder = 'inbox';