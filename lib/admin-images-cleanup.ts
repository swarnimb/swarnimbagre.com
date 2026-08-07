import type { SupabaseClient } from '@supabase/supabase-js';
import { ServiceError } from './errors';
import { createServerClient } from './supabase';
import { IMAGES_BUCKET } from './admin-images-mutations-types';
import { logMutationError } from './admin-mutation-log';

/**
 * Orphan-image cleanup helpers (T27). Sibling to
 * `lib/admin-images-orphan.ts` (orphan-on-swap helper called by every
 * parent update) and `lib/admin-images-mutations-internal.ts` (upload
 * throwing helpers). Split per CQ-03 (single responsibility) — the
 * sweep concern is exercised only by the `/admin/images` page, while
 * orphan-on-swap fires on every project / post update.
 *
 * Cleanup flow (DB-first, inverted from the upload-side compensating-
 * delete invariant):
 *
 *   1. List orphans older than `ORPHAN_CLEANUP_THRESHOLD_DAYS`.
 *   2. Pre-fetch each Storage object's size for the `freedBytes` total.
 *   3. Hard-delete the rows by id (parameterized — SEC-03).
 *   4. Remove the Storage objects.
 *
 * If step 4 fails, the DB rows from step 3 are already gone; the orphan
 * storage objects become irrecoverable from the app and must be cleaned
 * out-of-band. The failure is loud-logged with the bucket paths so a
 * human can reconcile via the Supabase dashboard. Re-running the sweep
 * is idempotent on the storage side because the rows no longer exist to
 * be re-listed. This trade-off is the inverse of the upload path's
 * compensating-delete invariant — for hard delete, the DB row is the
 * source of truth for "did cleanup succeed", and a failed Storage delete
 * leaves a true orphan storage object (acceptable, logged loud) rather
 * than a row pointing nowhere.
 *
 * This file deliberately does NOT carry the `'use server'` directive —
 * the helpers throw freely and are called by the `'use server'` wrapper
 * in `lib/admin-images-mutations.ts`. See SEC-08 / §6.6.5.
 */

/**
 * Grace period (in days) before an orphaned image row is eligible for
 * hard delete. Allows accidental swaps and mistakes during edit to be
 * recovered manually within a week — the previous image row is detached
 * by `orphanIfChanged` immediately on swap, but its Storage object stays
 * intact for this many days before the cleanup sweep claims it. CQ-04:
 * named constant with rationale comment, not a magic literal.
 */
export const ORPHAN_CLEANUP_THRESHOLD_DAYS = 7;

/** Operation tag for the orphan-list read path. */
const LIST_ORPHANS_OPERATION = 'listOrphanImages';
/** Operation tag for the orphan-cleanup write path. */
const CLEANUP_ORPHANS_OPERATION = 'deleteOrphanImages';

/** Milliseconds in one day — extracted as a named constant per CQ-04. */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Row shape returned by {@link listOrphanImages}. Only the three columns
 * the cleanup page renders + the cleanup helper needs — wider projection
 * would waste bandwidth on every list load.
 */
export interface OrphanImageRow {
  id: string;
  bucket_path: string;
  created_at: string;
}

/**
 * Result envelope returned by {@link deleteOrphanImagesInternal}. `deleted`
 * is the number of `images` rows removed; `freedBytes` is the sum of the
 * Storage objects' sizes (read from Storage `list()` metadata before the
 * remove call so the UI can render `~M MB` even when Storage delete
 * partially fails).
 */
export interface OrphanCleanupResult {
  deleted: number;
  freedBytes: number;
}

/**
 * Compute the cutoff timestamp — orphans created strictly BEFORE this
 * instant are eligible for cleanup. Extracted so callers can inject `now`
 * for boundary tests without reaching for vi.useFakeTimers (TS-05 isolation).
 */
function computeCutoff(now: Date): string {
  const cutoff = new Date(
    now.getTime() - ORPHAN_CLEANUP_THRESHOLD_DAYS * MS_PER_DAY,
  );
  return cutoff.toISOString();
}

/**
 * Fetch the current set of orphaned `images` rows older than the
 * {@link ORPHAN_CLEANUP_THRESHOLD_DAYS} grace period. Used by the
 * `/admin/images` page to render the cleanup preview list AND by
 * {@link deleteOrphanImagesInternal} as the candidate set for the sweep.
 *
 * Uses parameterized PostgREST — `parent_id IS NULL`, `parent_type IS
 * NULL`, and `created_at < cutoff` — never string concatenation
 * (SEC-03). RLS (`images_admin_all` from migration 005) governs row
 * visibility; admin sees every row.
 *
 * @param client Optional injected client (DI seam for tests). Defaults to
 *               a request-scoped admin server client.
 * @param now    Optional clock injection — defaults to `new Date()`. Tests
 *               pin this to verify the boundary cutoff.
 * @returns The orphan rows (id, bucket_path, created_at), newest first.
 * @throws ServiceError on any Supabase error.
 */
export async function listOrphanImages(
  client?: SupabaseClient,
  now: Date = new Date(),
): Promise<OrphanImageRow[]> {
  const supabase = client ?? (await createServerClient());
  const cutoffIso = computeCutoff(now);
  const { data, error } = await supabase
    .from('images')
    .select('id, bucket_path, created_at')
    .is('parent_id', null)
    .is('parent_type', null)
    .lt('created_at', cutoffIso)
    .order('created_at', { ascending: false });
  if (error) {
    logMutationError(LIST_ORPHANS_OPERATION, {
      errorCode: error.code ?? null,
      errorMessage: error.message ?? null,
    });
    throw new ServiceError(`${LIST_ORPHANS_OPERATION} failed`, {
      operation: LIST_ORPHANS_OPERATION,
      cause: error,
    });
  }
  return (data ?? []) as OrphanImageRow[];
}

/**
 * Look up the Storage object size for a single bucket path. Returns `null`
 * when the object cannot be located or the listing call rejects — partial
 * failures contribute `null` to the per-row preview rather than aborting
 * the page render.
 *
 * Uses Supabase Storage `list(prefix, { search: basename })` which scopes
 * the listing to the parent "directory" and matches by basename in one
 * round trip per object. The cost is one list call per orphan; the
 * orphan-list size is bounded by how often the cleanup sweep runs.
 */
export async function lookupStorageSize(
  client: SupabaseClient,
  bucketPath: string,
): Promise<number | null> {
  const lastSlash = bucketPath.lastIndexOf('/');
  const prefix = lastSlash > 0 ? bucketPath.slice(0, lastSlash) : '';
  const basename = bucketPath.slice(lastSlash + 1);
  const { data, error } = await client.storage
    .from(IMAGES_BUCKET)
    .list(prefix, { search: basename });
  if (error) {
    logMutationError(CLEANUP_ORPHANS_OPERATION, {
      bucketPath,
      warning: 'storage list failed; size omitted',
      errorMessage: error.message ?? null,
    });
    return null;
  }
  const entry = (data ?? []).find(
    (d: { name?: string }) => d.name === basename,
  );
  const size = (entry as { metadata?: { size?: number } } | undefined)
    ?.metadata?.size;
  return typeof size === 'number' ? size : null;
}

/**
 * Sum the sizes of Storage objects at the given bucket paths. Failures to
 * resolve a single object's size contribute 0 to the total — same partial-
 * tolerance posture as {@link lookupStorageSize}.
 */
async function sumStorageBytes(
  client: SupabaseClient,
  bucketPaths: string[],
): Promise<number> {
  let total = 0;
  for (const path of bucketPaths) {
    const size = await lookupStorageSize(client, path);
    if (size !== null) total += size;
  }
  return total;
}

/**
 * Hard-delete every orphaned `images` row older than the grace period
 * AND every matching Storage object. Throwing helper — the public Server
 * Action `deleteOrphanImages` in `lib/admin-images-mutations.ts` catches
 * and converts to the uniform state envelope.
 *
 * Order is DB-first; see module JSDoc for the failure-mode rationale.
 *
 * @param client Optional injected client (DI seam for tests). Defaults to
 *               a request-scoped admin server client.
 * @param now    Optional clock injection — defaults to `new Date()`.
 * @returns `{ deleted, freedBytes }` for surfacing to the UI.
 * @throws ServiceError when the row delete itself rejects (Storage
 *                     errors are logged but do not throw — the row delete
 *                     is the source of truth for "did cleanup succeed").
 */
export async function deleteOrphanImagesInternal(
  client?: SupabaseClient,
  now: Date = new Date(),
): Promise<OrphanCleanupResult> {
  const supabase = client ?? (await createServerClient());
  const orphans = await listOrphanImages(supabase, now);
  if (orphans.length === 0) return { deleted: 0, freedBytes: 0 };

  const ids = orphans.map((r) => r.id);
  const bucketPaths = orphans.map((r) => r.bucket_path);
  const freedBytes = await sumStorageBytes(supabase, bucketPaths);

  const { error: deleteErr } = await supabase
    .from('images')
    .delete()
    .in('id', ids);
  if (deleteErr) {
    logMutationError(CLEANUP_ORPHANS_OPERATION, {
      candidateIdCount: ids.length,
      errorCode: deleteErr.code ?? null,
      errorMessage: deleteErr.message ?? null,
    });
    throw new ServiceError(`${CLEANUP_ORPHANS_OPERATION} failed`, {
      operation: CLEANUP_ORPHANS_OPERATION,
      cause: deleteErr,
    });
  }

  const { error: removeErr } = await supabase.storage
    .from(IMAGES_BUCKET)
    .remove(bucketPaths);
  if (removeErr) {
    // Loud log — DB rows are already gone, so re-running the sweep won't
    // pick these objects up again. A human reconciles via the Supabase
    // dashboard using the bucketPaths in the structured log entry.
    logMutationError(CLEANUP_ORPHANS_OPERATION, {
      warning:
        'storage remove failed AFTER row delete: orphan storage objects unrecoverable from app',
      bucketPaths,
      errorMessage: removeErr.message ?? null,
    });
  }
  return { deleted: ids.length, freedBytes };
}
