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
  v_configured text;
begin
  -- An explicit owner, matching CRM_OWNER_USER_ID on the sync function. Without this the
  -- single-user guard below would abort the whole migration chain on any installation that
  -- has more than one account — which the app permits, since sign-up is public — even when
  -- the integration owner is perfectly well known. Set it with:
  --   alter database postgres set app.crm_owner_user_id = '<uuid>';
  v_configured := current_setting('app.crm_owner_user_id', true);

  if v_configured is not null and btrim(v_configured) <> '' then
    v_owner := v_configured::uuid;
    if not exists (select 1 from auth.users where id = v_owner) then
      raise exception 'app.crm_owner_user_id % is not an auth user.', v_owner;
    end if;
  else
    select count(*) into v_users from auth.users;
    if v_users = 0 then
      raise notice 'No auth users; nothing to backfill.';
      return;
    end if;
    if v_users <> 1 then
      raise exception
        'Found % auth users and no app.crm_owner_user_id. Backfill aborted rather than '
        'assigning data to the wrong owner — set that setting and re-run.', v_users;
    end if;
    select id into v_owner from auth.users;
  end if;

  update contacts             set user_id = v_owner where user_id is null;
  update companies            set user_id = v_owner where user_id is null;
  update leads                set user_id = v_owner where user_id is null;
  update activities           set user_id = v_owner where user_id is null;
  update linkedin_connections set user_id = v_owner where user_id is null;
  update linkedin_messages    set user_id = v_owner where user_id is null;
  -- campaigns is written by the same sync and was missed on the first pass: 7 rows were
  -- still orphaned, invisible behind the campaigns RLS policy.
  update campaigns            set user_id = v_owner where user_id is null;

  raise notice 'Backfilled orphaned rows to owner %', v_owner;
end $$;
