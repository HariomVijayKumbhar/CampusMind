-- Collections (departments) + wire documents to a collection.
-- Chat retrieval can optionally be scoped to a collection.

create table if not exists collections (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamp with time zone default now()
);

-- Existing documents default to a seed collection so no rows are orphaned.
insert into collections (name) values ('General') on conflict (name) do nothing;

alter table documents
  add column if not exists collection_id uuid references collections(id);

update documents set collection_id = (select id from collections where name = 'General')
  where collection_id is null;

alter table documents
  alter column collection_id set not null;

-- Enable RLS on collections
alter table collections enable row level security;

create policy "Anyone can read collections" on collections
  for select using (true);

create policy "Only admins can insert collections" on collections
  for insert with check (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Only admins can delete collections" on collections
  for delete using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );
