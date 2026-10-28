set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
select public.reserve_job_match('10000000-0000-4000-8000-000000000001',repeat('a',64));
update public.job_match_runs set result='{"jobs":[],"test":true}';
do $$ begin
 if (select count(*) from public.job_match_runs where result->>'test'='true')<>1 then raise exception 'Save/retrieve failed'; end if;
 begin
  perform public.reserve_job_match('10000000-0000-4000-8000-000000000002',repeat('b',64));
  raise exception 'Ownership bypass';
 exception when raise_exception then if SQLERRM <> 'CV not found' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
do $$ begin
 if (select count(*) from public.job_match_runs)<>0 then raise exception 'RLS leak'; end if;
 update public.job_match_runs set result='{}';
 if found then raise exception 'Cross-user mutation'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
select public.reserve_job_match('10000000-0000-4000-8000-000000000001',repeat('b',64));
select public.reserve_job_match('10000000-0000-4000-8000-000000000001',repeat('c',64));
do $$ begin
 begin
  perform public.reserve_job_match('10000000-0000-4000-8000-000000000001',repeat('d',64));
  raise exception 'Rate limit bypass';
 exception when raise_exception then if SQLERRM not like '%rate limit%' then raise; end if; end;
 begin
  delete from public.job_match_runs;
  raise exception 'Rate history deletion permitted';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
set role anon;
do $$ begin
 begin
  perform public.reserve_job_match('10000000-0000-4000-8000-000000000001',repeat('e',64));
  raise exception 'Anonymous access';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
