-- meetalfred-sync wrote contacts, leads, activities, linkedin_connections and
-- linkedin_messages without ever setting user_id. Every one of those tables carries an RLS
-- policy of auth.uid() = user_id, and the function runs with the service role — so the rows
-- were written successfully and were then invisible to the only account entitled to see them.
--
-- What that looked like from the app: the newest LinkedIn message the Inbox could show was
-- dated 30 January, while the sync had been writing right up to the present day. It read as
-- "LinkedIn hasn't synced in seven months". The sync was fine; the reader could not see it.
--
-- Hidden at the time of this backfill:
--   activities            61,061 of 63,368   (96%)
--   leads                  9,138 of 10,438   (88%)
--   linkedin_connections   1,537 of 1,724    (89%)
--   linkedin_messages        381 of 583      (65%)
--   contacts               2,310 of 5,809    (40%)
--
-- The companion fix is in the function itself, which now stamps the owner on every write.
-- Without that this backfill would be undone by the next 09:00 run.
do $$
declare
  v_owner uuid;
  v_users int;
begin
  select count(*) into v_users from auth.users;
  if v_users = 0 then
    raise notice 'No auth users; nothing to backfill.';
    return;
  end if;
  if v_users <> 1 then
    raise exception 'Expected exactly one auth user, found %. Backfill aborted — the owner is not unambiguous.', v_users;
  end if;
  select id into v_owner from auth.users;

  update contacts             set user_id = v_owner where user_id is null;
  update companies            set user_id = v_owner where user_id is null;
  update leads                set user_id = v_owner where user_id is null;
  update activities           set user_id = v_owner where user_id is null;
  update linkedin_connections set user_id = v_owner where user_id is null;
  update linkedin_messages    set user_id = v_owner where user_id is null;

  raise notice 'Backfilled orphaned rows to owner %', v_owner;
end $$;
