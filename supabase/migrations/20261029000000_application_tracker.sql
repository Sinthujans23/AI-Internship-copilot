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
