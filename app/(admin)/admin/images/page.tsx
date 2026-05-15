import AdminNav from '@/components/admin/AdminNav';
import OrphanCleanup, {
  type OrphanRow,
} from '@/components/admin/OrphanCleanup';
import {
  listOrphanImages,
  lookupStorageSize,
} from '@/lib/admin-images-cleanup';
import { createServerClient } from '@/lib/supabase';

/**
 * Admin orphan-image cleanup page (`/admin/images`).
 *
 * Server component. Fetches the current set of orphans (rows with
 * `parent_id IS NULL AND parent_type IS NULL` AND `created_at` older than
 * the `ORPHAN_CLEANUP_THRESHOLD_DAYS` grace period) via
 * {@link import('@/lib/admin-images-cleanup').listOrphanImages}, augments
 * each row with its Storage object size for the preview list, and
 * renders {@link OrphanCleanup}.
 *
 * Errors from the data layer are intentionally NOT wrapped in
 * `safeLoad` — CONSTRAINT-14 governs public pages; the admin operator
 * should see Next 15's error overlay so failures are loud and obvious.
 *
 * Auth is enforced by `middleware.ts` for `/admin/:path*`; this page never
 * renders for an unauthenticated request.
 */
export default async function Page(): Promise<React.ReactElement> {
  // Single client reused across the orphan list query AND the per-row size
  // lookups so we make exactly one auth + cookie read for the whole page
  // load (rather than one createServerClient call per orphan row, which
  // would be O(n) Next.js cookies() reads).
  const client = await createServerClient();
  const orphans = await listOrphanImages(client);
  const rows: OrphanRow[] = await Promise.all(
    orphans.map(async (orphan) => ({
      id: orphan.id,
      bucket_path: orphan.bucket_path,
      created_at: orphan.created_at,
      size: await lookupStorageSize(client, orphan.bucket_path),
    })),
  );
  return (
    <>
      <AdminNav />
      <OrphanCleanup rows={rows} />
    </>
  );
}
