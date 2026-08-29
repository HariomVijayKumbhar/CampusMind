-- Exam planner: exams and AI-generated study plans
create table if not exists exams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  subject text not null,
  exam_date date not null,
  topics text not null default '',        -- comma/newline separated topics
  plan jsonb default '[]'::jsonb,         -- AI-generated study schedule
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index if not exists idx_exams_user on exams(user_id, exam_date);

alter table exams enable row level security;

create policy "Users can read their own exams" on exams
  for select using (user_id = auth.uid());

create policy "Users can insert their own exams" on exams
  for insert with check (user_id = auth.uid());

create policy "Users can update their own exams" on exams
  for update using (user_id = auth.uid());

create policy "Users can delete their own exams" on exams
  for delete using (user_id = auth.uid());
