\set ON_ERROR_STOP on
set role authenticated;
select set_config('request.jwt.claim.sub', '', false);
do $$ begin
  perform public.reserve_cv_analysis('10000000-0000-4000-8000-000000000001','x',false);
  raise exception 'Expected authentication failure';
exception when raise_exception then
  if sqlerrm <> 'AUTH_REQUIRED' then raise; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
do $$
declare
  cv uuid := '10000000-0000-4000-8000-000000000001';
  hash text;
  run jsonb;
  result jsonb;
  state jsonb;
begin
  assert (select count(*) from public.cv_analysis_history where version=1)=1, 'legacy review not archived';
  select encode(sha256(convert_to(extracted_text,'UTF8')),'hex') into hash from public.cvs where id=cv;
  run := public.reserve_cv_analysis(cv,hash,false);
  assert (run->>'cached')::boolean=false;
  begin
    perform public.reserve_cv_analysis(cv,hash,true);
    raise exception 'Expected duplicate prevention';
  exception when raise_exception then if sqlerrm <> 'ANALYSIS_BUSY' then raise; end if; end;
  result := jsonb_build_object('version',2,'input_hash',hash,'score',7.5,'criteria','{}'::jsonb,'sections','[]'::jsonb);
  state := public.finish_cv_analysis((run->>'id')::uuid,result);
  assert state->>'status'='completed';
  assert (select analysis->'cv_review'->>'version' from public.cvs where id=cv)='1', 'legacy field lost';
  assert (select analysis->'cv_review_v2'->>'score' from public.cvs where id=cv)='7.5';
  assert (select count(*) from public.cv_analysis_history where status='completed')=2;
  assert (public.reserve_cv_analysis(cv,hash,false)->>'cached')::boolean=true;
  begin
    update public.cv_analysis_history set result='{}';
    raise exception 'History must be immutable to direct writes';
  exception when insufficient_privilege then null; end;
  run := public.reserve_cv_analysis(cv,hash,true);
  update public.cvs set extracted_text=extracted_text || ' Changed.' where id=cv;
  state := public.finish_cv_analysis((run->>'id')::uuid,result);
  assert state->>'status'='outdated', 'changed text got fresh review';
  assert (select count(*) from public.cv_analysis_history where status='outdated')=1;
  select encode(sha256(convert_to(extracted_text,'UTF8')),'hex') into hash from public.cvs where id=cv;
  for i in 1..3 loop
    run := public.reserve_cv_analysis(cv,hash,true);
    perform public.finish_cv_analysis((run->>'id')::uuid,null);
  end loop;
  begin
    perform public.reserve_cv_analysis(cv,hash,true);
    raise exception 'Expected hourly rate limit';
  exception when raise_exception then if sqlerrm <> 'ANALYSIS_RATE_LIMIT' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
do $$ begin
  assert (select count(*) from public.cv_analysis_history)=0, 'foreign history visible';
  begin
    perform public.reserve_cv_analysis('10000000-0000-4000-8000-000000000001','x',false);
    raise exception 'Expected ownership failure';
  exception when raise_exception then if sqlerrm <> 'CV_NOT_FOUND' then raise; end if; end;
end $$;
reset role;
set role anon;
do $$ begin
  perform public.reserve_cv_analysis('10000000-0000-4000-8000-000000000001','x',false);
  raise exception 'Anonymous execution should be denied';
exception when insufficient_privilege then null; end $$;
reset role;
select 'PASS history save/retrieve, legacy preservation, cache, outdated detection, ownership, anonymous access, immutable snapshots and hourly limit' as result;
