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


-- 20261028030000_company_rag.sql
begin;
create schema if not exists extensions;
create extension if not exists vector with schema extensions;
grant usage on schema extensions to authenticated;
create table if not exists public.company_rag_sessions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 source_url text not null, created_at timestamptz not null default now(), unique(id,user_id)
);
create table if not exists public.company_rag_documents (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 session_id uuid not null, source_url text not null, title text not null, source_index integer not null check(source_index between 0 and 2),
 source_kind text not null check(source_kind in ('primary','related')), retrieved_at timestamptz not null,
 unique(id,user_id,session_id), foreign key(session_id,user_id) references public.company_rag_sessions(id,user_id) on delete cascade
);
create table if not exists public.company_rag_chunks (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 session_id uuid not null, document_id uuid not null, ordinal integer not null check(ordinal>=0),
 content text not null check(length(content) between 1 and 3000), content_hash text not null check(length(content_hash)=64),
 embedding extensions.vector not null check(extensions.vector_dims(embedding) between 1 and 3072 and extensions.vector_norm(embedding)>0), embedding_model text not null,
 foreign key(document_id,user_id,session_id) references public.company_rag_documents(id,user_id,session_id) on delete cascade,
 unique(document_id,ordinal)
);
create index if not exists company_rag_session_owner on public.company_rag_sessions(user_id,created_at desc);
create index if not exists company_rag_chunks_scope on public.company_rag_chunks(user_id,session_id,embedding_model);
alter table public.company_rag_sessions enable row level security;
alter table public.company_rag_documents enable row level security;
alter table public.company_rag_chunks enable row level security;
revoke all on public.company_rag_sessions,public.company_rag_documents,public.company_rag_chunks from anon,authenticated;
grant select on public.company_rag_sessions to authenticated;
grant select,insert on public.company_rag_documents,public.company_rag_chunks to authenticated;
drop policy if exists own_rag_sessions on public.company_rag_sessions;
create policy own_rag_sessions on public.company_rag_sessions for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists own_rag_documents on public.company_rag_documents;
create policy own_rag_documents on public.company_rag_documents for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
drop policy if exists own_rag_chunks on public.company_rag_chunks;
create policy own_rag_chunks on public.company_rag_chunks for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create or replace function public.reserve_company_rag(p_url text) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); sid uuid;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 if length(p_url)>2000 or p_url not like 'https://%' then raise exception 'Invalid URL'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text||'company-rag',0));
 if (select count(*) from public.company_rag_sessions where user_id=uid and created_at>now()-interval '1 hour')>=5 then raise exception 'Research rate limit reached'; end if;
 insert into public.company_rag_sessions(user_id,source_url) values(uid,p_url) returning id into sid;return sid;
end $$;
revoke all on function public.reserve_company_rag(text) from public,anon;
grant execute on function public.reserve_company_rag(text) to authenticated;

-- Exact cosine search within a small snapshot. Filter ownership, model and source BEFORE LIMIT.
-- Variable dimensions permit existing configured embedding models without mixing vector spaces.
create or replace function public.retrieve_company_chunks(p_session uuid,p_model text,p_vector text,p_document uuid default null,p_limit integer default 12)
returns table(id uuid,document_id uuid,source_index integer,source_url text,retrieved_at timestamptz,ordinal integer,content text,content_hash text,similarity double precision)
language sql stable security invoker set search_path=public,extensions,pg_temp as $$
 select c.id,c.document_id,d.source_index,d.source_url,d.retrieved_at,c.ordinal,c.content,c.content_hash,
  1-(c.embedding OPERATOR(extensions.<=>) p_vector::extensions.vector) as similarity
 from public.company_rag_chunks c join public.company_rag_documents d on d.id=c.document_id and d.user_id=c.user_id
 where c.user_id=auth.uid() and c.session_id=p_session and c.embedding_model=p_model
  and extensions.vector_dims(c.embedding)=extensions.vector_dims(p_vector::extensions.vector)
  and (p_document is null or c.document_id=p_document)
 order by c.embedding OPERATOR(extensions.<=>) p_vector::extensions.vector,c.id
 limit greatest(1,least(p_limit,20));
$$;
revoke all on function public.retrieve_company_chunks(uuid,text,text,uuid,integer) from public,anon;
grant execute on function public.retrieve_company_chunks(uuid,text,text,uuid,integer) to authenticated;
commit;


-- 20261028040000_learning_roadmaps.sql
begin;
create table if not exists public.learning_roadmaps (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 cv_id uuid references public.cvs(id) on delete set null, target_role text not null check(length(target_role) between 2 and 120),
 weeks integer not null check(weeks between 1 and 12), weekly_hours integer not null check(weekly_hours between 1 and 20),
 summary text not null, context jsonb not null, mode text not null check(mode in ('AI','deterministic')),
 parent_id uuid references public.learning_roadmaps(id), created_at timestamptz not null default now(), unique(id,user_id)
);
create table if not exists public.learning_tasks (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 roadmap_id uuid not null, week integer not null check(week between 1 and 12), milestone text not null,
 details jsonb not null, status text not null default 'Not Started' check(status in ('Not Started','In Progress','Completed')),
 notes text not null default '' check(length(notes)<=1500), evidence_url text check(length(evidence_url)<=2000 and evidence_url like 'https://%'),
 updated_at timestamptz not null default clock_timestamp(),
 foreign key(roadmap_id,user_id) references public.learning_roadmaps(id,user_id) on delete cascade
);
create table if not exists public.learning_advice (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 roadmap_id uuid not null, progress_hash text not null, result jsonb not null, mode text not null,
 created_at timestamptz not null default now(), foreign key(roadmap_id,user_id) references public.learning_roadmaps(id,user_id) on delete cascade
);
create table if not exists public.learning_requests(user_id uuid not null references auth.users(id) on delete cascade,created_at timestamptz not null default now());
create index if not exists learning_owner_created on public.learning_roadmaps(user_id,created_at desc);
create index if not exists learning_tasks_owner on public.learning_tasks(user_id,roadmap_id);
create index if not exists learning_request_owner on public.learning_requests(user_id,created_at);
alter table public.learning_roadmaps enable row level security;
alter table public.learning_tasks enable row level security;
alter table public.learning_advice enable row level security;
alter table public.learning_requests enable row level security;
revoke all on public.learning_roadmaps,public.learning_tasks,public.learning_advice,public.learning_requests from anon,authenticated;
grant select on public.learning_roadmaps,public.learning_tasks to authenticated;
grant select,insert on public.learning_advice to authenticated;
drop policy if exists own_learning_plans on public.learning_roadmaps;
create policy own_learning_plans on public.learning_roadmaps for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists own_learning_tasks on public.learning_tasks;
create policy own_learning_tasks on public.learning_tasks for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists own_learning_advice on public.learning_advice;
create policy own_learning_advice on public.learning_advice for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

create or replace function public.reserve_learning_request() returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid();begin
 if uid is null then raise exception 'Authentication required';end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text||'learning',0));
 if (select count(*) from public.learning_requests where user_id=uid and created_at>now()-interval '1 hour')>=10 then raise exception 'Learning request limit reached';end if;
 insert into public.learning_requests(user_id) values(uid);
end $$;

-- A complete new version is saved atomically. Existing task rows are never replaced.
create or replace function public.save_learning_roadmap(p_input jsonb,p_context jsonb,p_plan jsonb,p_mode text,p_parent uuid default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); cid uuid:=(p_context->>'cv_id')::uuid; rid uuid; w jsonb;t jsonb; expected integer:=1;minutes integer;
begin
 if uid is null then raise exception 'Authentication required';end if;
 if not exists(select 1 from public.cvs where id=cid and user_id=uid) then raise exception 'CV not found';end if;
 if p_parent is not null and not exists(select 1 from public.learning_roadmaps where id=p_parent and user_id=uid) then raise exception 'Roadmap not found';end if;
 if jsonb_typeof(p_plan->'weeks') is distinct from 'array' or jsonb_array_length(p_plan->'weeks')<>(p_input->>'weeks')::integer then raise exception 'Invalid weeks';end if;
 insert into public.learning_roadmaps(user_id,cv_id,target_role,weeks,weekly_hours,summary,context,mode,parent_id)
 values(uid,cid,p_input->>'target_role',(p_input->>'weeks')::integer,(p_input->>'weekly_hours')::integer,p_plan->>'summary',p_context,p_mode,p_parent) returning id into rid;
 for w in select value from jsonb_array_elements(p_plan->'weeks') loop
  if (w->>'week')::integer<>expected or jsonb_typeof(w->'tasks') is distinct from 'array' or jsonb_array_length(w->'tasks') not between 1 and 3 then raise exception 'Invalid task schedule';end if;
  minutes:=0;
  for t in select value from jsonb_array_elements(w->'tasks') loop
   if (t->>'minutes') is null or (t->>'minutes')::integer not between 15 and 1020 or jsonb_typeof(t->'checks') is distinct from 'array' or jsonb_array_length(t->'checks')<2 then raise exception 'Invalid task';end if;
   minutes:=minutes+(t->>'minutes')::integer;
   insert into public.learning_tasks(user_id,roadmap_id,week,milestone,details) values(uid,rid,expected,w->>'milestone',t);
  end loop;
  if minutes>floor((p_input->>'weekly_hours')::integer*60*0.85) then raise exception 'Weekly budget exceeded';end if;
  expected:=expected+1;
 end loop;
 return rid;
end $$;

-- Optimistic concurrency prevents an old tab from silently overwriting newer progress.
create or replace function public.update_learning_task(p_id uuid,p_status text,p_notes text,p_url text,p_expected timestamptz)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare current_task public.learning_tasks%rowtype;begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 select * into current_task from public.learning_tasks where id=p_id and user_id=auth.uid() for update;
 if not found then raise exception 'Task not found';end if;
 if current_task.updated_at is distinct from p_expected then raise exception 'Progress changed; refresh before saving';end if;
 update public.learning_tasks set status=p_status,notes=p_notes,evidence_url=p_url,updated_at=clock_timestamp() where id=p_id;
end $$;
revoke all on function public.reserve_learning_request() from public,anon;
revoke all on function public.save_learning_roadmap(jsonb,jsonb,jsonb,text,uuid) from public,anon;
revoke all on function public.update_learning_task(uuid,text,text,text,timestamptz) from public,anon;
grant execute on function public.reserve_learning_request() to authenticated;
grant execute on function public.save_learning_roadmap(jsonb,jsonb,jsonb,text,uuid) to authenticated;
grant execute on function public.update_learning_task(uuid,text,text,text,timestamptz) to authenticated;
commit;


-- 20261029000000_application_tracker.sql
begin;
-- Extend the existing tracker; preserve every application and its original stage.
alter table public.applications drop constraint if exists applications_status_check;
alter table public.applications add constraint applications_status_check check (status in ('Saved','Applied','Assessment','Interview','Offer','Rejected','Withdrawn'));
alter table public.applications add column if not exists job_url text check (length(job_url)<=2000 and job_url ~ '^https?://');
alter table public.applications add column if not exists notes text not null default '' check (length(notes)<=10000);
alter table public.applications add column if not exists application_date date;
alter table public.applications add column if not exists interview_date date;
alter table public.applications add column if not exists follow_up_date date;
alter table public.applications add column if not exists cv_id uuid references public.cvs(id) on delete set null;
alter table public.applications add column if not exists company_report_id uuid references public.company_reports(id) on delete set null;
create unique index if not exists applications_owner_job_url on public.applications(user_id,job_url) where job_url is not null;

create table if not exists public.application_history (
 id uuid primary key default gen_random_uuid(),
 application_id uuid not null references public.applications(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 old_status text, new_status text not null, event text not null,
 created_at timestamptz not null default now()
);
create index if not exists application_history_owner on public.application_history(user_id,application_id,created_at);
alter table public.application_history enable row level security;
revoke all on public.application_history from anon, authenticated;
grant select on public.application_history to authenticated;
drop policy if exists "Read own application history" on public.application_history;
create policy "Read own application history" on public.application_history for select to authenticated using (user_id=(select auth.uid()));

-- A trigger enforces linked-record ownership even for direct database clients.
create or replace function public.audit_application() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if TG_OP='UPDATE' and new.user_id<>old.user_id then raise exception 'OWNER_IMMUTABLE'; end if;
 if new.cv_id is not null and not exists(select 1 from public.cvs where id=new.cv_id and user_id=new.user_id) then raise exception 'CV_NOT_FOUND'; end if;
 if new.company_report_id is not null and not exists(select 1 from public.company_reports where id=new.company_report_id and user_id=new.user_id) then raise exception 'REPORT_NOT_FOUND'; end if;
 if TG_OP='INSERT' then
   insert into public.application_history(application_id,user_id,new_status,event) values(new.id,new.user_id,new.status,'Created');
 elsif new.status is distinct from old.status then
   insert into public.application_history(application_id,user_id,old_status,new_status,event) values(new.id,new.user_id,old.status,new.status,'Stage changed');
 elsif (new.company,new.role,new.notes,new.job_url,new.application_date,new.interview_date,new.follow_up_date,new.cv_id,new.company_report_id) is distinct from (old.company,old.role,old.notes,old.job_url,old.application_date,old.interview_date,old.follow_up_date,old.cv_id,old.company_report_id) then
   insert into public.application_history(application_id,user_id,old_status,new_status,event) values(new.id,new.user_id,old.status,new.status,'Details edited');
 end if;
 return new;
end $$;
revoke all on function public.audit_application() from public,anon,authenticated;
drop trigger if exists application_audit on public.applications;
create trigger application_audit after insert or update on public.applications for each row execute function public.audit_application();
-- Existing rows get an honest baseline, not invented historical transitions.
insert into public.application_history(application_id,user_id,new_status,event)
select a.id,a.user_id,a.status,'Tracking enabled (earlier history unavailable)' from public.applications a
where not exists(select 1 from public.application_history h where h.application_id=a.id);
commit;


-- 20261029010000_cv_tailoring.sql
begin;
create table if not exists public.cv_tailoring (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 cv_id uuid not null references public.cvs(id) on delete cascade,
 application_id uuid not null references public.applications(id) on delete cascade,
 result jsonb not null, decisions jsonb not null default '{}',created_at timestamptz not null default now()
);
alter table public.cv_tailoring enable row level security;
revoke all on public.cv_tailoring from anon,authenticated;
grant select,insert on public.cv_tailoring to authenticated;
drop policy if exists "Read owned tailoring" on public.cv_tailoring;
create policy "Read owned tailoring" on public.cv_tailoring for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists "Create owned tailoring" on public.cv_tailoring;
create policy "Create owned tailoring" on public.cv_tailoring for insert to authenticated with check(user_id=(select auth.uid()) and decisions='{}'::jsonb and exists(select 1 from public.cvs c where c.id=cv_id and c.user_id=(select auth.uid())) and exists(select 1 from public.applications a where a.id=application_id and a.user_id=(select auth.uid())));
create index if not exists tailoring_owner_created on public.cv_tailoring(user_id,created_at desc);
create or replace function public.decide_tailoring_suggestion(p_id uuid,p_index integer,p_decision text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null or p_decision not in ('accepted','rejected') or p_index<0 then raise exception 'INVALID_DECISION'; end if;
 update public.cv_tailoring set decisions=jsonb_set(decisions,array[p_index::text],to_jsonb(p_decision)) where id=p_id and user_id=auth.uid() and p_index<jsonb_array_length(result->'suggestions');
 if not found then raise exception 'SUGGESTION_NOT_FOUND'; end if;
end $$;
revoke all on function public.decide_tailoring_suggestion(uuid,integer,text) from public,anon;
grant execute on function public.decide_tailoring_suggestion(uuid,integer,text) to authenticated;
create table if not exists public.tailoring_requests(user_id uuid not null references auth.users(id) on delete cascade,created_at timestamptz not null default now());
alter table public.tailoring_requests enable row level security;
revoke all on public.tailoring_requests from public,anon,authenticated;
create or replace function public.reserve_tailoring_request() returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,24));
 if (select count(*) from public.tailoring_requests where user_id=auth.uid() and created_at>now()-interval '1 hour')>=5 then raise exception 'RATE_LIMIT'; end if;
 delete from public.tailoring_requests where user_id=auth.uid() and created_at<now()-interval '1 hour';
 insert into public.tailoring_requests(user_id) values(auth.uid());
end $$;
revoke all on function public.reserve_tailoring_request() from public,anon;
grant execute on function public.reserve_tailoring_request() to authenticated;
-- Every export is a separate file/row. Original CV is never overwritten.
alter table public.cvs add column if not exists parent_cv_id uuid references public.cvs(id) on delete set null;
alter table public.cvs add column if not exists target_application_id uuid references public.applications(id) on delete set null;
alter table public.cvs add column if not exists tailoring_id uuid references public.cv_tailoring(id) on delete set null;
alter table public.cvs add column if not exists accepted_suggestions jsonb not null default '[]';
create or replace function public.check_cv_lineage() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 -- FK cascades may clear links in separate updates after the referenced row is gone.
 -- Revalidate only newly assigned links; clearing links cannot grant foreign access.
 if TG_OP='UPDATE' and new.user_id=old.user_id
 and (new.parent_cv_id is null or new.parent_cv_id is not distinct from old.parent_cv_id)
 and (new.target_application_id is null or new.target_application_id is not distinct from old.target_application_id)
 and (new.tailoring_id is null or new.tailoring_id is not distinct from old.tailoring_id) then return new; end if;
 if new.parent_cv_id is not null and not exists(select 1 from public.cvs where id=new.parent_cv_id and user_id=new.user_id) then raise exception 'PARENT_NOT_FOUND'; end if;
 if new.target_application_id is not null and not exists(select 1 from public.applications where id=new.target_application_id and user_id=new.user_id) then raise exception 'JOB_NOT_FOUND'; end if;
 if new.tailoring_id is not null and not exists(select 1 from public.cv_tailoring where id=new.tailoring_id and user_id=new.user_id and (new.parent_cv_id is null or cv_id=new.parent_cv_id) and (new.target_application_id is null or application_id=new.target_application_id)) then raise exception 'TAILORING_NOT_FOUND'; end if;
 return new;
end $$;
revoke all on function public.check_cv_lineage() from public,anon,authenticated;
drop trigger if exists cv_lineage on public.cvs;
create trigger cv_lineage before insert or update on public.cvs for each row execute function public.check_cv_lineage();
commit;


-- 20261030000000_production_security.sql
begin;
create table if not exists public.paid_operations (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('analyze_job','match','agent')), input_hash text not null check(input_hash ~ '^[a-f0-9]{64}$'),
 status text not null check(status in ('running','completed','failed')),result jsonb,created_at timestamptz not null default now()
);
alter table public.paid_operations enable row level security;
revoke all on public.paid_operations from public,anon,authenticated;
create index if not exists paid_operation_owner_time on public.paid_operations(user_id,created_at desc);
create or replace function public.reserve_paid_operation(p_kind text,p_hash text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_user uuid:=auth.uid(); v_run public.paid_operations%rowtype; v_id uuid;
begin
 if v_user is null then raise exception 'AUTH_REQUIRED';end if;
 if p_kind is null or p_kind not in ('analyze_job','match','agent') or p_hash is null or p_hash !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_INPUT';end if;
 perform pg_advisory_xact_lock(hashtextextended(v_user::text,26));
 delete from public.paid_operations where user_id=v_user and created_at<now()-interval '24 hours';
 select * into v_run from public.paid_operations where user_id=v_user and kind=p_kind and input_hash=p_hash and status='completed' and created_at>now()-interval '15 minutes' order by created_at desc limit 1;
 if found then return jsonb_build_object('id',v_run.id,'cached',true,'result',v_run.result);end if;
 if exists(select 1 from public.paid_operations where user_id=v_user and status='running' and created_at>now()-interval '10 minutes') then raise exception 'OPERATION_BUSY';end if;
 if exists(select 1 from public.paid_operations where user_id=v_user and kind=p_kind and input_hash=p_hash and created_at>now()-interval '1 minute') then raise exception 'OPERATION_BUSY';end if;
 if (select count(*) from public.paid_operations where user_id=v_user and created_at>now()-interval '1 hour')>=10 then raise exception 'RATE_LIMIT';end if;
 insert into public.paid_operations(user_id,kind,input_hash,status) values(v_user,p_kind,p_hash,'running') returning id into v_id;
 return jsonb_build_object('id',v_id,'cached',false);
end $$;
create or replace function public.finish_paid_operation(p_id uuid,p_result jsonb) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 if p_result is not null and octet_length(p_result::text)>200000 then raise exception 'RESULT_TOO_LARGE';end if;
 update public.paid_operations set status=case when p_result is null then 'failed' else 'completed' end,result=p_result where id=p_id and user_id=auth.uid() and status='running';
 if not found then raise exception 'OPERATION_NOT_FOUND';end if;
end $$;
revoke all on function public.reserve_paid_operation(text,text),public.finish_paid_operation(uuid,jsonb) from public,anon;
grant execute on function public.reserve_paid_operation(text,text),public.finish_paid_operation(uuid,jsonb) to authenticated;
create index if not exists applications_owner_stage on public.applications(user_id,status);
create index if not exists learning_tasks_owner_plan on public.learning_tasks(user_id,roadmap_id);
-- Restrict CV record paths as well as storage object paths. Do not rewrite legacy rows.
alter table public.cvs drop constraint if exists cvs_owned_path;
alter table public.cvs add constraint cvs_owned_path check (file_path like user_id::text || '/%') not valid;
commit;
