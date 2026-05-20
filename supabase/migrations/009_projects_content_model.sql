-- =============================================================================
-- Migration: 009_projects_content_model.sql
-- Purpose:   Extend `projects` with content-model fields supporting the
--            T42 public-card redesign (CONSTRAINT-05 Override 1).
--            Six nullable columns are added:
--              - github_url, live_url, post_url  (3 external/internal links)
--              - progress_percent                (0-100, ring visual)
--              - thumb_kind                      (motif key, code-side enum)
--              - image_after_id                  (FK for before/after slider)
-- Date:      2026-05-19
--
-- Reproducibility: Idempotent. Re-runnable. `add column if not exists` and
--                  the named CHECK / FK constraints make this safe to apply
--                  to dev or production multiple times.
--
-- RLS:       No new policies. The existing `projects_public_select` policy
--            (migration 002) is column-agnostic — it grants SELECT on all
--            columns when `status = 'published'`. New columns inherit this
--            policy automatically.
--
-- Storage:   No new bucket policies. `image_after_id` is a FK into the
--            existing `images` table (migration 001) which already governs
--            storage object access via its parent-row published-status
--            subquery (migration 007). CONSTRAINT-20 is satisfied without
--            additional storage RLS work.
--
-- Lifecycle: This migration adds the data model; the admin form, public
--            render, and docs land in T42 Sessions A-C. The columns are
--            all nullable so the migration applies safely before render
--            code is updated (existing rows remain valid).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Three external/internal link URL columns.
--    All nullable text. URL-shape validation happens at the admin boundary
--    (zod schema) — not at the DB level — because the validation rules
--    differ per column: github_url + live_url require https://, while
--    post_url accepts either https:// (external) or a /-prefixed relative
--    path (internal post slug). Encoding that asymmetry in CHECK constraints
--    would be brittle; the boundary-level guard is sufficient.
-- ---------------------------------------------------------------------------

alter table public.projects
  add column if not exists github_url text null,
  add column if not exists live_url   text null,
  add column if not exists post_url   text null;

-- ---------------------------------------------------------------------------
-- 2. progress_percent — integer 0-100 with NULL allowed.
--    NULL semantically means "no ring rendered" (T42 ProgressRing spec:
--    "null percent renders nothing"). 0 means "ring shown at 0%". The
--    distinction is intentional UI signal; admin form makes the choice
--    explicit. CHECK allows NULL so explicit-not-set stays clean.
-- ---------------------------------------------------------------------------

alter table public.projects
  add column if not exists progress_percent integer null;

alter table public.projects
  drop constraint if exists projects_progress_percent_range;

alter table public.projects
  add constraint projects_progress_percent_range
    check (progress_percent is null
           or (progress_percent >= 0 and progress_percent <= 100));

-- ---------------------------------------------------------------------------
-- 3. thumb_kind — motif key for the home-page thumbnail SVG.
--    Stored as text; the closed value set lives in lib/thumb-kinds.ts
--    (THUMB_KIND_OPTIONS) and is enforced at the admin boundary via zod.
--    Render-side fallback in ProjectThumb.tsx renders the `dots` motif on
--    unknown values. DB enum was considered and rejected: motif keys
--    change in code over time as new SVGs are added, and migrating a DB
--    enum for every motif addition is friction without integrity payoff
--    in a single-author scenario.
-- ---------------------------------------------------------------------------

alter table public.projects
  add column if not exists thumb_kind text null;

-- ---------------------------------------------------------------------------
-- 4. image_after_id — FK to images(id) for the before/after slider.
--    Mirrors the existing image_id FK shape (migration 001 line 96-98):
--    nullable uuid, on delete set null. When both image_id and
--    image_after_id are present, the public render uses BeforeAfterMedia;
--    when only image_id is present, it uses the standard StillMedia path.
-- ---------------------------------------------------------------------------

alter table public.projects
  add column if not exists image_after_id uuid null;

alter table public.projects
  drop constraint if exists projects_image_after_id_fkey;

alter table public.projects
  add constraint projects_image_after_id_fkey
    foreign key (image_after_id) references images(id) on delete set null;

-- =============================================================================
-- End of 009_projects_content_model.sql
-- =============================================================================
