begin;
alter table public.applications add column if not exists deadline_date date;
-- Keep deadline edits visible in the existing tracker audit trail.
create or replace function public.audit_application() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if TG_OP='UPDATE' and new.user_id<>old.user_id then raise exception 'OWNER_IMMUTABLE'; end if;
 if new.cv_id is not null and not exists(select 1 from public.cvs where id=new.cv_id and user_id=new.user_id) then raise exception 'CV_NOT_FOUND'; end if;
 if new.company_report_id is not null and not exists(select 1 from public.company_reports where id=new.company_report_id and user_id=new.user_id) then raise exception 'REPORT_NOT_FOUND'; end if;
 if TG_OP='INSERT' then
   insert into public.application_history(application_id,user_id,new_status,event) values(new.id,new.user_id,new.status,'Created');
 elsif new.status is distinct from old.status then
   insert into public.application_history(application_id,user_id,old_status,new_status,event) values(new.id,new.user_id,old.status,new.status,'Stage changed');
 elsif (new.company,new.role,new.notes,new.job_url,new.job_text,new.application_date,new.interview_date,new.follow_up_date,new.deadline_date,new.cv_id,new.company_report_id) is distinct from (old.company,old.role,old.notes,old.job_url,old.job_text,old.application_date,old.interview_date,old.follow_up_date,old.deadline_date,old.cv_id,old.company_report_id) then
   insert into public.application_history(application_id,user_id,old_status,new_status,event) values(new.id,new.user_id,old.status,new.status,'Details edited');
 end if;
 return new;
end $$;
revoke all on function public.audit_application() from public,anon,authenticated;

create table if not exists public.interview_sessions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 cv_id uuid references public.cvs(id) on delete set null,
 application_id uuid references public.applications(id) on delete set null,
 context jsonb not null, questions jsonb not null check(jsonb_typeof(questions)='array' and jsonb_array_length(questions)=5),
 answers jsonb, feedback jsonb, score integer check(score between 0 and 100),
 created_at timestamptz not null default now(), completed_at timestamptz,
 check ((feedback is null and answers is null and score is null and completed_at is null)
   or (feedback is not null and answers is not null and score is not null and completed_at is not null
       and jsonb_array_length(feedback)=5 and jsonb_array_length(answers)=5))
);
create table if not exists public.draft_packs (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 cv_id uuid references public.cvs(id) on delete set null,
 application_id uuid references public.applications(id) on delete set null,
 context jsonb not null, content jsonb not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.job_feedback (
 user_id uuid not null references auth.users(id) on delete cascade,
 job_url text not null check(length(job_url)<=2000 and job_url ~ '^https://'),
 title text not null check(length(title) between 1 and 300), company text not null check(length(company) between 1 and 300),
 verdict text not null check(verdict in ('relevant','not_relevant','expired')),
 updated_at timestamptz not null default now(), primary key(user_id,job_url)
);
create index if not exists interview_sessions_owner_time on public.interview_sessions(user_id,created_at desc);
create index if not exists draft_packs_owner_time on public.draft_packs(user_id,created_at desc);
alter table public.interview_sessions enable row level security;
alter table public.draft_packs enable row level security;
alter table public.job_feedback enable row level security;
revoke all on public.interview_sessions,public.draft_packs,public.job_feedback from anon;
grant select,insert,update,delete on public.interview_sessions,public.draft_packs,public.job_feedback to authenticated;
drop policy if exists own_interviews on public.interview_sessions;
create policy own_interviews on public.interview_sessions to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
drop policy if exists own_drafts on public.draft_packs;
create policy own_drafts on public.draft_packs to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
drop policy if exists own_job_feedback on public.job_feedback;
create policy own_job_feedback on public.job_feedback to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create or replace function public.check_career_owner() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if TG_OP='UPDATE' and new.user_id<>old.user_id then raise exception 'OWNER_IMMUTABLE'; end if;
 if new.cv_id is not null and not exists(select 1 from public.cvs where id=new.cv_id and user_id=new.user_id) then raise exception 'CV_NOT_FOUND'; end if;
 if new.application_id is not null and not exists(select 1 from public.applications where id=new.application_id and user_id=new.user_id) then raise exception 'APPLICATION_NOT_FOUND'; end if;
 return new;
end $$;
revoke all on function public.check_career_owner() from public,anon,authenticated;
drop trigger if exists interview_owner on public.interview_sessions;
create trigger interview_owner before insert or update on public.interview_sessions for each row execute function public.check_career_owner();
drop trigger if exists draft_owner on public.draft_packs;
create trigger draft_owner before insert or update on public.draft_packs for each row execute function public.check_career_owner();
commit;
