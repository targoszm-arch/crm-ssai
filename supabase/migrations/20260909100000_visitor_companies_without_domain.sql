-- The Companies tab was empty even when reverse-IP had named the visitor.
--
-- ipapi.is only returns `company.domain` on a paid key. On the free tier it
-- answers with a name and no domain at all — so of the visits it did resolve
-- (SpaceX, Cisco OpenDNS, Instituto Tecnológico de Monterrey), every one had
-- company_name set and company_domain null, and this view's
-- `company_domain IS NOT NULL` filter discarded the lot.
--
-- A domain is the better key when there is one: it is stable, and it is what
-- matches a CRM company. But requiring it throws away the answer rather than
-- degrading. So the identity becomes company_key — the domain where the
-- provider gave one, the normalised name otherwise — and company_domain stays
-- as a column, now nullable, for the matching that genuinely needs it.
drop view if exists public.website_visitor_companies;

create view public.website_visitor_companies
with (security_invoker = on)
as
select
  user_id,
  site_id,
  coalesce(nullif(btrim(company_domain), ''), lower(btrim(company_name))) as company_key,
  (array_agg(company_domain order by visited_at desc)
     filter (where company_domain is not null))[1] as company_domain,
  (array_agg(company_name order by visited_at desc)
     filter (where company_name is not null))[1] as company_name,
  (array_agg(country order by visited_at desc)
     filter (where country is not null))[1] as country,
  (array_agg(city order by visited_at desc)
     filter (where city is not null))[1] as city,
  (array_agg(path order by visited_at desc))[1] as last_path,
  (array_agg(referrer order by visited_at desc)
     filter (where referrer is not null))[1] as last_referrer,
  (array_agg(matched_company_id order by visited_at desc)
     filter (where matched_company_id is not null))[1] as matched_company_id,
  count(*) as page_views,
  count(distinct session_id) as visit_count,
  count(distinct path) as unique_pages,
  min(visited_at) as first_seen,
  max(visited_at) as last_seen
from website_visits v
where classification = 'company'
  and coalesce(nullif(btrim(company_domain), ''), nullif(btrim(company_name), '')) is not null
group by user_id, site_id,
         coalesce(nullif(btrim(company_domain), ''), lower(btrim(company_name)));

comment on view public.website_visitor_companies is
  'One row per identified visiting company. Keyed on company_key: the reverse-IP domain when the provider returned one, the normalised company name otherwise.';
