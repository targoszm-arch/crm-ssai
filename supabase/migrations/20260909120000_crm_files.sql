-- Files attached to people and companies.
--
-- One row per file, and both keys are filled at upload time: a file uploaded
-- against a person carries that person's company_id too. So each tab is a
-- single-column query and the sharing the CRM needs — a proposal filed on Dan
-- also showing on Grocerix — costs no joins and no inheritance logic.
create table if not exists public.crm_files (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid(),
  contact_id  uuid references public.contacts(id) on delete cascade,
  company_id  uuid references public.companies(id) on delete cascade,
  name        text not null,
  path        text not null unique,
  mime_type   text,
  size_bytes  bigint,
  created_at  timestamptz not null default now(),
  constraint crm_files_has_owner check (contact_id is not null or company_id is not null)
);

create index if not exists idx_crm_files_contact on public.crm_files (contact_id, created_at desc);
create index if not exists idx_crm_files_company on public.crm_files (company_id, created_at desc);

alter table public.crm_files enable row level security;

create policy "Users can read own files" on public.crm_files
  for select to authenticated using (auth.uid() = user_id);
create policy "Users can insert own files" on public.crm_files
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can update own files" on public.crm_files
  for update to authenticated using (auth.uid() = user_id);
create policy "Users can delete own files" on public.crm_files
  for delete to authenticated using (auth.uid() = user_id);

-- Private bucket: these are customer documents, read through signed URLs.
insert into storage.buckets (id, name, public, file_size_limit)
values ('crm-files', 'crm-files', false, 26214400)
on conflict (id) do nothing;

-- Objects are keyed <user_id>/<uuid>-<filename>, so the first path segment is
-- the owner and that is what the policies check.
create policy "Users read own crm files" on storage.objects
  for select to authenticated
  using (bucket_id = 'crm-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users upload own crm files" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'crm-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users delete own crm files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'crm-files' and (storage.foldername(name))[1] = auth.uid()::text);
