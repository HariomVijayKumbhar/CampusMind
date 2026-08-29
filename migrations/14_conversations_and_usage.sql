-- Chat sessions: conversations sidebar + admin usage analytics
-- 14a: conversations table
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null default 'New conversation',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index if not exists idx_conversations_user on conversations(user_id, updated_at desc);

alter table conversations enable row level security;

create policy "Users can read their own conversations" on conversations
  for select using (user_id = auth.uid());

create policy "Users can insert their own conversations" on conversations
  for insert with check (user_id = auth.uid());

create policy "Users can update their own conversations" on conversations
  for update using (user_id = auth.uid());

create policy "Users can delete their own conversations" on conversations
  for delete using (user_id = auth.uid());

-- 14b: link messages to conversations
alter table chat_messages add column if not exists conversation_id uuid references conversations(id) on delete cascade;
create index if not exists idx_chat_messages_conversation on chat_messages(conversation_id, created_at);

-- 14c: usage analytics (admin)
create table if not exists usage_events (
  id bigint generated always as identity primary key,
  user_id uuid references profiles(id) on delete set null,
  event_type text not null check (event_type in ('chat', 'quiz', 'flashcards', 'summary', 'upload')),
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now()
);

create index if not exists idx_usage_events_created on usage_events(created_at desc);

alter table usage_events enable row level security;
-- No user policies: only the service role (backend) reads/writes this table.
