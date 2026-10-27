-- Paste this ENTIRE file into Supabase SQL Editor and Run.
-- Creates/upgrades the supported schema without deleting your application/CV rows.

-- 20261026000000_step1_applications.sql
-- Run this entire file in your Supabase project's SQL Editor.
begin;

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company text not null check (length(trim(company)) between 1 and 200),
  role text not null check (length(trim(role)) between 1 and 200),
  status text not null default 'Applied'
    check (status in ('Applied', 'Interview', 'Rejected', 'Offer')),
  job_text text not null default '' check (length(job_text) <= 20000),
  -- Leave this null until the matching service computes a real score.
  match_score integer check (match_score between 0 and 100),
  created_at timestamptz not null default now()
);

-- Preserve rows if the earlier prototype schema was already installed.
alter table public.applications add column if not exists job_text text not null default '';
-- Safe to rerun if you applied the earlier version of the Step 1 SQL.
alter table public.applications add column if not exists match_score integer
  check (match_score between 0 and 100);
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'applications' and column_name = 'description') then
    update public.applications set job_text = description where job_text = '';
    alter table public.applications alter column description set default '';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'applications' and column_name = 'match_score') then
    alter table public.applications alter column match_score drop not null;
  end if;
end $$;

create index if not exists applications_user_created_idx
  on public.applications (user_id, created_at desc);

alter table public.applications enable row level security;
grant select, insert, update, delete on public.applications to authenticated;
revoke all on public.applications from anon;

-- USING protects existing rows; WITH CHECK protects inserted/updated values.
drop policy if exists "Users manage their own applications" on public.applications;
create policy "Users manage their own applications"
  on public.applications for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

commit;


-- 20261027000000_step2_job_analysis.sql
-- Existing application ownership policies apply to this new column.
alter table public.applications add column if not exists job_analysis jsonb;


-- 20261027010000_step3_cvs.sql
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


-- 20261027020000_step4_matching.sql
alter table public.applications add column if not exists match_result jsonb;


-- 20261027030000_step5_agent.sql
-- Includes job/match snapshots, three bullets, email, CV identity, and timestamp.
alter table public.applications add column if not exists agent_result jsonb;


-- 20261027050000_company_research.sql
begin;
create table if not exists public.career_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferences jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.company_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cv_id uuid references public.cvs(id) on delete set null,
  source_url text not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists company_reports_user_created_idx on public.company_reports(user_id, created_at desc);
alter table public.career_preferences enable row level security;
alter table public.company_reports enable row level security;
grant select, insert, update, delete on public.career_preferences, public.company_reports to authenticated;
revoke all on public.career_preferences, public.company_reports from anon;
drop policy if exists "Own career preferences" on public.career_preferences;
create policy "Own career preferences" on public.career_preferences for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Own company reports" on public.company_reports;
create policy "Own company reports" on public.company_reports for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
commit;
