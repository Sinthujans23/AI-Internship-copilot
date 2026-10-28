set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
select public.reserve_company_rag('https://example.com/jobs') as sid \gset
insert into public.company_rag_documents values
 ('20000000-0000-4000-8000-000000000001',auth.uid(),:'sid','https://example.com/jobs','Job',0,'primary',now()),
 ('20000000-0000-4000-8000-000000000002',auth.uid(),:'sid','https://example.com/company','Company',1,'related',now());
insert into public.company_rag_chunks values
 ('30000000-0000-4000-8000-000000000001',auth.uid(),:'sid','20000000-0000-4000-8000-000000000001',0,'Required Python',repeat('a',64),'[1,0]','model-a'),
 ('30000000-0000-4000-8000-000000000002',auth.uid(),:'sid','20000000-0000-4000-8000-000000000001',1,'Office lunch menu',repeat('b',64),'[0,1]','model-a'),
 ('30000000-0000-4000-8000-000000000003',auth.uid(),:'sid','20000000-0000-4000-8000-000000000002',0,'General Python overview',repeat('c',64),'[0.8,0.2]','model-a'),
 ('30000000-0000-4000-8000-000000000004',auth.uid(),:'sid','20000000-0000-4000-8000-000000000001',2,'Another model',repeat('d',64),'[1,0]','model-b'),
 ('30000000-0000-4000-8000-000000000005',auth.uid(),:'sid','20000000-0000-4000-8000-000000000001',3,'Other dimension',repeat('e',64),'[1,0,0]','model-a');
select set_config('test.session',:'sid',false);
do $$ declare result text; n integer; begin
 select content into result from public.retrieve_company_chunks(current_setting('test.session')::uuid,'model-a','[1,0]',null,1);
 if result<>'Required Python' then raise exception 'Retrieval relevance failed'; end if;
 select count(*) into n from public.retrieve_company_chunks(current_setting('test.session')::uuid,'model-a','[1,0]',null,20);
 if n<>3 then raise exception 'Model/dimension filter failed'; end if;
 select content into result from public.retrieve_company_chunks(current_setting('test.session')::uuid,'model-a','[1,0]','20000000-0000-4000-8000-000000000002',1);
 if result<>'General Python overview' then raise exception 'Document filter failed'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
do $$ begin
 if exists(select 1 from public.retrieve_company_chunks(current_setting('test.session')::uuid,'model-a','[1,0]',null,20)) then raise exception 'Cross-user retrieval leak'; end if;
 if exists(select 1 from public.company_rag_documents) then raise exception 'Document RLS leak'; end if;
 begin
 insert into public.company_rag_chunks values ('30000000-0000-4000-8000-000000000006',auth.uid(),current_setting('test.session')::uuid,'20000000-0000-4000-8000-000000000001',4,'Poison foreign source',repeat('f',64),'[1,0]','model-a');
 raise exception 'Foreign document poisoning allowed'; exception when foreign_key_violation then null; end;
end $$;
reset role;
set role anon;
do $$ begin
 begin perform * from public.retrieve_company_chunks(current_setting('test.session')::uuid,'model-a','[1,0]',null,20);raise exception 'Anonymous retrieval';exception when insufficient_privilege then null;end;
end $$;
reset role;
