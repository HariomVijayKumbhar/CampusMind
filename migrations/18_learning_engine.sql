-- 18_learning_engine.sql
-- Personalized learning: spaced-repetition flashcards, study sessions,
-- weak areas, learning paths.

create table if not exists flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  question text not null,
  answer text not null,
  topic text,
  front text,
  back text,
  source_chunk_id uuid references document_chunks(id) on delete set null,
  ease_factor real default 2.5,
  interval_days int default 1,
  repetitions int default 0,
  due_date timestamp with time zone default now(),
  last_reviewed timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);
create index if not exists idx_flashcards_user_due on flashcards(user_id, due_date);

create table if not exists study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  session_type text not null check (session_type in ('chat', 'flashcard', 'quiz', 'summarize')),
  duration_seconds int,
  items_reviewed int,
  correct_count int,
  created_at timestamp with time zone default now()
);
create index if not exists idx_study_sessions_user on study_sessions(user_id, created_at desc);

create table if not exists weak_areas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  topic text not null,
  failure_count int default 1,
  last_seen timestamp with time zone default now(),
  confidence_score real,
  created_at timestamp with time zone default now(),
  unique (user_id, topic)
);
create index if not exists idx_weak_areas_user on weak_areas(user_id, failure_count desc);

create table if not exists learning_paths (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  collection_id uuid references collections(id) on delete set null,
  path jsonb,
  score real,
  completed boolean default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table flashcards enable row level security;
create policy "Users can manage their own flashcards"
  on flashcards for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

alter table study_sessions enable row level security;
create policy "Users can read their own study sessions"
  on study_sessions for select using (user_id = auth.uid());
create policy "Users can insert their own study sessions"
  on study_sessions for insert with check (user_id = auth.uid());

alter table weak_areas enable row level security;
create policy "Users can manage their own weak areas"
  on weak_areas for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

alter table learning_paths enable row level security;
create policy "Users can manage their own learning paths"
  on learning_paths for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
