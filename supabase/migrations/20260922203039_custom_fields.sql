create table public.custom_field_definitions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  entity_type text not null check (entity_type in ('contact', 'company')),
  field_key text not null,
  label text not null,
  field_type text not null default 'text' check (field_type in ('text', 'number', 'date', 'select')),
  select_options text[],
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, entity_type, field_key)
);

alter table public.custom_field_definitions enable row level security;

create policy "custom_field_definitions_select_own" on public.custom_field_definitions
  for select using (auth.uid() = user_id);
create policy "custom_field_definitions_insert_own" on public.custom_field_definitions
  for insert with check (auth.uid() = user_id);
create policy "custom_field_definitions_update_own" on public.custom_field_definitions
  for update using (auth.uid() = user_id);
create policy "custom_field_definitions_delete_own" on public.custom_field_definitions
  for delete using (auth.uid() = user_id);

create trigger set_custom_field_definitions_updated_at
  before update on public.custom_field_definitions
  for each row execute function public.update_updated_at_column();

-- Values live directly on the record rather than a separate EAV table --
-- one jsonb column, keyed by field_key, so reading a contact/company never
-- needs a second query or a join to show its custom fields.
alter table public.contacts add column custom_fields jsonb not null default '{}'::jsonb;
alter table public.companies add column custom_fields jsonb not null default '{}'::jsonb;
