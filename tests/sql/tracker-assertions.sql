-- Run only in the isolated synthetic database.
insert into public.company_reports(id,user_id,source_url,result) values ('30000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000002','https://example.com','{}');
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
insert into public.applications(id,user_id,company,role,status,job_url,cv_id)
values ('20000000-0000-4000-8000-000000000001',auth.uid(),'Example','Intern','Saved','https://example.com/job/1','10000000-0000-4000-8000-000000000001');
update public.applications set status='Assessment',notes='Practice SQL',application_date='2026-10-29',interview_date='2026-11-03',follow_up_date='2026-11-04' where id='20000000-0000-4000-8000-000000000001';
update public.applications set notes='Prepare project evidence' where id='20000000-0000-4000-8000-000000000001';
do $$ begin
 if (select status from public.applications where id='20000000-0000-4000-8000-000000000001')<>'Assessment' then raise exception 'stage persistence failed'; end if;
 if (select count(*) from public.application_history where application_id='20000000-0000-4000-8000-000000000001')<>3 then raise exception 'history failed'; end if;
 begin
 insert into public.applications(user_id,company,role,job_url) values(auth.uid(),'Duplicate','Intern','https://example.com/job/1');
 raise exception 'duplicate permitted'; exception when unique_violation then null; end;
 begin
 update public.applications set cv_id='10000000-0000-4000-8000-000000000002' where id='20000000-0000-4000-8000-000000000001';
 raise exception 'foreign CV allowed'; exception when raise_exception then if SQLERRM<>'CV_NOT_FOUND' then raise; end if; end;
 begin
 update public.applications set company_report_id='30000000-0000-4000-8000-000000000002' where id='20000000-0000-4000-8000-000000000001';
 raise exception 'foreign report allowed'; exception when raise_exception then if SQLERRM<>'REPORT_NOT_FOUND' then raise; end if; end;
 begin
 insert into public.application_history(application_id,user_id,new_status,event) values('20000000-0000-4000-8000-000000000001',auth.uid(),'Offer','forged');
 raise exception 'forged history'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
do $$ begin
 if exists(select 1 from public.applications where company='Example') or exists(select 1 from public.application_history) then raise exception 'foreign reads allowed'; end if;
 update public.applications set status='Offer' where id='20000000-0000-4000-8000-000000000001';
 if found then raise exception 'foreign update'; end if;
 delete from public.applications where id='20000000-0000-4000-8000-000000000001';
 if found then raise exception 'foreign delete'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
delete from public.applications where id='20000000-0000-4000-8000-000000000001';
do $$ begin if exists(select 1 from public.application_history) then raise exception 'delete history cascade failed'; end if; end $$;
reset role;

set role anon;
do $$ begin
 begin perform * from public.applications; raise exception 'anonymous access'; exception when insufficient_privilege then null; end;
end $$;
reset role;
