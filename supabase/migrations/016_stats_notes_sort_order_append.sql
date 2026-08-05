-- =============================================================================
-- Migration: 016_stats_notes_sort_order_append.sql
-- Purpose:   Give `stats` and `notes` the same append-on-insert `sort_order`
--            behaviour that `projects` and `posts` received in 012. A new row
--            with no explicit position lands at the END of the list instead of
--            colliding at 0 with every other row.
-- Date:      2026-08-04
--
-- The bug this fixes: migration 014 gave both columns `not null default 0`.
--            Every insert that did not name a position therefore got 0, so all
--            rows tied and the display order collapsed to the `created_at`
--            tiebreak. `projects` / `posts` avoid this by having NO column
--            default -- an omitted `sort_order` arrives NULL and the BEFORE
--            INSERT trigger computes `max + 1`. This migration brings the two
--            newer tables onto that same pattern.
--
-- Why the default must be DROPPED, not just trigger-wrapped: a column DEFAULT
--            is applied before BEFORE INSERT triggers run, so `new.sort_order`
--            would never be NULL and a 012-style trigger would be dead code.
--            The columns stay `not null` -- the trigger populates the value
--            before the constraint is checked, exactly as on projects/posts.
--
-- Deploy order: this migration is safe to apply AHEAD of the application
--            change that stops sending an explicit 0. The currently-deployed
--            code always sends a concrete `sort_order`, which the trigger
--            leaves untouched. Applying app-first would be the unsafe order
--            (omitted key -> NULL -> not-null violation), so DB goes first.
--
-- Backfill:  none required. Both tables were empty at apply time (verified:
--            `select count(*) from public.stats` and `public.notes` both 0).
--            Had rows existed, dropping a default does not rewrite them, and
--            the existing `*_sort_order_non_negative` CHECKs still hold.
--
-- Reproducibility: idempotent. `drop default` on a column that has none is a
--            no-op, `create or replace function` rewrites the body, and each
--            trigger is dropped before being recreated.
--
-- Rollback:  re-add the defaults and drop the triggers:
--              alter table public.stats alter column sort_order set default 0;
--              alter table public.notes alter column sort_order set default 0;
--              drop trigger if exists stats_set_sort_order_default on public.stats;
--              drop trigger if exists notes_set_sort_order_default on public.notes;
-- =============================================================================

alter table public.stats alter column sort_order drop default;
alter table public.notes alter column sort_order drop default;

-- ---------------------------------------------------------------------------
-- Append-on-insert triggers. Byte-for-byte the 012 pattern:
--
--   `coalesce(max(sort_order) + 1, 0)` yields 0 for the first row in an empty
--   table and appends thereafter -- a running position a column DEFAULT cannot
--   express.
--
--   search_path pinned to empty per Supabase advisor
--   0011_function_search_path_mutable; the body qualifies every reference with
--   public.* so the empty path is safe. SECURITY INVOKER: the trigger runs with
--   the caller's role, so the *_admin_all RLS policy that already gates the
--   INSERT also governs the sibling-count read.
--
--   Fires only when new.sort_order is null, so a caller that supplies an
--   explicit position -- the admin form with a number typed in, or a seed
--   script -- keeps its value.
-- ---------------------------------------------------------------------------

create or replace function public.stats_set_sort_order_default()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.sort_order is null then
    new.sort_order = coalesce(
      (select max(sort_order) + 1 from public.stats),
      0
    );
  end if;
  return new;
end;
$$;

drop trigger if exists stats_set_sort_order_default on public.stats;
create trigger stats_set_sort_order_default
  before insert on public.stats
  for each row
  execute function public.stats_set_sort_order_default();

create or replace function public.notes_set_sort_order_default()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.sort_order is null then
    new.sort_order = coalesce(
      (select max(sort_order) + 1 from public.notes),
      0
    );
  end if;
  return new;
end;
$$;

drop trigger if exists notes_set_sort_order_default on public.notes;
create trigger notes_set_sort_order_default
  before insert on public.notes
  for each row
  execute function public.notes_set_sort_order_default();

-- =============================================================================
-- End of 016_stats_notes_sort_order_append.sql
-- =============================================================================
