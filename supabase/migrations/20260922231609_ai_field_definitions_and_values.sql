create table public.ai_field_definitions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  entity_type text not null default 'company' check (entity_type in ('company')),
  key text not null,
  label text not null,
  kind text not null check (kind in ('tier', 'qualifier')),
  tier_options text[],
  prompt_template text not null,
  active boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, entity_type, key)
);

alter table public.ai_field_definitions enable row level security;

create policy "ai_field_definitions_select_own" on public.ai_field_definitions
  for select using (auth.uid() = user_id);
create policy "ai_field_definitions_insert_own" on public.ai_field_definitions
  for insert with check (auth.uid() = user_id);
create policy "ai_field_definitions_update_own" on public.ai_field_definitions
  for update using (auth.uid() = user_id);
create policy "ai_field_definitions_delete_own" on public.ai_field_definitions
  for delete using (auth.uid() = user_id);

create trigger ai_field_definitions_updated_at
  before update on public.ai_field_definitions
  for each row execute function public.update_updated_at_column();

create table public.ai_field_values (
  id uuid primary key default gen_random_uuid(),
  ai_field_definition_id uuid not null references public.ai_field_definitions(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null,
  value text,
  evidence text,
  model text,
  computed_at timestamptz not null default now(),
  unique (ai_field_definition_id, company_id)
);

alter table public.ai_field_values enable row level security;

create policy "ai_field_values_select_own" on public.ai_field_values
  for select using (auth.uid() = user_id);
create policy "ai_field_values_insert_own" on public.ai_field_values
  for insert with check (auth.uid() = user_id);
create policy "ai_field_values_update_own" on public.ai_field_values
  for update using (auth.uid() = user_id);
create policy "ai_field_values_delete_own" on public.ai_field_values
  for delete using (auth.uid() = user_id);

create index ai_field_values_company_id_idx on public.ai_field_values (company_id);
create index ai_field_values_definition_id_idx on public.ai_field_values (ai_field_definition_id);
