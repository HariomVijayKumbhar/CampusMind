-- Keyword search function for hybrid retrieval.
-- Uses the generated tsvector column content_tsv with plainto_tsquery.
-- Returns chunks ranked by ts_rank. Optional collection filter scopes results.

create or replace function public.keyword_search_chunks(
  search_query text,
  match_count int DEFAULT 15,
  filter_collection uuid DEFAULT null
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
