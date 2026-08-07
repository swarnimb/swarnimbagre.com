import type { SupabaseClient } from '@supabase/supabase-js';
import { logMutationError } from './admin-mutation-log';

/**
 * Orphan-on-swap helper for the admin IMAGES surface. Sibling to
 * `lib/admin-images-mutations-internal.ts`; split out under CQ-02
 * (services < 300 lines) because the upload-side surface already
 * approaches the cap and orphan-on-swap is its own self-contained
 * concern.
 *
 * The helpers are called from the project/post update paths when
 * the form's selected `image_id` differs from the parent row's previous
 * `image_id`: the previous image row is detached (rather than deleted)
 * so the underlying Storage object stays available for out-of-band
 * cleanup. CONSTRAINT-07's path scheme encodes the original parent
 * type/id, which preserves forensic context after the row is orphaned.
 *
 * The orphan-cleanup sweep itself (T27 — list older-than-grace orphans
 * and hard-delete row + Storage object) lives in
 * `lib/admin-images-cleanup.ts`. Splitting per CQ-03 keeps the orphan-
 * on-swap concern (called by every parent update) isolated from the
 * batch sweep concern (called only by the `/admin/images` page), and
 * keeps both files comfortably under the CQ-02 service-file cap.
 *
 * This file deliberately does NOT carry the `'use server'` directive —
 * the helpers throw freely and are called by other internal modules, not
 * directly by a Server Action. See §6.6.5 for the discipline.
 */

/** Operation tag for orphan-side logs and OrphanImageError instances. */
const ORPHAN_IMAGE_OPERATION = 'orphanPreviousImage';

/**
 * Named error thrown when {@link orphanPreviousImage} cannot detach an old
 * image row from its former parent (EH-05). Carries the row id and the
 * originating Supabase error via `cause` so callers can log structured
 * context (EH-02) before deciding whether to swallow (T26 pattern — parent
 * UPDATE has already succeeded) or re-throw.
 */
export class OrphanImageError extends Error {
  /** Id of the `images` row that could not be orphaned. */
  public readonly oldImageId: string;

  /**
   * @param oldImageId Id of the row this helper was attempting to detach.
   * @param cause      Originating Supabase error (or any thrown value).
   */
  constructor(oldImageId: string, cause: unknown) {
    super(`${ORPHAN_IMAGE_OPERATION} failed for image ${oldImageId}`, { cause });
    this.name = 'OrphanImageError';
    this.oldImageId = oldImageId;
  }
}

/**
 * Detach an `images` row from its former parent — NULLs both `parent_id`
 * and `parent_type` so the row is no longer associated with a project or
 * post.
 *
 * Behavior:
 *  - UPDATE errors (network, RLS denial, etc.) throw {@link OrphanImageError}
 *    with the row id and the underlying Supabase error via `cause`.
 *    Callers decide whether to swallow + log loud (parent UPDATE already
 *    succeeded — partial-failure mode is documented) or re-throw.
 *  - Zero rows affected logs a structured warning (the row may have been
 *    manually orphaned out-of-band) but does NOT throw — orphan semantics
 *    are idempotent at the operational layer.
 *
 * @param client     Supabase client. Required — no default factory here;
 *                   call sites already hold a client from the parent
 *                   action's perspective.
 * @param oldImageId UUID of the image row to orphan.
 * @throws OrphanImageError when the UPDATE itself rejects.
 */
export async function orphanPreviousImage(
  client: SupabaseClient,
  oldImageId: string,
): Promise<void> {
  const { data, error } = await client
    .from('images')
    .update({ parent_id: null, parent_type: null })
    .eq('id', oldImageId)
    .select('id');
  if (error) {
    logMutationError(ORPHAN_IMAGE_OPERATION, {
      oldImageId,
      errorCode: error.code ?? null,
      errorMessage: error.message ?? null,
    });
    throw new OrphanImageError(oldImageId, error);
  }
  if (!data || data.length === 0) {
    logMutationError(ORPHAN_IMAGE_OPERATION, {
      oldImageId,
      warning: 'no rows affected: already orphaned or row missing',
    });
  }
}

/**
 * Consolidated single-call helper for the parent-update orphan-on-swap
 * pattern: if `previousImageId` is non-null AND differs from
 * `nextImageId`, detach the previous image via
 * {@link orphanPreviousImage}, swallowing any {@link OrphanImageError} to
 * a loud structured log (EH-01 — explicit documented swallow, not silent).
 *
 * Rationale: the parent UPDATE (projects/posts) has already succeeded by
 * the time this is called; failing the action on an orphan-side error
 * would misrepresent the parent-row outcome to the caller. Operational
 * concern: a persistently-failing orphan path leaks `parent_id` /
 * `parent_type` pointers on the previous image — the structured log lets
 * a sweeper reconcile.
 *
 * @param client          Supabase client used by the parent update.
 * @param parentOperation Operation tag of the parent action (for log
 *                        correlation, e.g. `'updateProject'`).
 * @param parentId        Id of the parent row whose image is being swapped.
 * @param previousImageId Previous `image_id` value (may be `null`).
 * @param nextImageId     New `image_id` value (may be `null`).
 */
export async function orphanIfChanged(
  client: SupabaseClient,
  parentOperation: string,
  parentId: string,
  previousImageId: string | null,
  nextImageId: string | null,
): Promise<void> {
  if (previousImageId === null || previousImageId === nextImageId) return;
  try {
    await orphanPreviousImage(client, previousImageId);
  } catch (err) {
    logMutationError(parentOperation, {
      orphanOperation: ORPHAN_IMAGE_OPERATION,
      parentId,
      previousImageId,
      nextImageId,
      errorName: err instanceof Error ? err.name : 'Unknown',
      errorMessage: err instanceof Error ? err.message : String(err),
    });
  }
}

