-- Hardens route_sequence_click against three problems found in review.
--
-- 1. It would enrol into a DRAFT sequence. Every sequence ported from Kit is a draft with
--    empty templates, so a click could create an active enrolment due immediately, and the
--    next process-sequences run would send it with the "Message from us" fallback subject —
--    the exact failure this CRM already has seven examples of.
--
-- 2. Its tenant predicate treated a null p_user_id as "consider every tenant's routes".
--    track-sequence-click calls it without one, so a click could match another owner's
--    route and, being security definer, create an enrolment owned by that other owner.
--    The owner now falls back to the contact's own user_id.
--
-- 3. contacts.do_not_contact was added and documented as hard suppression, but nothing
--    read it. A flag that stops nothing is worse than no flag, because it looks like a
--    guarantee. It is now checked here, ahead of marketing_status.

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
  v_owner         uuid;
  v_existing      text[];
  v_label_added   boolean := false;
  v_enrollment_id uuid;
  v_skipped       text;
  v_sequence      sequences%rowtype;
begin
  if p_contact_id is null or p_link_url is null or btrim(p_link_url) = '' then
    return jsonb_build_object('matched', false, 'reason', 'missing_input');
  end if;

  select * into v_contact from contacts where id = p_contact_id;
  if not found then
    return jsonb_build_object('matched', false, 'reason', 'contact_not_found');
  end if;

  -- Never "any tenant". A caller that does not name an owner gets the contact's own.
  v_owner := coalesce(p_user_id, v_contact.user_id);

  select * into v_route
  from sequence_click_routes r
  where r.is_active
    and (r.user_id is null or r.user_id = v_owner)
    and p_link_url ilike '%' || r.match_pattern || '%'
  order by r.priority desc, length(r.match_pattern) desc, r.created_at
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
        'source', 'click_route', 'route_id', v_route.id,
        'topic', v_route.topic, 'label', v_route.label, 'link_url', p_link_url
      ),
      coalesce(v_route.user_id, v_owner)
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
             '" and enrolled in ' || coalesce(v_sequence.name, 'the follow-on sequence')
      else 'Clicked ' || v_route.topic || ' — labelled "' || v_route.label ||
           '", not enrolled (' || coalesce(v_skipped, 'unknown') || ')'
    end,
    'click_route',
    jsonb_build_object(
      'route_id', v_route.id, 'topic', v_route.topic, 'label', v_route.label,
      'label_added', v_label_added, 'link_url', p_link_url,
      'enrollment_id', v_enrollment_id, 'skipped', v_skipped
    ),
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
