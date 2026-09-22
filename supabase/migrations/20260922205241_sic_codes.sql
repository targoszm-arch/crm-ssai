create table public.sic_codes (
  id bigint generated always as identity primary key,
  code text not null,
  title text not null
);

create index sic_codes_title_trgm_idx on public.sic_codes using gin (title gin_trgm_ops);
create unique index sic_codes_code_idx on public.sic_codes (code);

alter table public.sic_codes enable row level security;
create policy "sic_codes_select_all" on public.sic_codes for select using (true);

alter table public.companies add column sic_code text;
alter table public.companies add column sic_title text;
