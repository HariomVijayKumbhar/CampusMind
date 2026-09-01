-- 19_collaboration.sql
-- Document sharing (token-based), inline annotations, and version history.

create table if not exists document_shares (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  token text not null unique,
  role text not null check (role in ('viewer', 'annotator', 'editor')),
  expires_at timestamp with time zone,
  created_by uuid not null references profiles(id),
  created_at timestamp with time zone default now(),
  max_uses int,
  used_count int default 0
);
create index if not exists idx_document_shares_token on document_shares(token);
create index if not exists idx_document_shares_doc on document_shares(document_id);

create table if not exists annotations (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  chunk_id uuid references document_chunks(id) on delete set null,
  user_id uuid not null references profiles(id) on delete cascade,
  start_offset int not null,
  end_offset int not null,
  selected_text text,
  comment text,
  parent_annotation_id uuid references annotations(id) on delete cascade,
  resolved boolean default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);
create index if not exists idx_annotations_doc on annotations(document_id);
create index if not exists idx_annotations_chunk on annotations(chunk_id);

create table if not exists document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  version_number int not null,
  chunk_count int,
  total_chars int,
  snapshot jsonb,
  created_by uuid not null references profiles(id),
  created_at timestamp with time zone default now(),
  unique (document_id, version_number)
);
create index if not exists idx_document_versions_doc on document_versions(document_id, version_number desc);

alter table annotations enable row level security;
create policy "Users can read annotations"
  on annotations for select
  using (
    exists (select 1 from documents d where d.id = annotations.document_id)
  );
create policy "Users can create annotations"
  on annotations for insert
  with check (user_id = auth.uid());
create policy "Users can update their own annotations"
  on annotations for update
  using (user_id = auth.uid());
create policy "Users can delete their own annotations"
  on annotations for delete
  using (user_id = auth.uid());

alter table document_versions enable row level security;
create policy "Users can read versions for documents they can see"
  on document_versions for select
  using (
    exists (select 1 from documents d where d.id = document_versions.document_id)
  );
create policy "Users can insert versions"
  on document_versions for insert
  with check (created_by = auth.uid());

-- document_shares uses service-role access only (token-based).
alter table document_shares enable row level security;
