-- Click-to-segment routing.
--
-- The indoctrination email carries four cards, each linking to a different product page.
-- Which card someone clicks is the strongest interest signal we get, and it is currently
-- thrown away: a click is recorded, then nothing happens. This turns that click into a
-- segment (a label on the contact) and, optionally, an enrolment into the follow-on
-- sequence for that topic.
--
-- The matching lives in Postgres rather than in the edge functions because two different
-- functions see clicks — track-sequence-click for mail this CRM sent, resend-webhook for
-- mail Resend sent — and Supabase deploys edge functions independently of one another.
-- Shared TypeScript between them means two copies that drift. One function, both callers.

create table if not exists public.sequence_click_routes (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references auth.users(id) on delete cascade,
  -- What the click means, in your words: 'sop', 'compliance', 'onboarding'.
  topic             text not null,
  -- Matched case-insensitively as a substring of the clicked URL. Keep it specific enough
  -- that it cannot match a different card: '/sop' matches '/sop-templates' too.
  match_pattern     text not null,
  -- The segment. Appended to contacts.labels, which is the comma-separated text column the
  -- labels UI already reads and writes.
  label             text not null,
  -- The follow-on sequence for this topic. Null means label only — useful while you are
  -- still writing the sequence, and the honest default.
  enrol_sequence_id uuid references public.sequences(id) on delete set null,
  -- Highest priority wins when a URL matches more than one route.
  priority          integer not null default 0,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_click_routes_active
  on public.sequence_click_routes (is_active, priority desc);
create index if not exists idx_click_routes_user
  on public.sequence_click_routes (user_id);

drop trigger if exists set_sequence_click_routes_updated_at on public.sequence_click_routes;
create trigger set_sequence_click_routes_updated_at
  before update on public.sequence_click_routes
  for each row execute function public.update_updated_at_column();

alter table public.sequence_click_routes enable row level security;

drop policy if exists "Users can read own click routes"   on public.sequence_click_routes;
drop policy if exists "Users can insert own click routes" on public.sequence_click_routes;
drop policy if exists "Users can update own click routes" on public.sequence_click_routes;
drop policy if exists "Users can delete own click routes" on public.sequence_click_routes;

create policy "Users can read own click routes"   on public.sequence_click_routes
  for select to authenticated using (auth.uid() = user_id);
create policy "Users can insert own click routes" on public.sequence_click_routes
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can update own click routes" on public.sequence_click_routes
  for update to authenticated using (auth.uid() = user_id);
create policy "Users can delete own click routes" on public.sequence_click_routes
  for delete to authenticated using (auth.uid() = user_id);


-- route_sequence_click: the whole loop, called once per recorded click.
--
-- Returns jsonb rather than raising, because the caller is a redirect handler — the person
-- who clicked must land on the page whatever happens here. Every outcome, including every
-- refusal to enrol, comes back named so it can be logged and so "why was this person not
-- enrolled" is answerable after the fact.
create or replace function public.route_sequence_click(
  p_contact_id uuid,
  p_link_url   text,
  p_user_id    uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contact       contacts%rowtype;
  v_route         sequence_click_routes%rowtype;
  v_existing      text[];
  v_label_added   boolean := false;
  v_enrollment_id uuid;
  v_skipped       text;
  v_sequence_name text;
begin
  if p_contact_id is null or p_link_url is null or btrim(p_link_url) = '' then
    return jsonb_build_object('matched', false, 'reason', 'missing_input');
  end if;

  select * into v_contact from contacts where id = p_contact_id;
  if not found then
    return jsonb_build_object('matched', false, 'reason', 'contact_not_found');
  end if;

  -- Scope to the owner when the caller knows it; a route with no user_id is shared.
  select * into v_route
  from sequence_click_routes r
  where r.is_active
    and (p_user_id is null or r.user_id = p_user_id or r.user_id is null)
    and p_link_url ilike '%' || r.match_pattern || '%'
  order by r.priority desc, length(r.match_pattern) desc, r.created_at
  limit 1;

  if not found then
    return jsonb_build_object('matched', false, 'reason', 'no_route');
  end if;

  -- Label the contact. Compare against the split-out list rather than the raw string:
  -- 'SOP' is a substring of 'SOP Templates', and substring matching would silently skip
  -- adding a genuinely different label.
  v_existing := array(
    select btrim(x)
    from unnest(string_to_array(coalesce(v_contact.labels, ''), ',')) as x
    where btrim(x) <> ''
  );

  if not exists (
    select 1 from unnest(v_existing) as l where lower(l) = lower(v_route.label)
  ) then
    update contacts
       set labels = array_to_string(v_existing || v_route.label, ', '),
           updated_at = now()
     where id = p_contact_id;
    v_label_added := true;
  end if;

  -- Enrol into the follow-on sequence, unless something says not to.
  if v_route.enrol_sequence_id is null then
    v_skipped := 'no_sequence_configured';

  elsif v_contact.email is null or btrim(v_contact.email) = '' then
    v_skipped := 'contact_has_no_email';

  -- Live values in this column are capitalised ('Unsubscribed', 'Bounced'), so fold case
  -- rather than trusting a convention nothing enforces.
  elsif lower(coalesce(v_contact.marketing_status, '')) in
        ('unsubscribed', 'bounced', 'do not contact', 'do_not_contact', 'complained') then
    v_skipped := 'marketing_status_' || lower(v_contact.marketing_status);

  -- One unsubscribe or hard bounce anywhere ends every sequence for that contact, not just
  -- the one it happened in.
  elsif exists (
    select 1 from sequence_enrollments e
    where e.contact_id = p_contact_id
      and lower(e.status) in ('unsubscribed', 'bounced')
  ) then
    v_skipped := 'previously_unsubscribed_or_bounced';

  elsif exists (
    select 1 from sequence_enrollments e
    where e.contact_id = p_contact_id
      and e.sequence_id = v_route.enrol_sequence_id
      and lower(coalesce(e.status, 'active')) in ('active', 'completed')
  ) then
    -- Clicking the same card twice must not start the sequence twice.
    v_skipped := 'already_enrolled';

  else
    select name into v_sequence_name from sequences where id = v_route.enrol_sequence_id;

    insert into sequence_enrollments (
      sequence_id, contact_id, current_step, status, enrolled_at, next_email_at, metadata, user_id
    ) values (
      v_route.enrol_sequence_id,
      p_contact_id,
      0,
      'active',
      now(),
      now(),
      jsonb_build_object(
        'source',   'click_route',
        'route_id', v_route.id,
        'topic',    v_route.topic,
        'label',    v_route.label,
        'link_url', p_link_url
      ),
      coalesce(v_route.user_id, p_user_id, v_contact.user_id)
    )
    returning id into v_enrollment_id;
  end if;

  insert into activities (contact_id, activity_type, description, source, metadata, occurred_at, user_id)
  values (
    p_contact_id,
    'sequence_click_routed',
    case
      when v_enrollment_id is not null
        then 'Clicked ' || v_route.topic || ' — labelled "' || v_route.label ||
             '" and enrolled in ' || coalesce(v_sequence_name, 'the follow-on sequence')
      else 'Clicked ' || v_route.topic || ' — labelled "' || v_route.label ||
           '", not enrolled (' || coalesce(v_skipped, 'unknown') || ')'
    end,
    'click_route',
    jsonb_build_object(
      'route_id',      v_route.id,
      'topic',         v_route.topic,
      'label',         v_route.label,
      'label_added',   v_label_added,
      'link_url',      p_link_url,
      'enrollment_id', v_enrollment_id,
      'skipped',       v_skipped
    ),
    now(),
    coalesce(v_route.user_id, p_user_id, v_contact.user_id)
  );

  return jsonb_build_object(
    'matched',       true,
    'route_id',      v_route.id,
    'topic',         v_route.topic,
    'label',         v_route.label,
    'label_added',   v_label_added,
    'enrolled',      v_enrollment_id is not null,
    'enrollment_id', v_enrollment_id,
    'skipped',       v_skipped
  );
end;
$$;

comment on function public.route_sequence_click(uuid, text, uuid) is
  'Turns a recorded email click into a segment: labels the contact and enrols them in the '
  'topic''s follow-on sequence. Returns the outcome as jsonb and never raises, because '
  'every caller is a redirect the clicker is waiting on.';

revoke all on function public.route_sequence_click(uuid, text, uuid) from public;
grant execute on function public.route_sequence_click(uuid, text, uuid) to service_role;
grant execute on function public.route_sequence_click(uuid, text, uuid) to authenticated;


-- track-sequence-click has always called increment_contact_clicks and always fallen back,
-- because the function was never created. Its fallback then called supabase.raw(), which
-- does not exist in supabase-js v2, so the fallback threw where the counter should have
-- incremented. Create the function the caller has been asking for all along.
create or replace function public.increment_contact_clicks(contact_id_param uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update contacts
     set total_clicks = coalesce(total_clicks, 0) + 1,
         updated_at = now()
   where id = contact_id_param;
$$;

revoke all on function public.increment_contact_clicks(uuid) from public;
grant execute on function public.increment_contact_clicks(uuid) to service_role;
grant execute on function public.increment_contact_clicks(uuid) to authenticated;
