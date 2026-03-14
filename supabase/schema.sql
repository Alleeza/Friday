create table if not exists public.editor_projects (
  id text primary key,
  project_json jsonb not null,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.published_projects (
  share_id text primary key,
  project_id text not null references public.editor_projects (id) on delete cascade,
  project_json jsonb not null,
  source_updated_at timestamptz not null,
  published_at timestamptz not null default timezone('utc', now())
);

create index if not exists published_projects_project_id_idx
  on public.published_projects (project_id);
