-- =============================================================================
-- Migration: 004_rls_stats.sql
-- Purpose:   Enable Row-Level Security on the stats table and install the
--            two policies that grant the only legitimate access paths.
-- Date:      2026-05-07
--
-- Plain English:
--   Public can read all stats (append-only display). Programmatic INSERTs come
--   via the stats-ingest Edge Function in Phase 3, using the service role.
--   Admin can do anything.
--
-- Reproducibility: Run in order after 003_rls_posts.sql. Idempotent —
--                  ENABLE ROW LEVEL SECURITY is a no-op when already enabled,
--                  and each policy is dropped before it is recreated. Once
--                  applied, never edit — write a new migration.
--
-- Scope:     This migration covers the stats table only. RLS for projects,
--            posts, and images is added in migrations 002, 003, and 005
--            respectively (per plan T4–T5, T7).
--
-- Authorization model (CONSTRAINT-08, plan T6 references SEC-04):
--   - anon          : SELECT only, all rows (no draft/published concept on
--                     stats — every row is public the moment it is written).
--                     No INSERT policy: anon must never write stats directly.
--                     Telegram bot writes flow through the stats-ingest Edge
--                     Function in Phase 3 using the service role, which
--                     bypasses RLS by design (CONSTRAINT-04).
--   - authenticated : full CRUD (the single admin user — CONSTRAINT-09).
--   - service_role  : intentionally NOT granted a policy. Supabase's
--                     service_role bypasses RLS by definition; adding a
--                     policy for it is redundant and a footgun.
--   - all others    : denied by default once RLS is enabled with no matching
--                     permissive policy.
-- =============================================================================

alter table public.stats enable row level security;

-- Public read of all stats. No status filter — stats have no draft state.
drop policy if exists stats_public_select on public.stats;
create policy stats_public_select
  on public.stats
  for select
  to anon
  using (true);

-- Admin (the single authenticated user) gets full CRUD on every row.
drop policy if exists stats_admin_all on public.stats;
create policy stats_admin_all
  on public.stats
  for all
  to authenticated
  using (true)
  with check (true);
