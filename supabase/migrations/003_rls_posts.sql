-- =============================================================================
-- Migration: 003_rls_posts.sql
-- Purpose:   Enable Row-Level Security on the posts table and install the
--            two policies that grant the only legitimate access paths.
-- Date:      2026-05-07
--
-- Plain English:
--   Public can read published. Admin can do anything. Default-deny for
--   everything else.
--
-- Reproducibility: Run in order after 002_rls_projects.sql. Idempotent —
--                  ENABLE ROW LEVEL SECURITY is a no-op when already enabled,
--                  and each policy is dropped before it is recreated. Once
--                  applied, never edit — write a new migration.
--
-- Scope:     This migration covers the posts table only. RLS for projects,
--            stats, and images is added in migrations 002, 004, and 005
--            respectively (per plan T4, T6–T7).
--
-- Authorization model (CONSTRAINT-08, plan T5 references SEC-04):
--   - anon          : SELECT only, and only rows with status = 'published'.
--   - authenticated : full CRUD (the single admin user — CONSTRAINT-09).
--   - service_role  : intentionally NOT granted a policy. Supabase's
--                     service_role bypasses RLS by definition; adding a
--                     policy for it is redundant and a footgun.
--   - all others    : denied by default once RLS is enabled with no matching
--                     permissive policy.
-- =============================================================================

alter table public.posts enable row level security;

-- Public read of published posts only. Drafts stay invisible to anon.
drop policy if exists posts_public_select on public.posts;
create policy posts_public_select
  on public.posts
  for select
  to anon
  using (status = 'published');

-- Admin (the single authenticated user) gets full CRUD on every row.
drop policy if exists posts_admin_all on public.posts;
create policy posts_admin_all
  on public.posts
  for all
  to authenticated
  using (true)
  with check (true);
