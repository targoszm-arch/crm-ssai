-- Consent state backfill — APPLIED to the LMS project (oxlujbymtjugefaqmwuy) on 2026-08-29.
-- Kept for the record. Re-running is safe: every insert is guarded and inserts nothing new.
--
-- Why: gdpr_consents is the state table by design, but held 20 rows against 228 profiles.
-- The column the signup flow actually writes is profiles.marketing_emails_consent
-- (21 true / 207 false / 0 null, and marketing_consent_verified_at null for all 228).
-- Two disagreeing sources of truth is the thing that hurts during a complaint.
--
-- Conventions, taken from the live schema rather than invented:
--   * consent_type is a bare noun — the existing 20 rows use 'marketing', NOT
--     'marketing_emails'. Product consent follows suit as 'product'.
--   * gdpr_consents has UNIQUE (user_id, consent_type), so one row per person per type.
--   * marketing_consent_log.action has a CHECK constraint allowing only
--     consent_requested | consent_granted | consent_denied | consent_revoked.
--     Any other value fails the insert.
--
-- Deliberate asymmetry:
--   * product   -> a row for everyone who signed up (that is what signup consents to).
--   * marketing -> a row ONLY where consent was actually granted. We never write
--     granted=false, because the ABSENCE of a row is stronger evidence of non-consent
--     than a false row someone could later argue was a default.
--
-- Deliberately NOT backfilled: marketing_consent_log. It is an append-only audit of
-- events, and inserting synthetic "consent_granted" rows stamped today would misstate
-- when consent actually happened. gdpr_consents.granted_at already carries that. The log
-- starts recording real events from the confirm-marketing-consent endpoint onward.

begin;

-- 1. Product emails: everyone with an account. (Inserted 228 rows.)
insert into gdpr_consents (user_id, consent_type, granted, granted_at, ip_address, user_agent)
select p.id, 'product', true, coalesce(p.created_at, now()), p.marketing_consent_ip, null
from profiles p
where not exists (
  select 1 from gdpr_consents g where g.user_id = p.id and g.consent_type = 'product'
);

-- 2. Marketing: only where the profile says consent was granted. (Inserted 2 rows —
--    19 of the 21 consenting profiles already had one.)
insert into gdpr_consents (user_id, consent_type, granted, granted_at, ip_address, user_agent)
select p.id, 'marketing', true,
       coalesce(p.marketing_consent_verified_at, p.created_at, now()),
       p.marketing_consent_ip, null
from profiles p
where p.marketing_emails_consent is true
  and not exists (
    select 1 from gdpr_consents g where g.user_id = p.id and g.consent_type = 'marketing'
  );

commit;

-- Result after the run: marketing granted 22, product granted 228.
select consent_type, granted, count(*) from gdpr_consents group by 1,2 order by 1,2;

-- RESOLVED 2026-08-29. One person disagreed across the two sources: gdpr_consents recorded
-- marketing consent granted on their signup date, while the profile flag said false.
-- Decision (Magda): treat as NON-consenting. The row was revoked rather than deleted —
-- a revocation you cannot evidence is as bad as no consent record at all — and logged as
-- consent_revoked. Result: marketing granted = 21, exactly matching the profile flags,
-- plus 1 revoked row.
--
-- update gdpr_consents g set granted = false, revoked_at = now(), updated_at = now()
--   from profiles p
--  where p.id = g.user_id and g.consent_type = 'marketing' and g.granted
--    and p.marketing_emails_consent is not true;
--
-- This should now return zero rows:
select p.email, p.marketing_emails_consent as profile_says, g.granted as gdpr_says
from gdpr_consents g join profiles p on p.id = g.user_id
where g.consent_type = 'marketing' and g.granted and p.marketing_emails_consent is not true;

-- Consenting profiles with no marketing row (should be zero after the run):
select p.id, p.email
from profiles p
where p.marketing_emails_consent is true
  and not exists (
    select 1 from gdpr_consents g
    where g.user_id = p.id and g.consent_type = 'marketing' and g.granted
  );
