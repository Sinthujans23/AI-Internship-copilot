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


-- 20261028000000_cv_analyzer_v2.sql
begin;

create table if not exists public.cv_analysis_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cv_id uuid not null references public.cvs(id) on delete cascade,
  version integer not null check (version in (1, 2)),
  input_hash text not null check (input_hash ~ '^[a-f0-9]{64}$'),
  status text not null check (status in ('running', 'completed', 'failed', 'outdated')),
  result jsonb,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists cv_analysis_owner_created on public.cv_analysis_history(user_id, created_at desc);
create index if not exists cv_analysis_cv_hash on public.cv_analysis_history(cv_id, input_hash, version);
create unique index if not exists cv_analysis_legacy_once on public.cv_analysis_history(cv_id) where version = 1;
alter table public.cv_analysis_history enable row level security;
revoke all on public.cv_analysis_history from anon, authenticated;
grant select on public.cv_analysis_history to authenticated;
drop policy if exists "Read own CV analysis history" on public.cv_analysis_history;
create policy "Read own CV analysis history" on public.cv_analysis_history for select to authenticated
  using (user_id = (select auth.uid()) and exists (select 1 from public.cvs where id = cv_id and user_id = (select auth.uid())));

-- Archive existing v1 reviews once. Keep the original JSON field too.
insert into public.cv_analysis_history(user_id, cv_id, version, input_hash, status, result, finished_at)
select user_id, id, 1, encode(sha256(convert_to(extracted_text, 'UTF8')), 'hex'), 'completed', analysis->'cv_review', now()
from public.cvs where jsonb_typeof(analysis->'cv_review') = 'object'
on conflict do nothing;

-- Persistent, atomic per-user rate limit across serverless instances.
-- Narrow definer functions are the only way authenticated clients mutate history.
create or replace function public.reserve_cv_analysis(p_cv_id uuid, p_hash text, p_force boolean default false)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_user uuid := auth.uid();
  v_text text;
  v_cached public.cv_analysis_history%rowtype;
  v_id uuid;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 17));
  select extracted_text into v_text from public.cvs where id = p_cv_id and user_id = v_user;
  if not found then raise exception 'CV_NOT_FOUND'; end if;
  if length(v_text) < 40 or length(v_text) > 50000 then raise exception 'CV_SIZE_INVALID'; end if;
  if p_hash <> encode(sha256(convert_to(v_text, 'UTF8')), 'hex') then raise exception 'CV_CHANGED'; end if;
  if not p_force then
    select * into v_cached from public.cv_analysis_history where user_id = v_user and cv_id = p_cv_id and version = 2 and input_hash = p_hash and status = 'completed' order by created_at desc limit 1;
    if found then return jsonb_build_object('id', v_cached.id, 'cached', true, 'result', v_cached.result); end if;
  end if;
  if exists (select 1 from public.cv_analysis_history where user_id = v_user and status = 'running' and created_at > now() - interval '2 minutes') then raise exception 'ANALYSIS_BUSY'; end if;
  if (select count(*) from public.cv_analysis_history where user_id = v_user and version = 2 and created_at > now() - interval '1 hour') >= 5 then raise exception 'ANALYSIS_RATE_LIMIT'; end if;
  update public.cv_analysis_history set status = 'failed', finished_at = now() where user_id = v_user and status = 'running' and created_at <= now() - interval '2 minutes';
  insert into public.cv_analysis_history(user_id, cv_id, version, input_hash, status) values(v_user, p_cv_id, 2, p_hash, 'running') returning id into v_id;
  return jsonb_build_object('id', v_id, 'cached', false, 'result', null);
end $$;

create or replace function public.finish_cv_analysis(p_id uuid, p_result jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_user uuid := auth.uid();
  v_run public.cv_analysis_history%rowtype;
  v_text text;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_run from public.cv_analysis_history where id = p_id and user_id = v_user for update;
  if not found or v_run.status <> 'running' then raise exception 'ANALYSIS_NOT_RUNNING'; end if;
  select extracted_text into v_text from public.cvs where id = v_run.cv_id and user_id = v_user for update;
  if not found then raise exception 'CV_NOT_FOUND'; end if;
  if p_result is null then
    update public.cv_analysis_history set status = 'failed', finished_at = now() where id = p_id;
    return jsonb_build_object('status', 'failed');
  end if;
  if p_result->>'version' is distinct from '2' or p_result->>'input_hash' is distinct from v_run.input_hash or
     jsonb_typeof(p_result->'criteria') is distinct from 'object' or jsonb_typeof(p_result->'sections') is distinct from 'array' or
     jsonb_typeof(p_result->'score') is distinct from 'number' or octet_length(p_result::text) > 200000 then raise exception 'INVALID_ANALYSIS'; end if;
  if (p_result->>'score')::numeric < 0 or (p_result->>'score')::numeric > 10 then raise exception 'INVALID_ANALYSIS'; end if;
  -- Preserve the snapshot, but never attach it to changed text as a fresh review.
  if v_run.input_hash <> encode(sha256(convert_to(v_text, 'UTF8')), 'hex') then
    update public.cv_analysis_history set status = 'outdated', result = p_result, finished_at = now() where id = p_id;
    return jsonb_build_object('status', 'outdated');
  end if;
  update public.cv_analysis_history set status = 'completed', result = p_result, finished_at = now() where id = p_id;
  update public.cvs set analysis = coalesce(analysis, '{}'::jsonb) || jsonb_build_object('cv_review_v2', p_result) where id = v_run.cv_id and user_id = v_user;
  return jsonb_build_object('status', 'completed');
end $$;
revoke all on function public.reserve_cv_analysis(uuid,text,boolean) from public, anon;
revoke all on function public.finish_cv_analysis(uuid,jsonb) from public, anon;
grant execute on function public.reserve_cv_analysis(uuid,text,boolean) to authenticated;
grant execute on function public.finish_cv_analysis(uuid,jsonb) to authenticated;
commit;


-- 20261028010000_hybrid_job_matching.sql
begin;
create table if not exists public.job_match_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cv_id uuid not null references public.cvs(id) on delete cascade,
  context_hash text not null check(length(context_hash)=64),
  result jsonb,
  created_at timestamptz not null default now()
);
create index if not exists job_match_runs_owner_idx on public.job_match_runs(user_id, created_at desc);
alter table public.job_match_runs enable row level security;
revoke all on public.job_match_runs from anon, authenticated;
grant select on public.job_match_runs to authenticated;
grant update(result) on public.job_match_runs to authenticated;
drop policy if exists own_job_matches on public.job_match_runs;
create policy own_job_matches on public.job_match_runs for all to authenticated
  using(user_id=(select auth.uid()))
  with check(user_id=(select auth.uid()) and exists(select 1 from public.cvs c where c.id=cv_id and c.user_id=(select auth.uid())));

-- Rate reservations are atomic across server instances. Failed requests count too.
create or replace function public.reserve_job_match(p_cv_id uuid, p_hash text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid := auth.uid(); run_id uuid;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.cvs where id=p_cv_id and user_id=uid) then raise exception 'CV not found'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text || 'job-match',0));
  if (select count(*) from public.job_match_runs where user_id=uid and created_at>now()-interval '1 hour')>=20
    or (select count(*) from public.job_match_runs where user_id=uid and created_at>now()-interval '1 minute')>=3 then
    raise exception 'Job search rate limit reached. Try again later.';
  end if;
  insert into public.job_match_runs(user_id,cv_id,context_hash) values(uid,p_cv_id,p_hash) returning id into run_id;
  return run_id;
end $$;
revoke all on function public.reserve_job_match(uuid,text) from public, anon;
grant execute on function public.reserve_job_match(uuid,text) to authenticated;
commit;


-- 20261028020000_github_intelligence.sql
begin;
create table if not exists public.github_analyses (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 username text not null, repo_name text not null,
 result jsonb not null,
 created_at timestamptz not null default now()
);
create index if not exists github_analysis_owner on public.github_analyses(user_id,created_at desc);
alter table public.github_analyses enable row level security;
revoke all on public.github_analyses from anon,authenticated;
grant select,insert on public.github_analyses to authenticated;
drop policy if exists own_github_analysis on public.github_analyses;
create policy own_github_analysis on public.github_analyses for all to authenticated
 using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

create table if not exists public.github_skill_approvals (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 analysis_id uuid not null references public.github_analyses(id) on delete cascade,
 cv_id uuid not null references public.cvs(id) on delete cascade,
 skill text not null check(length(skill) between 1 and 100),
 approved_at timestamptz not null default now(),
 unique(user_id,analysis_id,cv_id,skill)
);
alter table public.github_skill_approvals enable row level security;
revoke all on public.github_skill_approvals from anon,authenticated;
grant select,insert,delete on public.github_skill_approvals to authenticated;
drop policy if exists own_github_approvals on public.github_skill_approvals;
create policy own_github_approvals on public.github_skill_approvals for all to authenticated
 using(user_id=(select auth.uid())) with check(
 user_id=(select auth.uid()) and exists(select 1 from public.cvs c where c.id=cv_id and c.user_id=(select auth.uid()))
 and exists(select 1 from public.github_analyses a where a.id=analysis_id and a.user_id=(select auth.uid())
 and exists(select 1 from jsonb_array_elements(a.result->'evidence') e where e->>'skill'=skill)));

create table if not exists public.github_request_limits (
 user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now()
);
create index if not exists github_request_owner on public.github_request_limits(user_id,created_at);
alter table public.github_request_limits enable row level security;
revoke all on public.github_request_limits from anon,authenticated;
create or replace function public.reserve_github_request() returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid();
begin
 if uid is null then raise exception 'Authentication required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text||'github',0));
 if (select count(*) from public.github_request_limits where user_id=uid and created_at>now()-interval '1 hour')>=30 then
 raise exception 'GitHub request limit reached. Retry later.'; end if;
 insert into public.github_request_limits(user_id) values(uid);
end $$;
revoke all on function public.reserve_github_request() from public,anon;
grant execute on function public.reserve_github_request() to authenticated;
commit;
