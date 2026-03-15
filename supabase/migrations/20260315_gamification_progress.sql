create table if not exists public.gamification_progress (
  user_id text primary key,
  progress_json jsonb not null,
  updated_at timestamptz not null default timezone('utc', now())
);
