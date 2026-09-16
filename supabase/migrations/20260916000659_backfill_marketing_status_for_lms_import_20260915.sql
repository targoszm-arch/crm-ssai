-- The 227 contacts imported from the LMS on 2026-09-15 20:55:51 landed with
-- marketing_status null. The consent itself did arrive — on lms_leads.marketing_consent —
-- but nothing mapped it onto the contact, because that mapping only exists inside
-- backfill-lms-leads and this import bypassed the function. Result: 227 people with no
-- marketing status, invisible to any segment that filters on it.
--
-- This applies the same mapping the function would have:
--   marketing_emails_consent = true  -> 'Subscribed'
--   anything else                    -> 'No consent'
--
-- 'No consent' is the CRM's own vocabulary for "we do not hold consent", and is the right
-- landing place for the 47 scorm-tool contacts that have no lms_leads row at all: absence
-- of evidence of consent is not consent. This does NOT write a granted = false row
-- anywhere — that rule governs gdpr_consents in the LMS, which is untouched and remains
-- the system of record. contacts.marketing_status is a CRM-local label, not consent truth.
--
-- Deliberately narrow, and safe to re-run:
--   * only rows from that exact import timestamp
--   * only rows still null, so a status set by a human or another system is never
--     overwritten — least of all downgraded
--
-- Applied 2026-09-16: 227 rows (11 Subscribed, 216 No consent), 0 mismatches against the
-- consent it was derived from, nothing outside the import touched.
update public.contacts c
set marketing_status = case
      when exists (
        select 1 from public.lms_leads l
        where lower(l.email) = lower(c.email)
          and l.marketing_consent is true
      ) then 'Subscribed'
      else 'No consent'
    end,
    updated_at = now()
where c.created_at = '2026-09-15 20:55:51.699622+00'
  and c.marketing_status is null;
