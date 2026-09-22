-- Bulk contact merge: several duplicate contacts (same person, different LMS
-- signup emails, different LinkedIn imports, etc.) collapse into one survivor.
-- Every table with a contact_id FK gets that FK reassigned to the survivor
-- before the loser row is deleted, so nothing linked to a loser is orphaned
-- or destroyed. A full snapshot of each loser row is kept in
-- contacts_merge_backups so a bad merge can be inspected or reversed by hand.
create table if not exists contacts_merge_backups (
  id uuid primary key default gen_random_uuid(),
  loser_contact jsonb not null,
  survivor_id uuid not null,
  user_id uuid not null,
  merged_at timestamptz not null default now()
);

alter table contacts_merge_backups enable row level security;

create policy "Users can view their own merge backups"
  on contacts_merge_backups for select
  using (auth.uid() = user_id);

create or replace function merge_contacts(p_survivor_id uuid, p_loser_ids uuid[], p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_loser_id uuid;
  v_loser_row jsonb;
  v_merged_count int := 0;
begin
  if p_survivor_id is null or p_loser_ids is null or array_length(p_loser_ids, 1) is null then
    raise exception 'survivor and loser ids are required';
  end if;

  if not exists (select 1 from contacts where id = p_survivor_id and user_id = p_user_id) then
    raise exception 'Survivor contact not found for this user';
  end if;

  if p_survivor_id = any(p_loser_ids) then
    raise exception 'Survivor cannot also be a loser';
  end if;

  if exists (
    select 1 from unnest(p_loser_ids) as loser_id
    where not exists (select 1 from contacts c where c.id = loser_id and c.user_id = p_user_id)
  ) then
    raise exception 'One or more contacts to merge were not found for this user';
  end if;

  foreach v_loser_id in array p_loser_ids loop
    update activities set contact_id = p_survivor_id where contact_id = v_loser_id;
    update calendar_events set contact_id = p_survivor_id where contact_id = v_loser_id;
    update crm_files set contact_id = p_survivor_id where contact_id = v_loser_id;
    update deals set contact_id = p_survivor_id where contact_id = v_loser_id;
    update email_tracking_events set contact_id = p_survivor_id where contact_id = v_loser_id;
    update emails set contact_id = p_survivor_id where contact_id = v_loser_id;
    update leads set contact_id = p_survivor_id where contact_id = v_loser_id;
    update linkedin_connections set contact_id = p_survivor_id where contact_id = v_loser_id;
    update list_members set contact_id = p_survivor_id where contact_id = v_loser_id;
    update lms_leads set contact_id = p_survivor_id where contact_id = v_loser_id;
    update meeting_notes set contact_id = p_survivor_id where contact_id = v_loser_id;
    update newsletter_recipients set contact_id = p_survivor_id where contact_id = v_loser_id;
    update sales_opportunities set contact_id = p_survivor_id where contact_id = v_loser_id;
    update sequence_enrollments set contact_id = p_survivor_id where contact_id = v_loser_id;
    update tasks set contact_id = p_survivor_id where contact_id = v_loser_id;

    select to_jsonb(c.*) into v_loser_row from contacts c where c.id = v_loser_id;
    insert into contacts_merge_backups (loser_contact, survivor_id, user_id)
      values (v_loser_row, p_survivor_id, p_user_id);

    delete from contacts where id = v_loser_id;
    v_merged_count := v_merged_count + 1;
  end loop;

  return jsonb_build_object('survivor_id', p_survivor_id, 'merged_count', v_merged_count);
end;
$$;

grant execute on function merge_contacts(uuid, uuid[], uuid) to authenticated;
