-- Fire course-built-lifecycle when a course appears, and again when its generation ends.
--
-- Deliberately modelled on notify_user_signed_up(), which is the pattern already proven in
-- this database: vault for the secret and base URL, GUC-free fallback to the project URL,
-- pg_net fire-and-forget, and every failure downgraded to a WARNING. The one rule that
-- matters is the same one: a trigger on the critical path must never be able to fail the
-- write that fired it. Somebody's course must save whether or not Resend is reachable.

create or replace function public.notify_course_built()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  webhook_secret text;
  fn_url text;
  v_course_id uuid;
begin
  -- Which column carries the course id depends on which table fired.
  if tg_table_name = 'courses' then
    v_course_id := new.id;
  else
    v_course_id := new.course_id;
  end if;

  if v_course_id is null then
    return new;
  end if;

  begin
    select decrypted_secret into webhook_secret
    from vault.decrypted_secrets where name = 'app.webhook_signup_secret' limit 1;
  exception when others then webhook_secret := null; end;

  begin
    select decrypted_secret into fn_url
    from vault.decrypted_secrets where name = 'app.edge_functions_base_url' limit 1;
  exception when others then fn_url := null; end;

  if fn_url is null then
    fn_url := 'https://oxlujbymtjugefaqmwuy.supabase.co/functions/v1';
  end if;

  begin
    perform net.http_post(
      url := fn_url || '/course-built-lifecycle',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', coalesce(webhook_secret, '')
      ),
      body := jsonb_build_object(
        'type', tg_op,
        'schema', 'public',
        'table', tg_table_name,
        'record', jsonb_build_object(
          'id', case when tg_table_name = 'courses' then new.id else null end,
          'course_id', v_course_id
        )
      )
    );
  exception when others then
    raise warning 'notify_course_built failed: %', sqlerrm;
  end;

  return new;
end;
$function$;

comment on function public.notify_course_built() is
  'Fires course-built-lifecycle over pg_net. Never raises — a failed notification must not fail the course write.';


-- INSERT ONLY on courses. An UPDATE trigger here would fire on every title edit, theme
-- change and autosave across 726 rows, which is the "hammer the Resend API" failure the
-- spec warns about. At insert the counts are still 0 and only the title is real; the
-- generation trigger below is what carries the numbers.
drop trigger if exists trg_course_built_on_insert on public.courses;
create trigger trg_course_built_on_insert
  after insert on public.courses
  for each row
  execute function public.notify_course_built();


-- The second event, and the one that actually matters: generation finishing is when a
-- course stops being an empty shell. WHEN-guarded on the transition into 'completed', so
-- the heartbeat and progress updates that touch this row constantly do not fire it —
-- course_generation_jobs is written to on every page of a generation run.
drop trigger if exists trg_course_built_on_generation_complete on public.course_generation_jobs;
create trigger trg_course_built_on_generation_complete
  after update on public.course_generation_jobs
  for each row
  when (new.status = 'completed' and old.status is distinct from 'completed')
  execute function public.notify_course_built();
