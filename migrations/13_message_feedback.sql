-- Message feedback (👍/👎) for answer quality tracking
create table if not exists message_feedback (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references chat_messages(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  rating text not null check (rating in ('up', 'down')),
  created_at timestamp with time zone default now(),
  unique (message_id, user_id)
);

alter table message_feedback enable row level security;

create policy "Users can read their own feedback" on message_feedback
  for select using (user_id = auth.uid());

create policy "Users can insert their own feedback" on message_feedback
  for insert with check (user_id = auth.uid());
