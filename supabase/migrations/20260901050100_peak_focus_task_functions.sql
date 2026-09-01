-- What the CRM calls. Each returns tasks for ONE record, never the whole of Peak Focus.
--
-- Two ways a Peak Focus task is tied to a CRM company:
--   1. EXPLICIT — tasks.custom_fields->>'crm_company_id', set by tasks created from the
--      CRM. Exact, and the durable answer.
--   2. BY NAME — peak_focus.clients.name against companies.company_name. This is what
--      makes the 468 existing tasks useful on day one: 7 of the 20 Peak Focus clients
--      match a CRM company exactly today. It is a fallback, not a key — names drift, and
--      the CRM has duplicate companies (Enterprise Ireland and Mastercard each appear
--      twice), so a name match can attach one task to more than one company row.
--      match_type tells the caller which produced the row.

create or replace function public.peak_focus_tasks_for_company(p_company_id uuid)
returns table (
  task_id uuid, title text, status text, priority text, completed boolean,
  starts_at timestamptz, ends_at timestamptz,
  project_name text, client_name text, match_type text
)
language plpgsql
security definer
set search_path = public, peak_focus
as $$
declare
  v_company_name text;
begin
  -- Callers only ever see their own companies' tasks.
  select c.company_name into v_company_name
  from public.companies c
  where c.id = p_company_id and c.user_id = auth.uid();

  if v_company_name is null then
    return;
  end if;

  return query
  select t.id, t.title, t.status, t.priority, t.completed,
         t.starts_at, t.ends_at, p.name, cl.name,
         case when t.custom_fields->>'crm_company_id' = p_company_id::text
              then 'explicit' else 'name' end
  from peak_focus.tasks t
  left join peak_focus.projects p on p.id = t.project_id
  left join peak_focus.clients  cl on cl.id = p.client_id
  where t.custom_fields->>'crm_company_id' = p_company_id::text
     or lower(btrim(cl.name)) = lower(btrim(v_company_name))
  order by t.completed, t.ends_at nulls last, t.created_at desc;
end;
$$;

create or replace function public.peak_focus_tasks_for_contact(p_contact_id uuid)
returns table (
  task_id uuid, title text, status text, priority text, completed boolean,
  starts_at timestamptz, ends_at timestamptz
)
language plpgsql
security definer
set search_path = public, peak_focus
as $$
begin
  if not exists (
    select 1 from public.contacts c where c.id = p_contact_id and c.user_id = auth.uid()
  ) then
    return;
  end if;

  -- No name fallback for people: matching a human by name across two systems is far too
  -- loose to risk attaching someone else's work to them. Explicit link only.
  return query
  select t.id, t.title, t.status, t.priority, t.completed, t.starts_at, t.ends_at
  from peak_focus.tasks t
  where t.custom_fields->>'crm_contact_id' = p_contact_id::text
  order by t.completed, t.ends_at nulls last, t.created_at desc;
end;
$$;

-- The write direction. Deliberate, one task at a time, stamping the CRM ids so the task
-- comes back through the explicit match rather than relying on names.
create or replace function public.peak_focus_create_task(
  p_title text,
  p_contact_id uuid default null,
  p_company_id uuid default null,
  p_ends_at timestamptz default null,
  p_priority text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, peak_focus
as $$
declare
  v_caller uuid := auth.uid();
  v_pf_owner uuid;
  v_task uuid;
  v_links jsonb := '{}'::jsonb;
begin
  if coalesce(btrim(p_title), '') = '' then
    raise exception 'Task title required';
  end if;
  if v_caller is null then
    raise exception 'Not authenticated';
  end if;

  select owner_user_id into v_pf_owner from public.peak_focus_config;
  if v_pf_owner is null then
    raise exception 'Peak Focus is not connected yet. Run select peak_focus_connect(''<password>'') first.';
  end if;

  -- Only link records the caller owns, so a guessed id cannot attach a task to someone
  -- else's contact.
  if p_contact_id is not null and exists (
       select 1 from public.contacts where id = p_contact_id and user_id = v_caller) then
    v_links := v_links || jsonb_build_object('crm_contact_id', p_contact_id);
  end if;
  if p_company_id is not null and exists (
       select 1 from public.companies where id = p_company_id and user_id = v_caller) then
    v_links := v_links || jsonb_build_object('crm_company_id', p_company_id);
  end if;

  if v_links = '{}'::jsonb then
    raise exception 'A task must link to a contact or company you own';
  end if;

  -- Peak Focus column reality, checked rather than assumed: user_id is uuid NOT NULL with
  -- no default, created_by is uuid (not text), and priority is NOT NULL. Getting any of
  -- the three wrong throws on insert.
  insert into peak_focus.tasks
    (user_id, created_by, title, notes, priority, ends_at, custom_fields)
  values
    (v_pf_owner,                     -- NOT auth.uid(): separate auth system
     v_pf_owner,                     -- uuid, not the string 'crm'
     btrim(p_title),
     coalesce(p_notes, ''),
     coalesce(p_priority, 'none'),   -- NOT NULL over there
     p_ends_at,
     v_links || jsonb_build_object('source', 'crm', 'crm_created_by', v_caller))
  returning id into v_task;

  return v_task;
end;
$$;

grant execute on function public.peak_focus_tasks_for_company(uuid) to authenticated;
grant execute on function public.peak_focus_tasks_for_contact(uuid) to authenticated;
grant execute on function public.peak_focus_create_task(text, uuid, uuid, timestamptz, text, text) to authenticated;

comment on function public.peak_focus_tasks_for_company(uuid) is
  'Peak Focus tasks for one CRM company: explicit custom_fields link, plus a client-name fallback. match_type says which.';
