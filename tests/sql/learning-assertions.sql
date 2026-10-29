set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
select public.save_learning_roadmap(
 '{"target_role":"Python Intern","weeks":1,"weekly_hours":2}',
 '{"cv_id":"10000000-0000-4000-8000-000000000001"}',
 '{"summary":"Build and test an example","weeks":[{"week":1,"milestone":"Save tested example","tasks":[{"title":"Python practice","topic":"Python","kind":"Mini-project","minutes":60,"deliverable":"A tested example","checks":["Save one working example","Record one failing case"],"resource_ids":["python"]}]}]}',
 'deterministic',null) as rid \gset
select id as tid,updated_at as stamp from public.learning_tasks where roadmap_id=:'rid' \gset
select public.update_learning_task(:'tid','In Progress','Started','https://github.com/student/project',:'stamp');
select updated_at as stamp from public.learning_tasks where id=:'tid' \gset
select public.update_learning_task(:'tid','Completed','One test passes','https://github.com/student/project',:'stamp');
select set_config('test.task',:'tid',false);
select set_config('test.plan',:'rid',false);
do $$ begin
 if not exists(select 1 from public.learning_tasks where id=current_setting('test.task')::uuid and status='Completed' and notes='One test passes' and evidence_url='https://github.com/student/project') then raise exception 'Progress persistence failed';end if;
 begin perform public.update_learning_task(current_setting('test.task')::uuid,'In Progress','old tab',null,'2000-01-01');raise exception 'Stale overwrite';
 exception when raise_exception then if SQLERRM not like 'Progress changed%' then raise;end if;end;
end $$;
select public.save_learning_roadmap(
 '{"target_role":"Python Intern","weeks":1,"weekly_hours":2}',
 '{"cv_id":"10000000-0000-4000-8000-000000000001"}',
 '{"summary":"New practice version","weeks":[{"week":1,"milestone":"A new project","tasks":[{"title":"New example","minutes":45,"checks":["Save a new example","Record a failing case"]}]}]}','deterministic',:'rid');
do $$ begin
 if (select count(*) from public.learning_roadmaps)<>2 or not exists(select 1 from public.learning_tasks where id=current_setting('test.task')::uuid and status='Completed') then raise exception 'Regeneration lost completed work';end if;
 begin
 perform public.save_learning_roadmap('{"target_role":"Python Intern","weeks":1,"weekly_hours":1}','{"cv_id":"10000000-0000-4000-8000-000000000001"}','{"summary":"Too much work","weeks":[{"week":1,"milestone":"Test","tasks":[{"minutes":120,"checks":["check 1","check 2"]}]}]}','AI',null);
 raise exception 'Budget bypass';exception when raise_exception then if SQLERRM<>'Weekly budget exceeded' then raise;end if;end;
 if (select count(*) from public.learning_roadmaps)<>2 then raise exception 'Failed save was not atomic';end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
do $$ begin
 if exists(select 1 from public.learning_roadmaps) or exists(select 1 from public.learning_tasks) then raise exception 'RLS leak';end if;
 begin perform public.update_learning_task(current_setting('test.task')::uuid,'Completed','foreign',null,now());raise exception 'Foreign mutation';exception when raise_exception then if SQLERRM<>'Task not found' then raise;end if;end;
 begin perform public.save_learning_roadmap('{"target_role":"Role","weeks":1,"weekly_hours":1}','{"cv_id":"10000000-0000-4000-8000-000000000001"}','{}','AI',null);raise exception 'Foreign CV';exception when raise_exception then if SQLERRM<>'CV not found' then raise;end if;end;
end $$;
reset role;
set role anon;
do $$ begin begin perform public.reserve_learning_request();raise exception 'Anonymous access';exception when insufficient_privilege then null;end;end $$;
reset role;
