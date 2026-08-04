-- =============================================================================
-- Migration: 014_other_page_model.sql
-- Purpose:   Complete the data model behind the redesigned "everything else"
--            page: extend stats with the two fields its tiles render, and add
--            the notes table backing the three text tiles.
-- Date:      2026-08-04
--
-- Plain English:
--   The redesigned Other page is a fixed 7-tile grid: 4 numeric tiles on top,
--   3 text tiles below.
--
--   The 4 numeric tiles come from `stats`, which already carries value, unit
--   and label but is missing two things the design needs -- an optional italic
--   `aside` under the label, and a deterministic display order. Ordering today
--   is (category, created_at desc), which cannot express "these four, in this
--   sequence", so `sort_order` is added.
--
--   The 3 text tiles ("Currently watching / reading / goal") have no home in
--   the schema at all. They are a kicker plus a line -- a different shape from
--   stats, with no number, unit or category -- so they get their own small
--   table rather than being forced into stats with null values.
--
-- Reproducibility: Idempotent. Re-runnable. `add column if not exists`,
--                  `create table if not exists`, named constraints and
--                  policies dropped before recreation. Once applied, never
--                  edit -- write a new migration.
--
-- Scope:     public.stats (2 columns + 1 index) and the new public.notes
--            (table + trigger + index + RLS). RLS for notes is bundled here
--            rather than split into its own file, matching the newer
--            migration 010 convention rather than the 002-005 one.
--
-- Authorization model (CONSTRAINT-08 / CONSTRAINT-09), notes table:
--   - anon          : SELECT only. Every note is public the moment it is
--                     written; there is no draft state, matching stats.
--   - authenticated : full CRUD (the single admin user).
--   - service_role  : intentionally NOT granted a policy -- it bypasses RLS by
--                     definition and adding one is redundant and a footgun.
--   - all others    : denied by default once RLS is on with no matching
--                     permissive policy.
--   The stats-ingest Edge Function is NOT granted access here: OpenClaw writes
--   stats only, never notes (CONSTRAINT-04 keeps that surface minimal).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- stats: two columns the redesigned numeric tile renders.
-- -----------------------------------------------------------------------------

alter table stats
  add column if not exists aside      text    null,
  add column if not exists sort_order integer not null default 0;

-- aside: the small italic line under the label ("the losing is part of the
-- format, apparently"). Optional, and capped so it stays a quip.
alter table stats
  drop constraint if exists stats_aside_length;

alter table stats
  add constraint stats_aside_length
    check (
      aside is null
      or length(btrim(aside)) between 1 and 160
    );

alter table stats
  drop constraint if exists stats_sort_order_non_negative;

alter table stats
  add constraint stats_sort_order_non_negative
    check (sort_order >= 0);

-- Public read is "all stats in display order". Mirrors the (status, sort_order)
-- index pattern added for projects/posts in migration 012.
create index if not exists stats_sort_order_idx
  on stats (sort_order, created_at desc);

-- -----------------------------------------------------------------------------
-- notes: the three text tiles.
-- -----------------------------------------------------------------------------

create table if not exists notes (
  id          uuid        not null default gen_random_uuid()
                          constraint notes_pkey primary key,
  kicker      text        not null
                          constraint notes_kicker_shape
                          check (length(btrim(kicker)) between 1 and 40),
  line        text        not null
                          constraint notes_line_shape
                          check (length(btrim(line)) between 1 and 120),
  sort_order  integer     not null default 0
                          constraint notes_sort_order_non_negative
                          check (sort_order >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Reuses the set_updated_at() function defined in migration 001.
drop trigger if exists notes_set_updated_at on notes;
create trigger notes_set_updated_at
  before update on notes
  for each row
  execute function public.set_updated_at();

create index if not exists notes_sort_order_idx
  on notes (sort_order, created_at desc);

-- -----------------------------------------------------------------------------
-- notes: RLS.
-- -----------------------------------------------------------------------------

alter table public.notes enable row level security;

drop policy if exists notes_public_select on public.notes;
create policy notes_public_select
  on public.notes
  for select
  to anon
  using (true);

drop policy if exists notes_admin_all on public.notes;
create policy notes_admin_all
  on public.notes
  for all
  to authenticated
  using (true)
  with check (true);
