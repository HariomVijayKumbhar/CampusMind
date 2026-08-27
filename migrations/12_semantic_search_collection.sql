-- Replace match_document_chunks with a collection-aware version.
-- The old signature (query_embedding, match_count) is dropped so calls with
-- three arguments resolve to this new overload and collection scoping works.
-- retrievalService.semanticSearch() always passes (embedding, match_count, filter_collection).

drop function if exists public.match_document_chunks(vector, integer);

create or replace function public.match_document_chunks(
  query_embedding vector(384),
  match_count int default 15,
  filter_collection uuid default null
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
  where filter_collection is null or d.collection_id = filter_collection
  order by dc.embedding <=> query_embedding
  limit match_count;
$$;
