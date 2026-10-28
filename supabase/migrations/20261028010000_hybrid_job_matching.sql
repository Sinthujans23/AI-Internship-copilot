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
