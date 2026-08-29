-- chat_messages table - stores conversation history
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  sources jsonb default '[]'::jsonb,
  created_at timestamp with time zone default now()
);

-- Enable RLS on chat_messages
alter table chat_messages enable row level security;

drop policy if exists "Users can read their own messages" on chat_messages;
-- RLS Policy: Users can read only their own messages
create policy "Users can read their own messages" on chat_messages
  for select using (user_id = auth.uid());

drop policy if exists "Users can insert their own messages" on chat_messages;
-- RLS Policy: Users can insert only their own messages (backend service role bypasses this)
create policy "Users can insert their own messages" on chat_messages
  for insert with check (user_id = auth.uid());
