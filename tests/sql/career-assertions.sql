set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
insert into public.applications(id,user_id,company,role,status,deadline_date) values
 ('20000000-0000-4000-8000-000000000001',auth.uid(),'Career test','Intern','Saved','2026-11-20');
insert into public.interview_sessions(id,user_id,cv_id,application_id,context,questions) values
 ('40000000-0000-4000-8000-000000000001',auth.uid(),'10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','{}','[{}, {}, {}, {}, {}]');
insert into public.draft_packs(id,user_id,cv_id,application_id,context,content) values
 ('50000000-0000-4000-8000-000000000001',auth.uid(),'10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','{}','{"cover_letter":"Synthetic draft"}');
insert into public.job_feedback(user_id,job_url,title,company,verdict) values(auth.uid(),'https://example.com/job','Intern','Career test','relevant');
update public.applications set deadline_date='2026-11-21' where id='20000000-0000-4000-8000-000000000001';
do $$ begin
 if (select count(*) from public.application_history where application_id='20000000-0000-4000-8000-000000000001')<>2 then raise exception 'deadline audit missing'; end if;
 begin
 update public.draft_packs set cv_id='10000000-0000-4000-8000-000000000002' where id='50000000-0000-4000-8000-000000000001';
 raise exception 'foreign CV allowed'; exception when raise_exception then if SQLERRM<>'CV_NOT_FOUND' then raise; end if; end;
 begin
 update public.interview_sessions set cv_id='10000000-0000-4000-8000-000000000002' where id='40000000-0000-4000-8000-000000000001';
 raise exception 'foreign interview CV allowed'; exception when raise_exception then if SQLERRM<>'CV_NOT_FOUND' then raise; end if; end;
 begin
 update public.interview_sessions set score=80 where id='40000000-0000-4000-8000-000000000001';
 raise exception 'partial score allowed'; exception when check_violation then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
insert into public.applications(id,user_id,company,role,status) values('20000000-0000-4000-8000-000000000002',auth.uid(),'Foreign job','Intern','Saved');
do $$ begin
 if exists(select 1 from public.interview_sessions) or exists(select 1 from public.draft_packs) or exists(select 1 from public.job_feedback) then raise exception 'foreign reads allowed'; end if;
 update public.draft_packs set content='{}' where id='50000000-0000-4000-8000-000000000001';
 if found then raise exception 'foreign update allowed'; end if;
 delete from public.interview_sessions where id='40000000-0000-4000-8000-000000000001';
 if found then raise exception 'foreign delete allowed'; end if;
 begin
 insert into public.job_feedback(user_id,job_url,title,company,verdict) values('00000000-0000-4000-8000-000000000001','https://example.com/forged','Intern','Forged','expired');
 raise exception 'forged owner allowed'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
do $$ begin
 begin
 update public.draft_packs set application_id='20000000-0000-4000-8000-000000000002' where id='50000000-0000-4000-8000-000000000001';
 raise exception 'foreign application allowed'; exception when raise_exception then if SQLERRM<>'APPLICATION_NOT_FOUND' then raise; end if; end;
end $$;
delete from public.applications where id='20000000-0000-4000-8000-000000000001';
do $$ begin
 if exists(select 1 from public.draft_packs where application_id is not null) or exists(select 1 from public.interview_sessions where application_id is not null) then raise exception 'deleted application links retained'; end if;
end $$;
delete from public.interview_sessions; delete from public.draft_packs; delete from public.job_feedback;
reset role;
set role anon;
do $$ begin
 begin perform * from public.interview_sessions; raise exception 'anonymous interview read'; exception when insufficient_privilege then null; end;
 begin perform * from public.draft_packs; raise exception 'anonymous draft read'; exception when insufficient_privilege then null; end;
 begin perform * from public.job_feedback; raise exception 'anonymous feedback read'; exception when insufficient_privilege then null; end;
end $$;
reset role;
