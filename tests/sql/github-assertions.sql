set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
insert into public.github_analyses(id,user_id,username,repo_name,result) values
 ('20000000-0000-4000-8000-000000000001',auth.uid(),'student','project','{"evidence":[{"skill":"Python"}]}');
insert into public.github_skill_approvals(user_id,analysis_id,cv_id,skill) values
 (auth.uid(),'20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Python');
do $$ begin
 if (select count(*) from public.github_skill_approvals)<>1 then raise exception 'Save/retrieve failed'; end if;
 begin
 insert into public.github_skill_approvals(user_id,analysis_id,cv_id,skill) values
 (auth.uid(),'20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','Python');
 raise exception 'Foreign CV approved'; exception when insufficient_privilege then null; end;
 begin
 insert into public.github_skill_approvals(user_id,analysis_id,cv_id,skill) values
 (auth.uid(),'20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','ImaginarySkill');
 raise exception 'Unbacked skill approved'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
do $$ begin
 if (select count(*) from public.github_analyses)<>0 or (select count(*) from public.github_skill_approvals)<>0 then raise exception 'RLS leak'; end if;
 delete from public.github_skill_approvals;
 if found then raise exception 'Foreign approval deleted'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
do $$ begin
 for i in 1..30 loop perform public.reserve_github_request(); end loop;
 begin perform public.reserve_github_request(); raise exception 'Rate bypass';
 exception when raise_exception then if SQLERRM not like '%limit reached%' then raise; end if; end;
end $$;
delete from public.github_skill_approvals;
do $$ begin if (select count(*) from public.github_skill_approvals)<>0 then raise exception 'Revoke failed'; end if; end $$;
reset role;
set role anon;
do $$ begin
 begin perform public.reserve_github_request(); raise exception 'Anonymous RPC'; exception when insufficient_privilege then null; end;
 begin perform count(*) from public.github_analyses; raise exception 'Anonymous read'; exception when insufficient_privilege then null; end;
end $$;
reset role;
