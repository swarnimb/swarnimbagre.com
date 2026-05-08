-- =============================================================================
-- Migration: 005_rls_images.sql
-- Purpose:   Enable Row-Level Security on the images table and install the
--            two policies that grant the only legitimate access paths.
-- Date:      2026-05-07
--
-- Plain English:
--   Public can view image metadata only when the parent project or post has
--   status = 'published'. Admin can do anything. Default-deny for everything
--   else. The Storage bucket policy (file access) and the 2 MB upload limit
--   are configured separately in the Supabase Dashboard — see the comment
--   block at the end of this file.
--
-- Reproducibility: Run in order after 004_rls_stats.sql. Idempotent —
--                  ENABLE ROW LEVEL SECURITY is a no-op when already enabled,
--                  and each policy is dropped before it is recreated. Once
--                  applied, never edit — write a new migration.
--
-- Scope:     This migration covers the images table only. RLS for projects,
--            posts, and stats is added in migrations 002, 003, and 004
--            respectively (per plan T4–T6).
--
-- Authorization model (CONSTRAINT-08, plan T7 references SEC-04):
--   - anon          : SELECT only, and only rows whose parent (project or
--                     post) is published. Standalone images
--                     (parent_id IS NULL) are intentionally hidden from anon —
--                     they exist only as freshly-uploaded orphans awaiting
--                     attachment, and exposing their metadata before the
--                     parent is published would leak draft content.
--   - authenticated : full CRUD (the single admin user — CONSTRAINT-09).
--   - service_role  : intentionally NOT granted a policy. Supabase's
--                     service_role bypasses RLS by definition; adding a
--                     policy for it is redundant and a footgun.
--   - all others    : denied by default once RLS is enabled with no matching
--                     permissive policy.
-- =============================================================================

alter table public.images enable row level security;

-- Public read of images whose parent is published. Standalone images
-- (parent_id NULL) and images whose parent is still a draft stay invisible
-- to anon. The subqueries hit the projects/posts primary key on a single-row
-- lookup; RLS on those tables also runs in this context, so even if this
-- policy were ever weakened, the layered RLS would still hide drafts.
drop policy if exists images_public_select on public.images;
create policy images_public_select
  on public.images
  for select
  to anon
  using (
    (parent_type = 'projects' and exists (
      select 1 from public.projects p
      where p.id = public.images.parent_id
        and p.status = 'published'
    ))
    or
    (parent_type = 'posts' and exists (
      select 1 from public.posts p
      where p.id = public.images.parent_id
        and p.status = 'published'
    ))
  );

-- Admin (the single authenticated user) gets full CRUD on every row.
drop policy if exists images_admin_all on public.images;
create policy images_admin_all
  on public.images
  for all
  to authenticated
  using (true)
  with check (true);

-- =============================================================================
-- ─── Storage bucket configuration (NOT SQL — done via Dashboard) ───
-- =============================================================================
-- The file binaries themselves live in Supabase Storage, not in this table.
-- The bucket and its limits are configured by hand in the Supabase Dashboard
-- because Storage settings are not part of the SQL migration surface area.
--
--   Bucket:                `images`
--   Visibility:            PRIVATE (not public)
--   File size limit:       2097152 bytes (2 MB) — SEC-02 boundary validation
--   Allowed MIME types:    image/jpeg, image/png, image/webp
--   Storage access policy
--   for the bucket:        deferred (Phase 2 / T15 admin upload + signed URLs)
--   Configured by hand in Supabase Dashboard → Storage on 2026-05-07 by builder.
-- =============================================================================
