-- =============================================================================
-- Migration: 008_storage_images_limits.sql
-- Purpose:   Codify the 'images' Storage bucket size + MIME-type limits in
--            version control. Until now these were set by hand in the Supabase
--            Dashboard (see the trailing comment block in 005_rls_images.sql),
--            so a project provisioned or restored purely from migrations had
--            NO bucket-level cap until someone manually reconfigured it — the
--            second enforcement layer SEC-02 (uploads) requires was not
--            reproducible. This migration makes the bucket limits reproducible
--            and authoritative.
-- Date:      2026-05-15
--
-- Supersedes: the "Storage bucket configuration (NOT SQL — done via Dashboard)"
--             note at the end of 005_rls_images.sql. The size/MIME limits are
--             now codified here. Bucket existence + PRIVATE visibility remain a
--             Phase-2 Dashboard setup step (005), and the storage.objects RLS
--             policy remains as established in 007 — unchanged by this file.
--
-- Plain English:
--   The 'images' bucket rejects any upload over 2 MB, or whose content type is
--   not JPEG / PNG / WebP, at the storage layer itself — independent of the
--   application-side validateFile() boundary check. Both layers must agree:
--   the numbers here mirror MAX_FILE_BYTES + ALLOWED_MIME_TYPES in
--   lib/admin-images-mutations-types.ts. Changing one without the other
--   reopens finding F-30.
--
-- Reproducibility: Run after 007_rls_storage_images.sql. Idempotent — it sets
--                  absolute values with UPDATE, so re-running is a no-op when
--                  the bucket already matches. Once applied, never edit —
--                  write a new migration. Assumes the 'images' bucket already
--                  exists (created during Phase-2 Dashboard setup); this
--                  migration configures it, it does not create it. If the
--                  bucket is absent the UPDATE affects 0 rows silently —
--                  bucket creation reproducibility is out of scope for F-30
--                  and would change the provisioning model (architectural).
--
-- SEC-02 (uploads): type AND size are now enforced at BOTH the action boundary
--                   (lib/admin-images-mutations-internal.ts::validateFile) AND
--                   the Storage bucket policy (here). Closes finding F-30
--                   (docs/security-report.md audit 16).
-- =============================================================================

-- 2097152 bytes = 2 MB. Mirrors MAX_FILE_BYTES in
-- lib/admin-images-mutations-types.ts — keep the two in lockstep.
update storage.buckets
set
  file_size_limit = 2097152,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'images';
