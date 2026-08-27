-- Drop previous version of the function first since Postgres does not allow changing the return table type via CREATE OR REPLACE
drop function if exists public.match_document_chunks(vector, integer);
drop function if exists public.match_document_chunks(vector);

create or replace function public.match_document_chunks(
  query_embedding vector(384),
  match_count int DEFAULT 5
)
returns table (
  id uuid,
  document_id uuid,
  document_title text,
  content text,
  similarity float
)
language sql stable
as $$
  select
    dc.id,
    dc.document_id,
    d.title as document_title,
    dc.content,
    1 - (dc.embedding <=> query_embedding) as similarity
  from document_chunks dc
  join documents d on d.id = dc.document_id
  where dc.embedding is not null
  order by dc.embedding <=> query_embedding
  limit match_count;
$$;
