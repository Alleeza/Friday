alter table public.published_projects drop constraint if exists published_projects_pkey;
alter table public.published_projects add column if not exists id bigint generated always as identity;
alter table public.published_projects add constraint published_projects_pkey primary key (id);
create index if not exists published_projects_project_id_idx on public.published_projects (project_id);
