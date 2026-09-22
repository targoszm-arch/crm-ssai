-- Both LMS Event Routing and Click Routing can label a contact without enrolling them
-- ("label only"), and a route can be reconfigured later to add a sequence. Until now there
-- was no way to catch up people who matched before that sequence was attached — the UI
-- could show "1 person matched" and nothing else could be done about it.
--
-- backfill_route_enrollments enrols a given set of already-matched contacts into a given
-- sequence, applying the exact same guard chain route_lms_event and route_sequence_click
-- already use for a live match, so a manual "Enrol matched now" click can never do
-- something a real-time match wouldn't have done.

create or replace function public.backfill_route_enrollments(
  p_contact_ids uuid[],
  p_sequence_id uuid,
  p_source      text default 'manual_route_backfill',
  p_route_id    uuid default null,
  p_topic       text default null,
  p_label       text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sequence   sequences%rowtype;
  v_contact_id uuid;
  v_contact    contacts%rowtype;
  v_skipped    text;
  v_enrolled   integer := 0;
  v_skip_counts jsonb := '{}'::jsonb;
begin
  if p_contact_ids is null or array_length(p_contact_ids, 1) is null then
    return jsonb_build_object('enrolled', 0, 'skipped', '{}'::jsonb, 'total', 0);
  end if;

  select * into v_sequence from sequences where id = p_sequence_id;
  if v_sequence.id is null then
    return jsonb_build_object('enrolled', 0, 'skipped',
      jsonb_build_object('sequence_missing', array_length(p_contact_ids, 1)),
      'total', array_length(p_contact_ids, 1));
  end if;
  if coalesce(v_sequence.status, 'draft') <> 'active' then
    return jsonb_build_object('enrolled', 0, 'skipped',
      jsonb_build_object('sequence_not_active_' || coalesce(v_sequence.status, 'draft'), array_length(p_contact_ids, 1)),
      'total', array_length(p_contact_ids, 1));
  end if;

  foreach v_contact_id in array p_contact_ids loop
    v_skipped := null;
    select * into v_contact from contacts where id = v_contact_id;

    if v_contact.id is null then
      v_skipped := 'contact_not_found';
    elsif coalesce(v_contact.do_not_contact, false) then
      v_skipped := 'do_not_contact';
    elsif v_contact.email is null or btrim(v_contact.email) = '' then
      v_skipped := 'contact_has_no_email';
    elsif lower(coalesce(v_contact.marketing_status, '')) in
          ('unsubscribed', 'bounced', 'do not contact', 'do_not_contact', 'complained') then
      v_skipped := 'marketing_status_' || lower(v_contact.marketing_status);
    elsif exists (
      select 1 from sequence_enrollments e
      where e.contact_id = v_contact_id
        and lower(e.status) in ('unsubscribed', 'bounced')
    ) then
      v_skipped := 'previously_unsubscribed_or_bounced';
    elsif exists (
      select 1 from sequence_enrollments e
      where e.contact_id = v_contact_id
        and e.sequence_id = p_sequence_id
        and lower(coalesce(e.status, 'active')) in ('active', 'completed')
    ) then
      v_skipped := 'already_enrolled';
    else
      insert into sequence_enrollments (
        sequence_id, contact_id, current_step, status, enrolled_at, next_email_at, metadata, user_id
      ) values (
        p_sequence_id, v_contact_id, 0, 'active', now(), now(),
        jsonb_build_object(
          'source', p_source, 'route_id', p_route_id, 'topic', p_topic, 'label', p_label
        ),
        coalesce(v_contact.user_id, v_sequence.user_id)
      );
      v_enrolled := v_enrolled + 1;
    end if;

    if v_skipped is not null then
      v_skip_counts := jsonb_set(
        v_skip_counts, array[v_skipped],
        to_jsonb(coalesce((v_skip_counts ->> v_skipped)::int, 0) + 1)
      );
    end if;
  end loop;

  return jsonb_build_object(
    'enrolled', v_enrolled, 'skipped', v_skip_counts, 'total', array_length(p_contact_ids, 1)
  );
end;
$$;

comment on function public.backfill_route_enrollments(uuid[], uuid, text, uuid, text, text) is
  'Enrols an already-matched set of contacts (from a click route or LMS event route) into a sequence, applying the same guard chain as a live route match. Used by the "Enrol matched now" action once a label-only route is later given a sequence.';

revoke all on function public.backfill_route_enrollments(uuid[], uuid, text, uuid, text, text) from public;
grant execute on function public.backfill_route_enrollments(uuid[], uuid, text, uuid, text, text) to authenticated;
grant execute on function public.backfill_route_enrollments(uuid[], uuid, text, uuid, text, text) to service_role;
