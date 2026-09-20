-- LMS event routing: the same segmentation-by-action pattern as
-- sequence_click_routes/route_sequence_click (20260830060000, hardened in
-- 20260830235500), generalized from "a link was clicked" to "a product action
-- happened in the LMS". Each rule says: this event name means this topic, so
-- label the contact and (optionally) start them on that topic's sequence.
--
-- Distinguishing "_started" vs "_completed"/"_used" event names is intentional
-- product signal, not a naming accident — a route can target either to build
-- guidance sequences for started-but-not-finished as well as completed flows.
--
-- All matching happens here, in Postgres, exactly like click routing, so the
-- one caller (lms-webhook) cannot drift from a second implementation.

create table if not exists public.lms_event_routes (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references auth.users(id) on delete cascade,
  -- Your name for what the event means, e.g. 'course-from-pdf', 'scorm-import'.
  topic             text not null,
  -- Exact LMS event name to match, e.g. 'course_from_pdf_started',
  -- 'scorm_to_course_created'. Unlike click routing this is an exact match,
  -- not a substring — event names are a fixed, known vocabulary, so there is
  -- no need for partial matching and no risk of one event name accidentally
  -- matching another.
  event_name        text not null,
  -- The segment. Appended to contacts.labels, same column the labels UI and
  -- click routing both already read and write.
  label             text not null,
  -- The follow-on sequence for this event. Null means label only.
  enrol_sequence_id uuid references public.sequences(id) on delete set null,
  -- Highest priority wins if more than one active route somehow names the
  -- same event for the same tenant (should not normally happen since
  -- event_name is exact-matched, but mirrors click routing's tie-break rule).
  priority          integer not null default 0,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_lms_event_routes_active
  on public.lms_event_routes (is_active, priority desc);
create index if not exists idx_lms_event_routes_user
  on public.lms_event_routes (user_id);
create index if not exists idx_lms_event_routes_event_name
  on public.lms_event_routes (event_name);

drop trigger if exists set_lms_event_routes_updated_at on public.lms_event_routes;
create trigger set_lms_event_routes_updated_at
  before update on public.lms_event_routes
  for each row execute function public.update_updated_at_column();

alter table public.lms_event_routes enable row level security;

drop policy if exists "Users can read own lms event routes"   on public.lms_event_routes;
drop policy if exists "Users can insert own lms event routes" on public.lms_event_routes;
drop policy if exists "Users can update own lms event routes" on public.lms_event_routes;
drop policy if exists "Users can delete own lms event routes" on public.lms_event_routes;

create policy "Users can read own lms event routes"   on public.lms_event_routes
  for select to authenticated using (auth.uid() = user_id);
create policy "Users can insert own lms event routes" on public.lms_event_routes
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can update own lms event routes" on public.lms_event_routes
  for update to authenticated using (auth.uid() = user_id);
create policy "Users can delete own lms event routes" on public.lms_event_routes
  for delete to authenticated using (auth.uid() = user_id);

-- route_lms_event: the whole loop, called once per LMS product event received
-- by lms-webhook. Mirrors route_sequence_click's hardening line for line —
-- draft/paused sequences never get a live enrolment, do_not_contact and a
-- bad marketing_status block enrolment (but the event is still recorded),
-- and an already-enrolled or previously unsubscribed/bounced contact is
-- never re-enrolled.
create or replace function public.route_lms_event(
  p_contact_id  uuid,
  p_event_name  text,
  p_metadata    jsonb default '{}'::jsonb,
  p_user_id     uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contact       contacts%rowtype;
  v_route         lms_event_routes%rowtype;
  v_owner         uuid;
  v_existing      text[];
  v_label_added   boolean := false;
  v_enrollment_id uuid;
  v_skipped       text;
  v_sequence      sequences%rowtype;
begin
  if p_contact_id is null or p_event_name is null or btrim(p_event_name) = '' then
    return jsonb_build_object('matched', false, 'reason', 'missing_input');
  end if;

  select * into v_contact from contacts where id = p_contact_id;
  if not found then
    return jsonb_build_object('matched', false, 'reason', 'contact_not_found');
  end if;

  -- Never "any tenant". A caller that does not name an owner gets the contact's own.
  v_owner := coalesce(p_user_id, v_contact.user_id);

  select * into v_route
  from lms_event_routes r
  where r.is_active
    and (r.user_id is null or r.user_id = v_owner)
    and r.event_name = p_event_name
  order by r.priority desc, r.created_at
  limit 1;

  if not found then
    return jsonb_build_object('matched', false, 'reason', 'no_route');
  end if;

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

  if v_route.enrol_sequence_id is not null then
    select * into v_sequence from sequences where id = v_route.enrol_sequence_id;
  end if;

  if v_route.enrol_sequence_id is null then
    v_skipped := 'no_sequence_configured';

  elsif v_sequence.id is null then
    v_skipped := 'sequence_missing';

  -- A draft or paused sequence is not sendable. Label the contact, do not enrol them.
  elsif coalesce(v_sequence.status, 'draft') <> 'active' then
    v_skipped := 'sequence_not_active_' || coalesce(v_sequence.status, 'draft');

  elsif coalesce(v_contact.do_not_contact, false) then
    v_skipped := 'do_not_contact';

  elsif v_contact.email is null or btrim(v_contact.email) = '' then
    v_skipped := 'contact_has_no_email';

  elsif lower(coalesce(v_contact.marketing_status, '')) in
        ('unsubscribed', 'bounced', 'do not contact', 'do_not_contact', 'complained') then
    v_skipped := 'marketing_status_' || lower(v_contact.marketing_status);

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
    v_skipped := 'already_enrolled';

  else
    insert into sequence_enrollments (
      sequence_id, contact_id, current_step, status, enrolled_at, next_email_at, metadata, user_id
    ) values (
      v_route.enrol_sequence_id, p_contact_id, 0, 'active', now(), now(),
      jsonb_build_object(
        'source', 'lms_event_route', 'route_id', v_route.id,
        'topic', v_route.topic, 'label', v_route.label, 'event_name', p_event_name
      ) || coalesce(p_metadata, '{}'::jsonb),
      coalesce(v_route.user_id, v_owner)
    )
    returning id into v_enrollment_id;
  end if;

  insert into activities (contact_id, activity_type, description, source, metadata, occurred_at, user_id)
  values (
    p_contact_id,
    'lms_event_routed',
    case
      when v_enrollment_id is not null
        then p_event_name || ' — labelled "' || v_route.label ||
             '" and enrolled in ' || coalesce(v_sequence.name, 'the follow-on sequence')
      else p_event_name || ' — labelled "' || v_route.label ||
           '", not enrolled (' || coalesce(v_skipped, 'unknown') || ')'
    end,
    'lms_event_route',
    jsonb_build_object(
      'route_id', v_route.id, 'topic', v_route.topic, 'label', v_route.label,
      'label_added', v_label_added, 'event_name', p_event_name,
      'enrollment_id', v_enrollment_id, 'skipped', v_skipped
    ) || coalesce(p_metadata, '{}'::jsonb),
    now(),
    coalesce(v_route.user_id, v_owner)
  );

  return jsonb_build_object(
    'matched', true, 'route_id', v_route.id, 'topic', v_route.topic,
    'label', v_route.label, 'label_added', v_label_added,
    'enrolled', v_enrollment_id is not null,
    'enrollment_id', v_enrollment_id, 'skipped', v_skipped
  );
end;
$$;

comment on function public.route_lms_event(uuid, text, jsonb, uuid) is
  'Given a contact and an LMS product event name, applies the matching lms_event_routes rule: labels the contact and, if the matched route names an active sequence and the contact is contactable, enrols them. Called by lms-webhook. Mirrors route_sequence_click''s hardening (draft/paused sequences, do_not_contact, marketing_status, duplicate/previously-unsubscribed enrolment).';

revoke all on function public.route_lms_event(uuid, text, jsonb, uuid) from public;
grant execute on function public.route_lms_event(uuid, text, jsonb, uuid) to service_role;
grant execute on function public.route_lms_event(uuid, text, jsonb, uuid) to authenticated;
