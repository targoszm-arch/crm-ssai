create extension if not exists pg_trgm;

create table public.naics_codes (
  id bigint generated always as identity primary key,
  code text not null,
  description text not null
);

create index naics_codes_description_trgm_idx on public.naics_codes using gin (description gin_trgm_ops);
create index naics_codes_code_idx on public.naics_codes (code);

alter table public.naics_codes enable row level security;
create policy "naics_codes_select_all" on public.naics_codes for select using (true);

alter table public.companies add column naics_code text;
alter table public.companies add column naics_description text;
