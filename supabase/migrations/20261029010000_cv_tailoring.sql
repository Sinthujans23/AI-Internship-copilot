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
