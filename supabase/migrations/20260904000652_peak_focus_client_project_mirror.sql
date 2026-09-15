-- RECOVERED. This ran against the live database on 4 September 2026 but was never
-- committed, so the repo and the database disagreed for eleven days. It is reproduced here
-- verbatim from supabase_migrations.schema_migrations so `supabase db reset` produces the
-- schema that is actually deployed.
--
-- SUPERSEDED by 20260915180000_peak_focus_push_scope.sql, which reverses the direction it
-- describes. Read that file for why. The columns this one adds are kept and reused --
-- peak_focus_client_id is still the durable link, it is just read the other way round now.

alter table public.companies add column if not exists peak_focus_client_id uuid;
alter table public.projects  add column if not exists peak_focus_project_id uuid;

comment on column public.companies.peak_focus_client_id is
  'The Peak Focus clients.id this company mirrors. Set once at link time; the sync upserts on it. Null means the company is CRM-only and Peak Focus never touches it.';
comment on column public.projects.peak_focus_project_id is
  'The Peak Focus projects.id this project mirrors. Every row in this table is expected to carry one — the CRM has no project UI of its own.';

create unique index if not exists companies_peak_focus_client_id_key
  on public.companies (peak_focus_client_id) where peak_focus_client_id is not null;
create unique index if not exists projects_peak_focus_project_id_key
  on public.projects (peak_focus_project_id) where peak_focus_project_id is not null;

create table if not exists public.peak_focus_sync_runs (
  id           uuid primary key default gen_random_uuid(),
  ran_at       timestamptz not null default now(),
  ok           boolean not null,
  companies_upserted integer not null default 0,
  projects_upserted  integer not null default 0,
  detail       text
);
alter table public.peak_focus_sync_runs enable row level security;
revoke all on table public.peak_focus_sync_runs from public, anon, authenticated;
