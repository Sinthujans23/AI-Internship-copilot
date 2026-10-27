-- Existing application ownership policies apply to this new column.
alter table public.applications add column if not exists job_analysis jsonb;
