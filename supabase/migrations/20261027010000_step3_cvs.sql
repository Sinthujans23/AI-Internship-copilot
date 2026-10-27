begin;
create table if not exists public.cvs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_path text not null unique,
  file_name text not null,
  extracted_text text not null,
  skills text[] not null default '{}',
  analysis jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.cvs add column if not exists skills text[] not null default '{}';
create index if not exists cvs_user_created_idx on public.cvs(user_id, created_at desc);
alter table public.cvs enable row level security;
grant select, insert, update, delete on public.cvs to authenticated;
revoke all on public.cvs from anon;
drop policy if exists "Users manage their own CVs" on public.cvs;
create policy "Users manage their own CVs" on public.cvs for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- A private PDF bucket; browser uploads use <user_id>/<random_id>.pdf paths.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('cvs', 'cvs', false, 4194304, array['application/pdf'])
on conflict(id) do update set public = false, file_size_limit = 4194304, allowed_mime_types = array['application/pdf'];
drop policy if exists "Users access own CV files" on storage.objects;
create policy "Users access own CV files" on storage.objects for all to authenticated
  using (bucket_id = 'cvs' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'cvs' and (storage.foldername(name))[1] = (select auth.uid())::text);
commit;
