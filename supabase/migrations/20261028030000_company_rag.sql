begin;
create schema if not exists extensions;
create extension if not exists vector with schema extensions;
grant usage on schema extensions to authenticated;
create table if not exists public.company_rag_sessions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 source_url text not null, created_at timestamptz not null default now(), unique(id,user_id)
);
create table if not exists public.company_rag_documents (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 session_id uuid not null, source_url text not null, title text not null, source_index integer not null check(source_index between 0 and 2),
 source_kind text not null check(source_kind in ('primary','related')), retrieved_at timestamptz not null,
 unique(id,user_id,session_id), foreign key(session_id,user_id) references public.company_rag_sessions(id,user_id) on delete cascade
);
create table if not exists public.company_rag_chunks (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 session_id uuid not null, document_id uuid not null, ordinal integer not null check(ordinal>=0),
 content text not null check(length(content) between 1 and 3000), content_hash text not null check(length(content_hash)=64),
 embedding extensions.vector not null check(extensions.vector_dims(embedding) between 1 and 3072 and extensions.vector_norm(embedding)>0), embedding_model text not null,
 foreign key(document_id,user_id,session_id) references public.company_rag_documents(id,user_id,session_id) on delete cascade,
 unique(document_id,ordinal)
);
create index if not exists company_rag_session_owner on public.company_rag_sessions(user_id,created_at desc);
create index if not exists company_rag_chunks_scope on public.company_rag_chunks(user_id,session_id,embedding_model);
alter table public.company_rag_sessions enable row level security;
alter table public.company_rag_documents enable row level security;
alter table public.company_rag_chunks enable row level security;
revoke all on public.company_rag_sessions,public.company_rag_documents,public.company_rag_chunks from anon,authenticated;
grant select on public.company_rag_sessions to authenticated;
grant select,insert on public.company_rag_documents,public.company_rag_chunks to authenticated;
drop policy if exists own_rag_sessions on public.company_rag_sessions;
create policy own_rag_sessions on public.company_rag_sessions for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists own_rag_documents on public.company_rag_documents;
create policy own_rag_documents on public.company_rag_documents for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
drop policy if exists own_rag_chunks on public.company_rag_chunks;
create policy own_rag_chunks on public.company_rag_chunks for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create or replace function public.reserve_company_rag(p_url text) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); sid uuid;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 if length(p_url)>2000 or p_url not like 'https://%' then raise exception 'Invalid URL'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text||'company-rag',0));
 if (select count(*) from public.company_rag_sessions where user_id=uid and created_at>now()-interval '1 hour')>=5 then raise exception 'Research rate limit reached'; end if;
 insert into public.company_rag_sessions(user_id,source_url) values(uid,p_url) returning id into sid;return sid;
end $$;
revoke all on function public.reserve_company_rag(text) from public,anon;
grant execute on function public.reserve_company_rag(text) to authenticated;

-- Exact cosine search within a small snapshot. Filter ownership, model and source BEFORE LIMIT.
-- Variable dimensions permit existing configured embedding models without mixing vector spaces.
create or replace function public.retrieve_company_chunks(p_session uuid,p_model text,p_vector text,p_document uuid default null,p_limit integer default 12)
returns table(id uuid,document_id uuid,source_index integer,source_url text,retrieved_at timestamptz,ordinal integer,content text,content_hash text,similarity double precision)
language sql stable security invoker set search_path=public,extensions,pg_temp as $$
 select c.id,c.document_id,d.source_index,d.source_url,d.retrieved_at,c.ordinal,c.content,c.content_hash,
  1-(c.embedding OPERATOR(extensions.<=>) p_vector::extensions.vector) as similarity
 from public.company_rag_chunks c join public.company_rag_documents d on d.id=c.document_id and d.user_id=c.user_id
 where c.user_id=auth.uid() and c.session_id=p_session and c.embedding_model=p_model
  and extensions.vector_dims(c.embedding)=extensions.vector_dims(p_vector::extensions.vector)
  and (p_document is null or c.document_id=p_document)
 order by c.embedding OPERATOR(extensions.<=>) p_vector::extensions.vector,c.id
 limit greatest(1,least(p_limit,20));
$$;
revoke all on function public.retrieve_company_chunks(uuid,text,text,uuid,integer) from public,anon;
grant execute on function public.retrieve_company_chunks(uuid,text,text,uuid,integer) to authenticated;
commit;
