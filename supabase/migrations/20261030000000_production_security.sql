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
