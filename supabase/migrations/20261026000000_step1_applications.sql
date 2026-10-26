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
  created_at timestamptz not null default now()
);

-- Preserve rows if the earlier prototype schema was already installed.
alter table public.applications add column if not exists job_text text not null default '';
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
