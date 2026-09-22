-- contacts.last_contacted was a display-only column nobody wrote to after
-- import -- every real touch (an email synced in either direction, a
-- LinkedIn/meetalfred event, a manual note) landed in emails/activities and
-- never fed back into it. These triggers make it a live fact instead of a
-- frozen import snapshot, the same class of bug as done_activities/
-- email_messages_count documented in CLAUDE.md.
create or replace function public.touch_contact_last_contacted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  touched_at timestamptz;
begin
  if new.contact_id is null then
    return new;
  end if;

  if TG_TABLE_NAME = 'emails' then
    touched_at := new.received_at;
  else
    touched_at := coalesce(new.occurred_at, new.created_at);
  end if;

  if touched_at is null then
    return new;
  end if;

  update public.contacts
  set last_contacted = greatest(coalesce(last_contacted, touched_at), touched_at)
  where id = new.contact_id;

  return new;
end;
$$;

create trigger emails_touch_last_contacted
  after insert on public.emails
  for each row execute function public.touch_contact_last_contacted();

create trigger activities_touch_last_contacted
  after insert on public.activities
  for each row execute function public.touch_contact_last_contacted();
