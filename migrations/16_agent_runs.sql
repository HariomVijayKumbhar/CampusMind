-- 16_agent_runs.sql
-- Tracks every agentic (multi-step) chat run for audit, debugging, and learning.
-- Each run captures the user question, the ordered tool-call steps, and token usage.

create table if not exists agent_runs (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade,
  user_id uuid not null references profiles(id),
  question text not null,
  steps jsonb default '[]'::jsonb,
  token_usage jsonb default '{}'::jsonb,
  final_answer text,
  status text not null default 'completed' check (status in ('completed', 'failed', 'aborted')),
  created_at timestamp with time zone default now()
);

create index if not exists idx_agent_runs_user on agent_runs(user_id, created_at desc);
create index if not exists idx_agent_runs_conversation on agent_runs(conversation_id);

alter table agent_runs enable row level security;

create policy "Users can read their own agent runs"
  on agent_runs for select
  using (user_id = auth.uid());

create policy "Users can insert their own agent runs"
  on agent_runs for insert
  with check (user_id = auth.uid());

create policy "Users can delete their own agent runs"
  on agent_runs for delete
  using (user_id = auth.uid());
