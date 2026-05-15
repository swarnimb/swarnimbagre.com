-- =============================================================================
-- Migration: 007_rls_storage_images.sql
-- Purpose:   Install Row-Level Security policies on storage.objects for the
--            'images' bucket. Without these, every upload (INSERT into
--            storage.objects) is denied by default, surfacing as
--            "new row violates row-level security policy" from the Supabase
--            Storage SDK — which was the T28 smoke-test blocker after the
--            BLOCKING-01 fix (root cause: 005_rls_images.sql configured the
--            public.images table policies but explicitly deferred Storage
--            bucket access to "T15 admin upload + signed URLs", and that
--            deferred work was never landed).
-- Date:      2026-05-14
--
-- Plain English:
--   The 'images' bucket is PRIVATE (storage.buckets.public = false). Admin
--   (the single authenticated user — CONSTRAINT-09) can do anything to the
--   files inside it: upload, read, update, delete. Public visitors cannot
--   touch storage.objects directly — all public access to image binaries
--   flows through signed URLs minted by the application layer. Default-deny
--   for everything else.
--
-- Reproducibility: Run after 006_slug_lock_triggers.sql. Idempotent — each
--                  policy is dropped before it is recreated. Once applied,
--                  never edit — write a new migration. Storage RLS is
--                  enabled by default on storage.objects (Supabase ships it
--                  that way), so no `enable row level security` statement
--                  is needed here.
--
-- Scope:     This migration covers storage.objects rows whose bucket_id =
--            'images' only. Other buckets (none today, but the pattern is
--            scoped per-bucket) are not affected — their absence of a
--            matching permissive policy keeps them default-denied.
--
-- Authorization model (CONSTRAINT-08, CONSTRAINT-09; mirrors public.images
-- policy shape from 005_rls_images.sql):
--   - anon          : NO direct storage.objects access. Public image reads
--                     happen via application-issued signed URLs only —
--                     storage.objects RLS is bypassed by the Storage API
--                     when serving a valid signed URL, so this is intended.
--   - authenticated : full CRUD on storage.objects rows scoped to bucket_id
--                     = 'images'. Mirrors images_admin_all on public.images
--                     (USING true / WITH CHECK true), but constrained to the
--                     'images' bucket via the predicate so future buckets
--                     start default-denied.
--   - service_role  : intentionally NOT granted a policy. Supabase's
--                     service_role bypasses RLS by definition.
--   - all others    : denied by default (no permissive policy).
--
-- Predicate note: bucket_id = 'images' is checked in BOTH `using` (read /
-- delete / update visibility) AND `with_check` (insert / update target row).
-- The WITH CHECK predicate is what was missing for INSERT specifically — a
-- policy with USING but no WITH CHECK denies INSERT/UPDATE because there is
-- no clause to satisfy on the new row.
-- =============================================================================

-- Admin (the single authenticated user) gets full CRUD on storage.objects
-- rows in the 'images' bucket. Mirrors public.images.images_admin_all shape.
drop policy if exists images_storage_admin_all on storage.objects;
create policy images_storage_admin_all
  on storage.objects
  for all
  to authenticated
  using (bucket_id = 'images')
  with check (bucket_id = 'images');

-- =============================================================================
-- Why no anon SELECT policy on storage.objects?
-- =============================================================================
-- The 'images' bucket is PRIVATE. Public visitors never hit storage.objects
-- directly. The application reads public.images metadata under the
-- images_public_select policy (anon, scoped to published parents) and then
-- mints a short-lived signed URL via supabase.storage.from('images').
-- createSignedUrl(...). Signed-URL serving bypasses storage.objects RLS,
-- so adding an anon SELECT policy here would be (a) unused on the read path
-- and (b) a footgun — it would let anon enumerate object names directly
-- via the Storage REST API, leaking draft attachments. Default-deny stays.
-- =============================================================================
