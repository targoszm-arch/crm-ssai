create table public.lead_qualifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'completed')),
  problem_identification jsonb not null default '{}'::jsonb,
  time_qualification jsonb not null default '{}'::jsonb,
  cost_qualification jsonb not null default '{}'::jsonb,
  process_qualification jsonb not null default '{}'::jsonb,
  success_metrics jsonb not null default '{}'::jsonb,
  champions_identification jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contact_id)
);

alter table public.lead_qualifications enable row level security;

create policy "lead_qualifications_select_own" on public.lead_qualifications
  for select using (auth.uid() = user_id);
create policy "lead_qualifications_insert_own" on public.lead_qualifications
  for insert with check (auth.uid() = user_id);
create policy "lead_qualifications_update_own" on public.lead_qualifications
  for update using (auth.uid() = user_id);
create policy "lead_qualifications_delete_own" on public.lead_qualifications
  for delete using (auth.uid() = user_id);

create index lead_qualifications_company_id_idx on public.lead_qualifications(company_id);

create trigger set_lead_qualifications_updated_at
  before update on public.lead_qualifications
  for each row execute function public.update_updated_at_column();

-- Gate: a deal cannot be created for a contact/company that has no completed
-- Lead Qualification form. SECURITY DEFINER + an explicit user_id filter so
-- this holds regardless of who is inserting: the AddDealModal UI (RLS-scoped
-- client), or the MCP server's create_deal tool / a raw SQL insert (service
-- role, which bypasses RLS but never bypasses a trigger). This is the actual
-- fix for "AI agent silently creates a deal from a LinkedIn reply" -- the
-- MCP tool itself is left alone; the database now refuses the write no
-- matter what inserts it.
create or replace function public.enforce_lead_qualification_before_deal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  qualified boolean := false;
begin
  if new.contact_id is not null then
    select exists(
      select 1 from public.lead_qualifications
      where contact_id = new.contact_id
        and status = 'completed'
        and user_id = new.user_id
    ) into qualified;
  elsif new.company_id is not null then
    select exists(
      select 1 from public.lead_qualifications lq
      join public.contacts c on c.id = lq.contact_id
      where c.company_id = new.company_id
        and lq.status = 'completed'
        and lq.user_id = new.user_id
    ) into qualified;
  end if;

  if not qualified then
    raise exception 'A completed Lead Qualification form is required before creating a deal for this contact or company.'
      using errcode = 'P0001', hint = 'Open the contact''s People page and fill in the Lead Qualification form first.';
  end if;

  return new;
end;
$$;

create trigger deals_require_lead_qualification
  before insert on public.deals
  for each row execute function public.enforce_lead_qualification_before_deal();
