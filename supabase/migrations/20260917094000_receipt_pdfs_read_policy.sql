-- The receipt-pdfs bucket was created on 16 Sep 2026 with no policies at all.
--
-- storage.objects has RLS on, so "no policy" means no access: the browser
-- could not SELECT a single object, createSignedUrl returned an error, and the
-- viewer sat on a spinner forever. The PDFs were there the whole time — 82 of
-- them, uploaded 17 Sep at 09:04 — because sync-gmail-receipts writes with the
-- service role, which bypasses RLS. Upload worked, reading never could.
--
-- Scoped to the owner's own folder, matching the crm-files policy beside it.
-- Paths are receipts/<user_id>/<gmail_message_id>.pdf, so the uid is the
-- SECOND segment; crm-files puts it first, which is why the index differs.
--
-- SELECT only. These are written by the harvest and never by a person, so
-- granting the browser insert or delete would widen access for no feature.
CREATE POLICY "Users read own receipt pdfs"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'receipt-pdfs'
    AND (storage.foldername(name))[2] = (auth.uid())::text
  );
