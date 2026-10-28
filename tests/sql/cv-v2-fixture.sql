-- LOCAL EMPTY TEST DATABASE ONLY. Synthetic Supabase auth/RLS fixture.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated, anon;
create table public.cvs(id uuid primary key, user_id uuid not null references auth.users(id), extracted_text text not null, analysis jsonb not null default '{}');
alter table public.cvs enable row level security;
grant select, insert, update, delete on public.cvs to authenticated;
create policy own_cv on public.cvs for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
insert into auth.users values ('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');
insert into public.cvs values
('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','Education
Computer science student at Example University. Projects
Built a Python API with 12 endpoints.', '{"cv_review":{"version":1,"score":5}}'),
('10000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000002','Education
Another student at Example University. Projects
Built a SQL project for coursework.', '{}');
