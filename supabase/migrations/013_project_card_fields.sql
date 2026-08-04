-- =============================================================================
-- Migration: 013_project_card_fields.sql
-- Purpose:   Add the two content fields the redesigned project card renders
--            but the schema does not yet carry: a one-line subtitle and a
--            short list of tags.
-- Date:      2026-08-04
--
-- Plain English:
--   The redesigned project card has four content slots: title, a one-line
--   subtitle, a longer description, and a row of tag pills. `title` and
--   `description` already exist; this adds the other two. Both are nullable
--   and the card degrades gracefully when either is missing, so no backfill
--   is needed and every existing row stays valid.
--
-- Reproducibility: Idempotent. Re-runnable. `add column if not exists` plus
--                  named CHECK constraints dropped before being recreated.
--                  Once applied, never edit -- write a new migration.
--
-- Scope:     public.projects only. No RLS change required: the existing
--            projects_public_select / projects_admin_all policies (migration
--            002) are column-agnostic and already cover both new columns.
--
-- Note on CHECK constraints: Postgres forbids subqueries inside CHECK, so the
--   tag guards below are written entirely with array operators and immutable
--   functions. Whitespace-only tags are the one case these cannot catch; that
--   is enforced at the application layer by the zod schema, which trims before
--   validating (mirrors the T43.E pattern).
-- =============================================================================

alter table projects
  add column if not exists subtitle text   null,
  add column if not exists tags     text[] null;

-- subtitle: one short line beneath the title. Capped so it cannot quietly
-- become a second description and blow out the card layout.
alter table projects
  drop constraint if exists projects_subtitle_length;

alter table projects
  add constraint projects_subtitle_length
    check (
      subtitle is null
      or length(btrim(subtitle)) between 1 and 120
    );

-- tags: short labels rendered as pills. Guarded four ways --
--   1. cardinality cap, so the pill row cannot wrap unboundedly;
--   2. no NULL elements (array_remove comparison, not array_position, whose
--      NULL-search semantics are easy to get subtly wrong);
--   3. no empty-string elements, which would render as blank pills;
--   4. a total-length ceiling as a coarse per-element size guard.
alter table projects
  drop constraint if exists projects_tags_shape;

alter table projects
  add constraint projects_tags_shape
    check (
      tags is null
      or (
        array_length(tags, 1) between 1 and 8
        and cardinality(tags) = cardinality(array_remove(tags, null))
        and not (tags @> array['']::text[])
        and length(array_to_string(tags, ',')) <= 200
      )
    );
