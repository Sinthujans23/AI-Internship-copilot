set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
insert into public.applications(id,user_id,company,role) values('20000000-0000-4000-8000-000000000001',auth.uid(),'Example','Intern');
insert into public.cv_tailoring(id,user_id,cv_id,application_id,result) values('40000000-0000-4000-8000-000000000001',auth.uid(),'10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','{"suggestions":[{"original_quote":"Example original","suggested_text":"Example revised"},{"original_quote":"Second original","suggested_text":"Second revised"}]}');
select public.decide_tailoring_suggestion('40000000-0000-4000-8000-000000000001',0,'accepted');
select public.decide_tailoring_suggestion('40000000-0000-4000-8000-000000000001',1,'rejected');
insert into public.cvs(id,user_id,extracted_text,parent_cv_id,target_application_id,tailoring_id,accepted_suggestions) values('10000000-0000-4000-8000-000000000003',auth.uid(),'Revised text','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','[{"suggested_text":"Example revised"}]');
do $$ begin
 if (select decisions->>'0' from public.cv_tailoring limit 1)<>'accepted' or (select decisions->>'1' from public.cv_tailoring limit 1)<>'rejected' then raise exception 'decisions not persisted';end if;
 if not exists(select 1 from public.cvs where id='10000000-0000-4000-8000-000000000001' and extracted_text like 'Education%') then raise exception 'original changed'; end if;
 if not exists(select 1 from public.cvs where id='10000000-0000-4000-8000-000000000003' and parent_cv_id='10000000-0000-4000-8000-000000000001') then raise exception 'version link missing';end if;
 begin perform public.decide_tailoring_suggestion('40000000-0000-4000-8000-000000000001',7,'accepted');raise exception 'bad index permitted';exception when raise_exception then if SQLERRM<>'SUGGESTION_NOT_FOUND' then raise;end if;end;
 begin update public.cv_tailoring set result='{}';raise exception 'analysis mutation allowed';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
do $$ begin
 if exists(select 1 from public.cv_tailoring) then raise exception 'foreign session read';end if;
 begin perform public.decide_tailoring_suggestion('40000000-0000-4000-8000-000000000001',0,'accepted');raise exception 'foreign acceptance';exception when raise_exception then if SQLERRM<>'SUGGESTION_NOT_FOUND' then raise;end if;end;
 begin insert into public.cvs(id,user_id,extracted_text,parent_cv_id) values(gen_random_uuid(),auth.uid(),'foreign','10000000-0000-4000-8000-000000000001');raise exception 'foreign lineage';exception when raise_exception then if SQLERRM<>'PARENT_NOT_FOUND' then raise;end if;end;
 begin insert into public.cv_tailoring(user_id,cv_id,application_id,result) values(auth.uid(),'10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','{}');raise exception 'foreign job/CV session';exception when insufficient_privilege then null;end;
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
delete from public.applications where id='20000000-0000-4000-8000-000000000001';
do $$ begin
 if exists(select 1 from public.cv_tailoring) then raise exception 'job deletion did not remove sessions';end if;
 if not exists(select 1 from public.cvs where id='10000000-0000-4000-8000-000000000003' and target_application_id is null and tailoring_id is null and jsonb_array_length(accepted_suggestions)=1) then raise exception 'revision lost after job deletion';end if;
end $$;
delete from public.cvs where id='10000000-0000-4000-8000-000000000001';
do $$ begin if not exists(select 1 from public.cvs where id='10000000-0000-4000-8000-000000000003' and parent_cv_id is null) then raise exception 'revision lost after source deletion';end if;end $$;
reset role;
