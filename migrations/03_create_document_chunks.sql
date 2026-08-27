-- document_chunks table - stores PDF text chunks with embeddings
create table if not exists document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  content text not null,
  embedding vector(384),
  chunk_index int not null,
  created_at timestamp with time zone default now()
);

-- Create index on embedding for faster similarity search
create index on document_chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Enable RLS on document_chunks
alter table document_chunks enable row level security;

-- RLS Policy: Anyone can read chunks (needed for RAG queries)
create policy "Anyone can read document chunks" on document_chunks
  for select using (true);

-- RLS Policy: Only admins can insert chunks
create policy "Only admins can insert chunks" on document_chunks
  for insert with check (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- RLS Policy: Only admins can delete chunks
create policy "Only admins can delete chunks" on document_chunks
  for delete using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );
