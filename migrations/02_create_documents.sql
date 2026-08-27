-- documents table - stores uploaded PDF metadata
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  uploaded_by uuid not null references profiles(id) on delete cascade,
  created_at timestamp with time zone default now()
);

-- Enable RLS on documents
alter table documents enable row level security;

-- RLS Policy: Anyone can read documents
create policy "Anyone can read documents" on documents
  for select using (true);

-- RLS Policy: Only admins can insert documents
create policy "Only admins can insert documents" on documents
  for insert with check (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- RLS Policy: Only uploading admin can delete
create policy "Only uploading admin can delete" on documents
  for delete using (
    uploaded_by = auth.uid() and
    exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );
