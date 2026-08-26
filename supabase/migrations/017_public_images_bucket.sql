-- =============================================================================
-- 017_public_images_bucket.sql
--
-- Flip the `images` bucket from private to public and grant anon read on
-- storage.objects.
--
-- WHY: image URLs were minted per request via createSignedUrl (TTL 3600s,
-- CONSTRAINT-15). Two costs followed from that:
--
--   1. Every render of /projects (force-dynamic) re-signed every image. Any
--      transient storage failure was swallowed by resolveMediaImage and the
--      image silently vanished for that render, so images appeared and
--      disappeared between reloads.
--   2. Signed, short-TTL URLs cannot be optimised or edge-cached by
--      next/image, so cold visitors downloaded full-size originals every
--      time (the largest carousel PNG is ~441KB).
--
-- Every image in this bucket is a screenshot of a public demo already linked
-- from the site, so the private bucket was protecting nothing.
--
-- ACCEPTED TRADE-OFF: objects belonging to unpublished drafts become readable
-- by anyone who knows the path. Row-level security on public.images still
-- hides the *records* from anon (migration 005), so drafts stay invisible in
-- the UI; only direct object URLs are reachable. Builder approved 2026-08-25.
--
-- Reverses CONSTRAINT-15. See docs/constraints.md for the amendment.
-- =============================================================================

update storage.buckets
set public = true
where id = 'images';

-- Public buckets are served without an RLS check on the public object path,
-- but the authenticated API path still consults storage.objects. Grant anon
-- select explicitly so both routes agree rather than relying on the bucket
-- flag alone.
drop policy if exists images_storage_anon_select on storage.objects;
create policy images_storage_anon_select
  on storage.objects
  for select
  to anon
  using (bucket_id = 'images');
