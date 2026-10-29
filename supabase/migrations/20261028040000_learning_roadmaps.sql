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
