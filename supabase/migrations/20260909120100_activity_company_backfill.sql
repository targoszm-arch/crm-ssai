-- company_id was set on 44 of 67,119 activity rows, so "everything that has
-- happened with this account" could not be asked at company level — only
-- contact by contact. Every row already carries contact_id, and contacts carry
-- company_id, so the link was always derivable and simply never written.
update public.activities a
set company_id = c.company_id
from public.contacts c
where c.id = a.contact_id
  and a.company_id is null
  and c.company_id is not null;

-- Keep it true for rows written from here on, without every writer having to
-- remember. Only fills a gap; an explicitly supplied company_id is left alone.
create or replace function public.activities_fill_company_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.company_id is null and new.contact_id is not null then
    select company_id into new.company_id from public.contacts where id = new.contact_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_activities_fill_company_id on public.activities;
create trigger trg_activities_fill_company_id
  before insert or update of contact_id on public.activities
  for each row execute function public.activities_fill_company_id();
