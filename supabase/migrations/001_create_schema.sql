-- =============================================================================
-- Migration: 001_create_schema.sql
-- Purpose:   Create the four base tables (projects, posts, stats, images),
--            two enum types (project_status, post_status), and the indexes
--            required by architecture.md §2 for swarnimbagre.com.
-- Date:      2026-05-07
--
-- Reproducibility: Run in order. Idempotent. Once applied, never edit —
--                  write a new migration.
--
-- RLS:       Row-Level Security policies are NOT created here. They are added
--            in subsequent migrations (002 projects, 003 posts, 004 stats,
--            005 images). RLS is enabled together with its grant policies in
--            those migrations to avoid a window where RLS is on with no
--            policies (which would lock out all access).
--
-- Triggers:  The slug-lock BEFORE UPDATE trigger and trigger function are
--            added in migration 006_slug_lock_triggers.sql (per plan T8).
--            This migration creates a reusable set_updated_at() trigger
--            function and attaches BEFORE UPDATE triggers to projects and
--            posts so updated_at is maintained automatically.
-- =============================================================================

create extension if not exists pgcrypto;

-- =============================================================================
-- Enum types
-- =============================================================================

-- project_status: visibility state for a project. 'draft' is the default;
-- 'published' makes the project visible to anonymous readers via RLS.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'project_status') then
    create type project_status as enum ('draft', 'published');
  end if;
end
$$;

-- post_status: visibility state for a post. Same two values as project_status,
-- kept as a separate type so the two domains can diverge later without a
-- coupled migration.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'post_status') then
    create type post_status as enum ('draft', 'published');
  end if;
end
$$;

-- =============================================================================
-- Table: images
-- Stores metadata for image files held in the Supabase Storage 'images'
-- bucket. The actual binary lives in Storage; this row records the bucket
-- path, required alt text, and an optional polymorphic parent reference
-- (a project or a post). Created first because projects and posts hold an
-- FK to images.id.
-- =============================================================================

create table if not exists images (
  id           uuid        not null default gen_random_uuid()
                           constraint images_pkey primary key,
  bucket_path  text        not null
                           constraint images_bucket_path_not_empty
                           check (length(bucket_path) > 0),
  alt_text     text        not null
                           constraint images_alt_text_not_empty
                           check (length(alt_text) > 0),
  parent_id    uuid        null,
  parent_type  text        null
                           constraint images_parent_type_valid
                           check (parent_type in ('projects', 'posts') or parent_type is null),
  created_at   timestamptz not null default now()
);

-- =============================================================================
-- Table: projects
-- Stores portfolio projects. Each row has a unique URL slug, a status that
-- governs public visibility, and an optional headline image.
-- =============================================================================

create table if not exists projects (
  id           uuid           not null default gen_random_uuid()
                              constraint projects_pkey primary key,
  title        text           not null
                              constraint projects_title_length
                              check (length(title) > 0 and length(title) <= 200),
  slug         text           not null
                              constraint projects_slug_unique unique
                              constraint projects_slug_not_empty
                              check (length(slug) > 0),
  description  text           not null
                              constraint projects_description_not_empty
                              check (length(description) > 0),
  status       project_status not null default 'draft',
  image_id     uuid           null
                              constraint projects_image_id_fkey
                              references images(id) on delete set null,
  created_at   timestamptz    not null default now(),
  updated_at   timestamptz    not null default now()
);

-- =============================================================================
-- Table: posts
-- Stores writing entries. Content is stored as raw Markdown; rendering and
-- sanitization happen at read time (see CONSTRAINT-06).
-- =============================================================================

create table if not exists posts (
  id          uuid        not null default gen_random_uuid()
                          constraint posts_pkey primary key,
  title       text        not null
                          constraint posts_title_length
                          check (length(title) > 0 and length(title) <= 200),
  slug        text        not null
                          constraint posts_slug_unique unique
                          constraint posts_slug_not_empty
                          check (length(slug) > 0),
  content     text        not null
                          constraint posts_content_not_empty
                          check (length(content) > 0),
  status      post_status not null default 'draft',
  image_id    uuid        null
                          constraint posts_image_id_fkey
                          references images(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- =============================================================================
-- Table: stats
-- Append-only hobby/personal stats. Schema is intentionally flexible: a
-- 'category' text column lets new categories arrive without a migration
-- (see architecture.md §2.3). OpenClaw writes here via the stats-ingest
-- Edge Function (Phase 3); admin can read/write all rows.
-- =============================================================================

create table if not exists stats (
  id          uuid        not null default gen_random_uuid()
                          constraint stats_pkey primary key,
  category    text        not null
                          constraint stats_category_not_empty
                          check (length(category) > 0),
  label       text        not null
                          constraint stats_label_not_empty
                          check (length(label) > 0),
  value       text        not null
                          constraint stats_value_not_empty
                          check (length(value) > 0),
  unit        text        null,
  created_at  timestamptz not null default now()
);

-- =============================================================================
-- Triggers
-- =============================================================================

-- Auto-update updated_at on row modification.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_set_updated_at on projects;
create trigger projects_set_updated_at
  before update on projects
  for each row
  execute function public.set_updated_at();

drop trigger if exists posts_set_updated_at on posts;
create trigger posts_set_updated_at
  before update on posts
  for each row
  execute function public.set_updated_at();

-- =============================================================================
-- Indexes
-- =============================================================================

-- projects: public listing query reads "published, newest first".
create index if not exists projects_status_created_at_idx
  on projects (status, created_at desc);

-- posts: same access pattern as projects.
create index if not exists posts_status_created_at_idx
  on posts (status, created_at desc);

-- stats: public reads group by category, newest first within each category.
create index if not exists stats_category_created_at_idx
  on stats (category, created_at desc);
