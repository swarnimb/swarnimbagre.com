-- =============================================================================
-- Migration: 010_project_media.sql
-- Purpose:   Create the `project_media` table that backs the project media
--            multi-image carousel (T43, Override 2 / CONSTRAINT-22). Each
--            row is one carousel slide for one project: a still image OR a
--            before/after pair (when image_after_id is non-null), with an
--            optional caption and an explicit order_index.
-- Date:      2026-05-20
--
-- Reproducibility: Idempotent. Re-runnable. `create table if not exists`,
--                  `create index if not exists`, `drop policy if exists` +
--                  `create policy`, `drop trigger if exists` + `create
--                  trigger`, and `create or replace function` together make
--                  this migration safe to apply to dev or production
--                  multiple times.
--
-- RLS:       New table — RLS enabled in this migration along with the two
--            policies that grant access. Default-deny per CONSTRAINT-08 is
--            satisfied: anon gets only SELECT-via-published-parent (mirrors
--            the images_public_select join shape from migration 005);
--            authenticated gets full CRUD via the admin policy.
--
-- Storage:   No new Storage bucket and no new `storage.objects` policy
--            needed. project_media rows reference existing `images` rows
--            via image_id / image_after_id, and the `images` table already
--            governs Storage object access via its parent-row published-
--            status subquery (migration 007). CONSTRAINT-20 is satisfied
--            without additional Storage RLS work for this migration.
--            Documented at T43.C acceptance criterion 5.
--
-- Backward-compat: `projects.image_id` and `projects.image_after_id`
--                  columns (migrations 001 + 009) are intentionally left
--                  in place. The read path falls back to those legacy
--                  columns when a project has zero `project_media` rows.
--                  New uploads route through `project_media`. The legacy
--                  columns are deprecation-in-progress; removal is not
--                  scheduled and is gated on a future cleanup migration.
--
-- Lifecycle: This migration adds the data model only. TypeScript types +
--            queries land in T43.D; the atomic save Server Action in
--            T43.E; admin form in T43.F; public carousel render in T43.G;
--            wire-in at T43.H; cross-doc closure at T43.I.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Table: public.project_media
--    Inline constraints (CHECK + FK) chosen because `create table if not
--    exists` either creates the whole table or skips it entirely — there
--    is no partial-state scenario where a constraint would exist without
--    its table. The named-constraint drop/add pattern used in migration
--    009 was specific to altering an existing table; not needed here.
-- ---------------------------------------------------------------------------

create table if not exists public.project_media (
  id              uuid        not null default gen_random_uuid()
                              constraint project_media_pkey primary key,
  project_id      uuid        not null
                              constraint project_media_project_id_fkey
                                references public.projects(id) on delete cascade,
  image_id        uuid        not null
                              constraint project_media_image_id_fkey
                                references public.images(id) on delete restrict,
  image_after_id  uuid        null
                              constraint project_media_image_after_id_fkey
                                references public.images(id) on delete restrict,
  constraint project_media_before_after_distinct
    check (image_after_id is null or image_after_id <> image_id),
  caption         text        null
                              constraint project_media_caption_length
                                check (caption is null or char_length(caption) <= 280),
  order_index     integer     not null
                              constraint project_media_order_index_nonneg
                                check (order_index >= 0),
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. Compound index for ordered fetches.
--    Every read query is "give me the media for project X in order", so
--    the (project_id, order_index) compound index is the workload-aligned
--    shape. Postgres can use this both for the project_id equality filter
--    and the order_index ASC sort.
-- ---------------------------------------------------------------------------

create index if not exists project_media_project_order_idx
  on public.project_media (project_id, order_index);

-- ---------------------------------------------------------------------------
-- 3. Enable RLS. Default-deny per CONSTRAINT-08.
--    `enable row level security` is idempotent (no-op if already enabled).
-- ---------------------------------------------------------------------------

alter table public.project_media enable row level security;

-- ---------------------------------------------------------------------------
-- 4. Policy: project_media_public_select
--    Anonymous SELECT, gated on the parent project being published.
--    Mirrors the images_public_select join shape from migration 005 line
--    16-30 (the projects-branch). One join target here vs. two in 005
--    because project_media has no polymorphic parent_type — it's always
--    a child of projects.
-- ---------------------------------------------------------------------------

drop policy if exists project_media_public_select on public.project_media;
create policy project_media_public_select
  on public.project_media
  for select
  to anon
  using (
    exists (
      select 1
      from public.projects p
      where p.id = public.project_media.project_id
        and p.status = 'published'
    )
  );

-- ---------------------------------------------------------------------------
-- 5. Policy: project_media_admin_all
--    Authenticated role (the single admin user, post-magic-link login per
--    CONSTRAINT-09) gets full CRUD. Mirrors images_admin_all shape from
--    migration 005.
-- ---------------------------------------------------------------------------

drop policy if exists project_media_admin_all on public.project_media;
create policy project_media_admin_all
  on public.project_media
  for all
  to authenticated
  using (true)
  with check (true);

-- ---------------------------------------------------------------------------
-- 6. Row-cap enforcement trigger.
--    20-row hard cap per project, enforced at the DB level rather than only
--    at the zod boundary, because schema-level enforcement protects against
--    direct DB writes (admin SQL, future automation) and against zod-layer
--    bypasses. The zod check at T43.E is a defense-in-depth layer on top.
--
--    Why a trigger and not a CHECK constraint: CHECK constraints can only
--    see the row being inserted, not the existing row count. A trigger
--    function can count siblings.
--
--    Bulk-insert semantics: Postgres processes multi-row INSERTs row-by-row
--    at the executor level. Each row's BEFORE trigger sees the rows already
--    inserted by the same statement (because BEFORE fires after the prior
--    row's INSERT has materialized). So a single-statement INSERT of 21
--    rows for one project_id raises on row 21 and rolls back the whole
--    statement (statement-level atomicity). Acceptance criterion 4.
--
--    Trigger scope (INSERT + UPDATE of project_id): firing on UPDATE of
--    project_id closes the move-row-between-projects bypass — a direct
--    `update project_media set project_id = '<B>' where ...` against a
--    project B that already has 20 rows would otherwise sidestep the cap.
--    Per @cto pre-apply review.
-- ---------------------------------------------------------------------------

create or replace function public.project_media_enforce_row_cap()
returns trigger
language plpgsql
-- search_path pinned to empty per Supabase advisor
-- 0011_function_search_path_mutable. Function body qualifies every
-- reference with public.* so the pinned empty path is safe.
set search_path = ''
as $$
declare
  current_count integer;
begin
  select count(*) into current_count
    from public.project_media
    where project_id = new.project_id;
  if current_count >= 20 then
    raise exception
      'project_media row cap exceeded: project % already has % rows (max 20)',
      new.project_id, current_count;
  end if;
  return new;
end;
$$;

drop trigger if exists project_media_rowcap_trigger on public.project_media;
create trigger project_media_rowcap_trigger
  before insert or update of project_id on public.project_media
  for each row
  execute function public.project_media_enforce_row_cap();

-- =============================================================================
-- End of 010_project_media.sql
-- =============================================================================
