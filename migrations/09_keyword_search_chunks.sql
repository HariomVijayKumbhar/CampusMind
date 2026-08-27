-- Keyword (full-text) search for hybrid retrieval.
-- Adds the generated tsvector column + GIN index (spec Section 15) and
-- a keyword_search_chunks RPC used by the keyword stage of hybridRetrieve().

alter table document_chunks
  add column if not exists content_tsv tsvector
  generated always as (to_tsvector('english', content)) stored;

create index if not exists document_chunks_tsv_idx
  on document_chunks using gin (content_tsv);

create or replace function public.keyword_search_chunks(
  search_query text,
  match_count int default 15,
  filter_collection uuid default null
)
returns table (
  id uuid,
  document_id uuid,
  document_title text,
  content text,
  rank float
)
language sql stable
as $$
  select
    dc.id,
    dc.document_id,
    d.title as document_title,
    dc.content,
    ts_rank(dc.content_tsv, plainto_tsquery('english', search_query)) as rank
  from document_chunks dc
  join documents d on d.id = dc.document_id
  where dc.content_tsv @@ plainto_tsquery('english', search_query)
    and (filter_collection is null or d.collection_id = filter_collection)
  order by rank desc
  limit match_count;
$$;
