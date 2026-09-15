-- lists has existed (empty) with only filter_json, i.e. a saved *filter*. A filter cannot
-- hold "these 40 people I picked", which is what a list is actually for. This adds the
-- membership table that was missing, so a list can hold contacts and companies directly.
--
-- One row = one member. A member is a contact OR a company, never both and never neither;
-- the check constraint enforces that rather than trusting callers.

create table if not exists public.list_members (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  user_id uuid not null,
  added_at timestamptz not null default now(),
  constraint list_members_exactly_one_target check (
    (contact_id is not null and company_id is null)
    or (contact_id is null and company_id is not null)
  )
);

-- Adding the same person to the same list twice is a no-op, not a duplicate row. Partial
-- unique indexes because a plain unique on (list_id, contact_id, company_id) would not
-- dedupe: NULLs never compare equal, so every company row would look distinct.
create unique index if not exists list_members_unique_contact
  on public.list_members (list_id, contact_id) where contact_id is not null;
create unique index if not exists list_members_unique_company
  on public.list_members (list_id, company_id) where company_id is not null;

create index if not exists list_members_list_id_idx on public.list_members (list_id);
create index if not exists list_members_contact_id_idx on public.list_members (contact_id);
create index if not exists list_members_company_id_idx on public.list_members (company_id);

alter table public.list_members enable row level security;

create policy "Users can read own list members"
  on public.list_members for select using (auth.uid() = user_id);
create policy "Users can insert own list members"
  on public.list_members for insert with check (auth.uid() = user_id);
create policy "Users can update own list members"
  on public.list_members for update using (auth.uid() = user_id);
create policy "Users can delete own list members"
  on public.list_members for delete using (auth.uid() = user_id);
