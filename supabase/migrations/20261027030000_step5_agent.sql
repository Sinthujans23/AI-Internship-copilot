-- Includes job/match snapshots, three bullets, email, CV identity, and timestamp.
alter table public.applications add column if not exists agent_result jsonb;
