-- =============================================================================
-- Migration: 006_slug_lock_triggers.sql
-- Purpose:   Lock the `slug` column on `projects` and `posts` once a row's
--            status flips to 'published'. Adds one PL/pgSQL trigger function
--            and two BEFORE UPDATE triggers that enforce slug immutability
--            at the database level (CONSTRAINT-12).
-- Date:      2026-05-07
--
-- Reproducibility: Run in order. Idempotent. Once applied, never edit —
--                  write a new migration. The function uses
--                  CREATE OR REPLACE and each trigger is preceded by
--                  DROP TRIGGER IF EXISTS so the file is safe to re-run.
--
-- Plain English:
--   Slugs are immutable once published. This is a contract with anyone who
--   has linked to a published page. Drafts can change freely; once status
--   flips to published, the slug is locked. Other column updates on
--   published rows are unaffected — the trigger fires only when an UPDATE
--   statement touches the slug column.
--
-- Reference: CONSTRAINT-12 (docs/constraints.md).
-- =============================================================================

-- =============================================================================
-- Trigger function: prevent_slug_change_after_publish
-- Returns trigger. Used by the BEFORE UPDATE OF slug triggers below.
-- Logic: if the row was already published before this UPDATE AND the slug
-- value is actually changing, raise an exception. Otherwise return NEW and
-- allow the UPDATE to proceed. IS DISTINCT FROM is used (not !=) so that a
-- defensive NULL on either side is handled correctly.
-- =============================================================================

create or replace function public.prevent_slug_change_after_publish()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'published' and old.slug is distinct from new.slug then
    raise exception
      'Cannot change slug on published % (old=%, new=%). Slugs are immutable once published.',
      tg_table_name, old.slug, new.slug;
  end if;
  return new;
end;
$$;

-- =============================================================================
-- Triggers
-- BEFORE UPDATE OF slug — the trigger fires only when the slug column is
-- part of the UPDATE statement's SET clause. Updates that touch only
-- description / status / image_id / etc. bypass the trigger entirely, which
-- is both more efficient and clearer in intent than firing on every UPDATE
-- and short-circuiting inside the function.
-- =============================================================================

drop trigger if exists projects_prevent_slug_change on public.projects;
create trigger projects_prevent_slug_change
  before update of slug on public.projects
  for each row
  execute function public.prevent_slug_change_after_publish();

drop trigger if exists posts_prevent_slug_change on public.posts;
create trigger posts_prevent_slug_change
  before update of slug on public.posts
  for each row
  execute function public.prevent_slug_change_after_publish();
