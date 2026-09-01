-- 17_document_intelligence.sql
-- Per-document intelligence: tables, key points, PDF metadata.
-- Adds page_number / block_type / table_id columns to document_chunks for
-- layout-aware retrieval and rendering.

alter table document_chunks
  add column if not exists page_number int default 1,
  add column if not exists block_type text default 'text'
    check (block_type in ('text', 'table', 'figure_caption', 'heading')),
  add column if not exists table_id uuid;

create table if not exists document_tables (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  chunk_id uuid references document_chunks(id) on delete set null,
  title text,
  headers text[],
  rows jsonb,
  page_number int,
  created_at timestamp with time zone default now()
);

create index if not exists idx_document_tables_doc on document_tables(document_id);

create table if not exists document_metadata (
  document_id uuid primary key references documents(id) on delete cascade,
  page_count int,
  author text,
  subject text,
  keywords text[],
  has_ocr boolean default false,
  ocr_confidence int,
  created_at timestamp with time zone default now()
);

create table if not exists document_key_points (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  chunk_id uuid references document_chunks(id) on delete set null,
  points text[],
  created_at timestamp with time zone default now()
);

create index if not exists idx_document_key_points_doc on document_key_points(document_id);

create index if not exists idx_document_chunks_table on document_chunks(table_id) where table_id is not null;
create index if not exists idx_document_chunks_page on document_chunks(document_id, page_number);
