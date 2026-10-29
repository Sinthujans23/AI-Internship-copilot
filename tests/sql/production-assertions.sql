set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
do $$ declare r jsonb;begin
 r:=public.reserve_paid_operation('agent',repeat('a',64));
 begin perform public.reserve_paid_operation('agent',repeat('a',64));raise exception 'duplicate paid call';exception when raise_exception then if SQLERRM<>'OPERATION_BUSY' then raise;end if;end;
 perform public.finish_paid_operation((r->>'id')::uuid,'{"test":true}');
 r:=public.reserve_paid_operation('agent',repeat('a',64));
 if not (r->>'cached')::boolean or r->'result'<> '{"test":true}'::jsonb then raise exception 'cache failed';end if;
 begin perform * from public.paid_operations;raise exception 'raw cache access';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
do $$ declare r jsonb;begin
 r:=public.reserve_paid_operation('agent',repeat('a',64));if (r->>'cached')::boolean then raise exception 'cross-user cache';end if;
 perform public.finish_paid_operation((r->>'id')::uuid,null);
 begin update public.cvs set file_path='00000000-0000-4000-8000-000000000001/foreign.pdf' where user_id=auth.uid();raise exception 'foreign path permitted';exception when check_violation then null;end;
end $$;
reset role;
set role anon;
do $$ begin begin perform public.reserve_paid_operation('agent',repeat('a',64));raise exception 'anonymous quota';exception when insufficient_privilege then null;end;end $$;
reset role;
