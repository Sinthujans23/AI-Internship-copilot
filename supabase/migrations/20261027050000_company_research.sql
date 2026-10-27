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
