-- RRF (Reciprocal Rank Fusion) helper for the hybrid retrieval step.
-- The fusion math lives in server/src/services/retrievalService.js (testable in JS);
-- this SQL function only performs the Postgres-side join that the RPC returns
-- are too narrow for (they lack collection_id and document_id_for_join).

alter table documents
  add column if not exists collection_id uuid references collections(id);

create or replace function public.join_chunk_meta(
  chunk_ids uuid[]
)
returns table (
  id uuid,
  document_id uuid,
  collection_id uuid,
  document_title text
)
language sql stable
as $$
  select
    dc.id,
    dc.document_id,
    d.collection_id,
    d.title as document_title
  from document_chunks dc
  join documents d on d.id = dc.document_id
  where dc.id = any(chunk_ids);
$$;
