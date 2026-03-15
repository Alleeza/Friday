create table if not exists public.editor_projects (
  id text primary key,
  project_json jsonb not null,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.published_projects (
  id bigint generated always as identity primary key,
  project_id text not null references public.editor_projects (id) on delete cascade,
  share_id text not null unique,
  project_json jsonb not null,
  source_updated_at timestamptz not null,
  published_at timestamptz not null default timezone('utc', now())
);

create index if not exists published_projects_project_id_idx
  on public.published_projects (project_id);

create index if not exists published_projects_share_id_idx
  on public.published_projects (share_id);

create table if not exists public.gamification_progress (
  user_id text primary key,
  progress_json jsonb not null,
  updated_at timestamptz not null default timezone('utc', now())
);
