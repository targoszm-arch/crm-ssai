-- Consent state backfill — run against the LMS project (oxlujbymtjugefaqmwuy).
--
-- Why: gdpr_consents is the state table by design, but holds 20 rows against 228 profiles.
-- The column the signup flow actually writes is profiles.marketing_emails_consent
-- (21 true / 207 false / 0 null, and marketing_consent_verified_at null for all 228).
-- Two disagreeing sources of truth is the thing that hurts during a complaint.
--
-- Deliberate asymmetry, per the consent rules:
--   * product_emails  -> a row for everyone who signed up (that is what signup consents to).
--   * marketing_emails -> a row ONLY where consent was actually granted. We never write
--     granted=false, because the ABSENCE of a row is stronger evidence of non-consent
--     than a false row someone could later argue was a default.
--
-- Idempotent: re-running inserts nothing new.
-- Verify with the SELECTs at the bottom BEFORE and AFTER.

begin;

-- 1. Product emails: everyone with an account.
insert into gdpr_consents (user_id, consent_type, granted, granted_at, ip_address, user_agent)
select
  p.id,
  'product_emails',
  true,
  coalesce(p.created_at, now()),
  p.marketing_consent_ip,
  null
from profiles p
where not exists (
  select 1 from gdpr_consents g
  where g.user_id = p.id and g.consent_type = 'product_emails'
);

-- 2. Marketing emails: only where the profile says consent was granted.
insert into gdpr_consents (user_id, consent_type, granted, granted_at, ip_address, user_agent)
select
  p.id,
  'marketing_emails',
  true,
  coalesce(p.marketing_consent_verified_at, p.created_at, now()),
  p.marketing_consent_ip,
  null
from profiles p
where p.marketing_emails_consent is true
  and not exists (
    select 1 from gdpr_consents g
    where g.user_id = p.id and g.consent_type = 'marketing_emails'
  );

-- 3. Audit trail for the backfill itself, so the provenance of these rows is on record.
insert into marketing_consent_log (entity_type, entity_id, action, token_used)
select 'profile', p.id, 'backfilled_from_profiles', null
from profiles p
where not exists (
  select 1 from marketing_consent_log m
  where m.entity_id = p.id and m.action = 'backfilled_from_profiles'
);

commit;

-- Verification — expected after the run:
--   product_emails   granted = (number of profiles, 228 at time of writing)
--   marketing_emails granted = (profiles with marketing_emails_consent true, 21 at time of writing)
select consent_type, granted, count(*)
from gdpr_consents
group by consent_type, granted
order by consent_type, granted;

-- Anyone whose two sources still disagree (should return zero rows):
select p.id, p.email, p.marketing_emails_consent, g.granted
from profiles p
left join gdpr_consents g
  on g.user_id = p.id and g.consent_type = 'marketing_emails'
where p.marketing_emails_consent is true and (g.id is null or g.granted is not true);
