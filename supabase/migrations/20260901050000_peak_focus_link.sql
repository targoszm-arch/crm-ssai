-- Read Peak Focus tasks from the CRM, and create tasks there from here.
--
-- WHY THIS SHAPE. Peak Focus holds 468 tasks; the CRM's own tasks table holds 0 and its
-- project_id / client_id / linked_deal_id columns have no foreign keys at all — they point
-- nowhere. So Peak Focus stays the system of record for tasks and the CRM reads across.
-- Populating public.tasks would fork the truth, which is what the one-direction rule in
-- CLAUDE.md exists to prevent.
--
-- NOT the `wrappers` extension: that is for third-party APIs (Stripe, Airtable, HubSpot).
-- Postgres-to-Postgres needs postgres_fdw specifically.
--
-- SECURITY. The foreign tables live in a private schema PostgREST never exposes, and
-- `authenticated` is deliberately NOT granted on it — otherwise every Peak Focus task,
-- including personal ones, would be readable through the CRM's API. Access is only via the
-- security-definer functions, which return tasks for ONE CRM record at a time. Only
-- tasks/projects/clients are imported: habits, oura_daily and daily_entries are personal
-- and have no business being reachable from a CRM.
--
-- SINGLE USER ONLY. This gives the CRM database read access to Peak Focus. That is fine
-- while one person owns both. If the CRM ever gets other users this becomes a
-- data-exposure route and must be replaced with a scoped API.

create extension if not exists postgres_fdw with schema extensions;

create schema if not exists peak_focus;
revoke all on schema peak_focus from public, anon, authenticated;

create table if not exists public.peak_focus_config (
  singleton      boolean primary key default true check (singleton),
  owner_user_id  uuid not null,
  connected_at   timestamptz not null default now()
);
alter table public.peak_focus_config enable row level security;
revoke all on table public.peak_focus_config from public, anon, authenticated;

comment on table public.peak_focus_config is
  'The Peak Focus auth user that owns tasks created from the CRM. Discovered at connect time; not the CRM user id, which belongs to a different auth system.';

create server if not exists peak_focus
  foreign data wrapper postgres_fdw
  options (host 'db.filtmcykamccfikuxehy.supabase.co', port '5432', dbname 'postgres');

comment on server peak_focus is
  'Peak Focus (project filtmcykamccfikuxehy). Read-across for tasks; see peak_focus_connect().';

-- One call to finish the link once the password exists. Kept as a function so the password
-- is passed at call time and never written into a migration or committed to the repo.
create or replace function public.peak_focus_connect(p_password text)
returns text
language plpgsql
security definer
set search_path = public, peak_focus, extensions
as $$
declare
  v_count integer;
  v_owner uuid;
begin
  if coalesce(p_password, '') = '' then
    raise exception 'Password required';
  end if;

  drop user mapping if exists for current_user server peak_focus;
  execute format(
    'create user mapping for current_user server peak_focus options (user %L, password %L)',
    'postgres', p_password
  );

  drop foreign table if exists peak_focus.tasks, peak_focus.projects, peak_focus.clients;
  import foreign schema public
    limit to (tasks, projects, clients)
    from server peak_focus into peak_focus;

  -- Whoever owns the most tasks over there is the account this CRM writes as. Derived
  -- rather than hardcoded so it survives a Peak Focus account change. This is NOT the CRM
  -- user id: the two projects have separate auth (CRM 72242162-…, Peak Focus c0ad9404-…),
  -- and writing the CRM's id would produce tasks owned by a user that does not exist
  -- there, which Peak Focus's RLS would then hide.
  select t.user_id into v_owner
  from peak_focus.tasks t
  group by t.user_id
  order by count(*) desc
  limit 1;

  if v_owner is null then
    raise exception 'Connected, but Peak Focus has no tasks to identify an owner from. Create one task there first.';
  end if;

  insert into public.peak_focus_config (singleton, owner_user_id, connected_at)
  values (true, v_owner, now())
  on conflict (singleton) do update
    set owner_user_id = excluded.owner_user_id, connected_at = excluded.connected_at;

  select count(*) into v_count from peak_focus.tasks;
  return format('Connected. %s Peak Focus tasks visible, writing as owner %s.', v_count, v_owner);
end;
$$;

revoke all on function public.peak_focus_connect(text) from public, anon, authenticated;

comment on function public.peak_focus_connect(text) is
  'One-time setup: supply the Peak Focus database password to create the user mapping and import its tasks/projects/clients. Also how the password is rotated.';
