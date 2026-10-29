alter table public.cvs add column file_path text;
update public.cvs set file_path=user_id::text || '/' || id::text || '.pdf';
