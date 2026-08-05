'use server';

import { ZodError } from 'zod';
import { uploadImageInternal } from './admin-images-mutations-internal';
import { deleteOrphanImagesInternal } from './admin-images-cleanup';
import type {
  ImageMutationState,
  OrphanCleanupState,
} from './admin-images-mutations-types';
import { GENERIC_FORM_ERROR } from './auth-constants';
import { assertAdminSession } from './session';
import { padToFloor } from './timing';

/**
 * Module note (F-14 analogue, applied to IMAGE mutations).
 *
 * Every export from a `'use server'` module is promoted by Next.js to a
 * publicly-addressable Server Action with a stable hashed action ID that
 * ships in the client bundle. Channel 4 (Server Action surface) of the
 * six-channel uniformity contract requires this surface stay tightly
 * bounded — exactly the actions the UI calls, no co-located helpers. The
 * throwing helpers (zod parse, file validation, Supabase Storage + insert,
 * compensating delete) live in
 * `lib/admin-images-mutations-internal.ts`, which does NOT carry
 * `'use server'`.
 *
 * SEC-09 allowlist (enforced by `tests/server-actions-manifest.test.ts`)
 * IDs landed by this module: `uploadImage`, `deleteOrphanImages`. Image
 * mutations cover upload (T25) and the deferred 7-day orphan-cleanup
 * sweep (T27); there is no per-image edit or per-image delete — replacement
 * is via the parent's `image_id` swap (T26), and orphan rows are reclaimed
 * in batch by the cleanup action. Every export of this module must be an
 * async function — the state shapes, initial states, and generic error
 * string all live in sibling modules for exactly that reason.
 *
 * This is the per-resource Server Action entry-point module per
 * `architecture.md` §6.6.6.
 */

/**
 * Convert a `ZodError` into the per-field state shape for the upload form.
 * Only the fields the form owns (`file`, `altText`, `parentType`,
 * `parentId`) are surfaced; any other key in the error tree is ignored —
 * Channel 1 (UI text) discipline, same as the project / post / stat
 * equivalents.
 */
function imageZodErrorToFieldErrors(
  err: ZodError,
): ImageMutationState['fieldErrors'] {
  const fieldErrors: ImageMutationState['fieldErrors'] = {};
  for (const issue of err.issues) {
    const key = issue.path[0];
    if (
      key === 'file' ||
      key === 'altText' ||
      key === 'parentType' ||
      key === 'parentId'
    ) {
      // Keep the first message per field; later issues for the same field are
      // less informative for the user (zod emits them in order).
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}

/**
 * Server Action — upload an image and insert its `images` row from a
 * `useActionState` form submit.
 *
 * Channel 1 (UI text): on success, the envelope carries the inserted
 * `ImageRecord` (the only resource envelope that carries a payload — see
 * `admin-images-mutations-types.ts` JSDoc). The form's `onUpload(image)`
 * callback fires from that. On error, surfaces the shared
 * `GENERIC_FORM_ERROR` for any non-validation failure (resource-agnostic
 * across the admin surface) and zod-derived field errors for validation
 * failures.
 *
 * Channel 2 (response body): the returned envelope is the same shape across
 * outcomes — `{ status, fieldErrors?, formError?, image? }`. Never throws to
 * the wire (the inner helper's throws are caught here).
 *
 * Channel 3 (timing): every outcome pads to the response-timing floor via
 * {@link padToFloor} (the `MIN_DURATION_MS` bound, `lib/auth-constants.ts`).
 *
 * Channel 4 (Server Action surface): exactly one action ID is added by this
 * export. The throwing helper is imported from a sibling non-`'use server'`
 * module so it does not become a second endpoint.
 *
 * F-39: {@link assertAdminSession} runs first, inside the `try`.
 *
 * @param _prevState Previous `useActionState` state. Ignored — the action is
 *                   pure with respect to its inputs.
 * @param formData   Raw form data. Field reads are unvalidated; the zod
 *                   schema and the file validator in
 *                   `lib/admin-images-mutations-internal.ts` are the single
 *                   boundary.
 * @returns The new state envelope. Always resolves; never throws.
 */
export async function uploadImage(
  _prevState: ImageMutationState,
  formData: FormData,
): Promise<ImageMutationState> {
  const start = performance.now();
  try {
    await assertAdminSession();
    const file = formData.get('file');
    const parentType = formData.get('parentType');
    const parentId = formData.get('parentId');
    const altText = formData.get('altText');
    const image = await uploadImageInternal({
      file,
      parentType,
      parentId,
      altText,
    });
    return { status: 'ok', image };
  } catch (err) {
    if (err instanceof ZodError) {
      return { status: 'error', fieldErrors: imageZodErrorToFieldErrors(err) };
    }
    return { status: 'error', formError: GENERIC_FORM_ERROR };
  } finally {
    await padToFloor(start);
  }
}

/**
 * Server Action — hard-delete every orphaned `images` row older than the
 * `ORPHAN_CLEANUP_THRESHOLD_DAYS` grace period AND its Storage object.
 *
 * Takes no inputs — the cutoff is the wall-clock `now()` minus the grace
 * period; orphan-ness is the per-row predicate `parent_id IS NULL AND
 * parent_type IS NULL`. The throwing helper in `lib/admin-images-orphan.ts`
 * is the single boundary; all SEC-03 parameterization happens there.
 *
 * Channel 1 (UI text): on success, surfaces `deleted` + `freedBytes` so
 * the page can render "Deleted N images, freed ~M MB". On error, surfaces
 * the shared `GENERIC_FORM_ERROR` for any throw — same resource-agnostic
 * copy as the project / post / stat / image mutations.
 *
 * Channel 2 (response body): the returned envelope is the same shape
 * across outcomes — `{ status, formError?, deleted?, freedBytes? }`. Never
 * throws to the wire (the inner helper's throws are caught here).
 *
 * Channel 3 (timing): every outcome pads to the response-timing floor via
 * {@link padToFloor} (the `MIN_DURATION_MS` bound, `lib/auth-constants.ts`).
 *
 * Channel 4 (Server Action surface): exactly one action ID is added by
 * this export. The throwing helper is imported from a sibling
 * non-`'use server'` module so it does not become a second endpoint.
 *
 * F-39: {@link assertAdminSession} runs first, inside the `try`.
 *
 * @returns The new state envelope. Always resolves; never throws.
 */
export async function deleteOrphanImages(): Promise<OrphanCleanupState> {
  const start = performance.now();
  try {
    await assertAdminSession();
    const result = await deleteOrphanImagesInternal();
    return {
      status: 'ok',
      deleted: result.deleted,
      freedBytes: result.freedBytes,
    };
  } catch {
    return { status: 'error', formError: GENERIC_FORM_ERROR };
  } finally {
    await padToFloor(start);
  }
}
