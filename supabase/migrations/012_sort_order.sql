-- =============================================================================
-- Migration: 012_sort_order.sql
-- Purpose:   Add an explicit manual ordering column `sort_order` to
--            `projects` and `posts` so the admin can reorder rows by hand
--            (T44.A). Until now the public listing read "newest first" via
--            the (status, created_at desc) indexes from migration 001; this
--            migration introduces an admin-controlled order independent of
--            created_at, backfilled to match the existing newest-first order
--            so the public listing does not visibly reshuffle on deploy.
-- Date:      2026-06-03
--
-- Reproducibility: Idempotent. Re-runnable. `add column if not exists`, the
--                  null-guarded backfill (only sets rows still null, so a
--                  re-run never reshuffles a hand-ordered table), the
--                  drop-then-add CHECK constraint pattern (mirrors migration
--                  009 / 011), `create index if not exists`, and
--                  `create or replace function` + `drop trigger if exists`
--                  together make this safe to apply more than once.
--
-- Backfill semantics: `row_number() over (order by created_at desc) - 1`
--                  assigns the newest row sort_order 0, next 1, and so on —
--                  the same visual order the (status, created_at desc) index
--                  produced before this migration. The backfill runs only
--                  WHERE sort_order IS NULL, so applying this migration to a
--                  table that has already been hand-reordered (e.g. a re-run
--                  after T44 reorder UI shipped) leaves existing values
--                  untouched and only fills genuinely-new null rows.
--
-- updated_at: @cto DECISION (T44.A): a reorder bumps updated_at. The reorder
--             RPCs in 012a do a plain UPDATE; the existing set_updated_at
--             BEFORE UPDATE trigger (migration 001) fires normally. No
--             trigger-suppression logic. The backfill UPDATE below also fires
--             that trigger, which is acceptable for a one-time data migration.
--
-- RLS:        No new policies. `projects` and `posts` already have
--             *_public_select (anon, status='published') and *_admin_all
--             (authenticated, for all) from migrations 002 / 003. Adding a
--             column and writing to it is gated by those existing policies;
--             reorder writes come through the authenticated admin path.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Add the column (nullable first, so the backfill can run before NOT NULL).
-- ---------------------------------------------------------------------------

alter table public.projects
  add column if not exists sort_order integer;

alter table public.posts
  add column if not exists sort_order integer;

-- ---------------------------------------------------------------------------
-- 2. Backfill newest-first. Only touches rows still null, so re-runs do not
--    reshuffle a table that has since been hand-ordered.
-- ---------------------------------------------------------------------------

update public.projects p
  set sort_order = ranked.rn
  from (
    select id, (row_number() over (order by created_at desc) - 1) as rn
    from public.projects
    where sort_order is null
  ) as ranked
  where p.id = ranked.id
    and p.sort_order is null;

update public.posts po
  set sort_order = ranked.rn
  from (
    select id, (row_number() over (order by created_at desc) - 1) as rn
    from public.posts
    where sort_order is null
  ) as ranked
  where po.id = ranked.id
    and po.sort_order is null;

-- ---------------------------------------------------------------------------
-- 3. Enforce NOT NULL now that every existing row has a value, plus a
--    non-negative CHECK. The CHECK is dropped-then-added (mirrors migration
--    009 / 011) so a re-run does not error on an already-present constraint.
-- ---------------------------------------------------------------------------

alter table public.projects
  alter column sort_order set not null;

alter table public.projects
  drop constraint if exists projects_sort_order_nonneg;

alter table public.projects
  add constraint projects_sort_order_nonneg
  check (sort_order >= 0);

alter table public.posts
  alter column sort_order set not null;

alter table public.posts
  drop constraint if exists posts_sort_order_nonneg;

alter table public.posts
  add constraint posts_sort_order_nonneg
  check (sort_order >= 0);

-- ---------------------------------------------------------------------------
-- 4. Workload-aligned index. The admin listing reads "this status, in
--    sort_order"; the public listing will read published rows in sort_order
--    once the read path is repointed at T44. Mirrors the (status, created_at)
--    shape of the *_status_created_at_idx indexes from migration 001.
-- ---------------------------------------------------------------------------

create index if not exists projects_status_sort_order_idx
  on public.projects (status, sort_order);

create index if not exists posts_status_sort_order_idx
  on public.posts (status, sort_order);

-- ---------------------------------------------------------------------------
-- 5. Append-to-end default on INSERT. A new row with no explicit sort_order
--    lands after every existing row. A BEFORE INSERT trigger (not a column
--    DEFAULT) is required because the value depends on a query over sibling
--    rows, which a column DEFAULT cannot express. coalesce(max+1, 0) yields 0
--    for the first row in an empty table.
--
--    search_path pinned to empty per Supabase advisor
--    0011_function_search_path_mutable; the body qualifies every reference
--    with public.* so the empty path is safe. SECURITY INVOKER: the trigger
--    runs with the caller's role, so the *_admin_all RLS policy that already
--    gates the INSERT also governs the sibling-count read.
--
--    The trigger fires only when new.sort_order is null, so a caller that
--    supplies an explicit sort_order (the reorder path, or a seed script)
--    keeps its value.
-- ---------------------------------------------------------------------------

create or replace function public.projects_set_sort_order_default()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.sort_order is null then
    new.sort_order = coalesce(
      (select max(sort_order) + 1 from public.projects),
      0
    );
  end if;
  return new;
end;
$$;

drop trigger if exists projects_set_sort_order_default on public.projects;
create trigger projects_set_sort_order_default
  before insert on public.projects
  for each row
  execute function public.projects_set_sort_order_default();

create or replace function public.posts_set_sort_order_default()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.sort_order is null then
    new.sort_order = coalesce(
      (select max(sort_order) + 1 from public.posts),
      0
    );
  end if;
  return new;
end;
$$;

drop trigger if exists posts_set_sort_order_default on public.posts;
create trigger posts_set_sort_order_default
  before insert on public.posts
  for each row
  execute function public.posts_set_sort_order_default();

-- =============================================================================
-- End of 012_sort_order.sql
-- =============================================================================
