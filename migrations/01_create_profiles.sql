-- Enable pgvector extension
create extension if not exists vector;

-- profiles table - stores user information and role
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text default 'student' check (role in ('student', 'admin')),
  created_at timestamp with time zone default now()
);

-- Enable RLS on profiles
alter table profiles enable row level security;

-- RLS Policy: Users can read their own profile
create policy "Users can read their own profile" on profiles
  for select using (auth.uid() = id);

-- RLS Policy: Users can update their own profile
create policy "Users can update their own profile" on profiles
  for update using (auth.uid() = id);
