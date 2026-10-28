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
