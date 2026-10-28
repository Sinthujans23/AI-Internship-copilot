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
