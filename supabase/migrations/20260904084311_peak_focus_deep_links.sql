-- RECOVERED. Ran live on 4 September 2026, never committed. Reproduced verbatim.
--
-- A mirrored row you cannot click through from is just a second place to read stale text.
-- So every linked row carries a deep link, generated from the id rather than synced: the
-- URL is a pure function of peak_focus_client_id, so there is no second value for a sync
-- to forget to update and no way for the link to disagree with the row it sits on.
--
-- Built from the id, not the name: Peak Focus renders /clients/:slug with a readable slug,
-- but clientBySlug() resolves a raw id first and falls back to slugs, so an id-built URL is
-- accepted and — unlike a slug, which shifts the moment a client is renamed — cannot break.

alter table public.companies
  add column if not exists peak_focus_url text
  generated always as (
    case when peak_focus_client_id is null then null
         else 'https://peak-focus.net/clients/' || peak_focus_client_id::text end
  ) stored;

alter table public.projects
  add column if not exists peak_focus_url text
  generated always as (
    case when peak_focus_project_id is null then null
         else 'https://peak-focus.net/projects/' || peak_focus_project_id::text end
  ) stored;

comment on column public.companies.peak_focus_url is
  'Deep link to this client in Peak Focus. Derived from peak_focus_client_id, never written by the sync.';
comment on column public.projects.peak_focus_url is
  'Deep link to this project in Peak Focus. Derived from peak_focus_project_id, never written by the sync.';
