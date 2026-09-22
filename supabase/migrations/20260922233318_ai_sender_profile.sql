create table public.ai_sender_profile (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  content text not null,
  updated_at timestamptz not null default now()
);

alter table public.ai_sender_profile enable row level security;

create policy "ai_sender_profile_select_own" on public.ai_sender_profile
  for select using (auth.uid() = user_id);
create policy "ai_sender_profile_insert_own" on public.ai_sender_profile
  for insert with check (auth.uid() = user_id);
create policy "ai_sender_profile_update_own" on public.ai_sender_profile
  for update using (auth.uid() = user_id);
create policy "ai_sender_profile_delete_own" on public.ai_sender_profile
  for delete using (auth.uid() = user_id);

create trigger ai_sender_profile_updated_at
  before update on public.ai_sender_profile
  for each row execute function public.update_updated_at_column();
