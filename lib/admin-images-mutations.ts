'use server';

import { ZodError } from 'zod';
import { uploadImageInternal } from './admin-images-mutations-internal';
import type { ImageMutationState } from './admin-images-mutations-types';
import { GENERIC_FORM_ERROR, MIN_DURATION_MS } from './auth-constants';

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
 * IDs landed by this module: `uploadImage`. Image mutations are
 * upload-only at T25 — there is no edit (replace + orphan via T26
 * `image_id` swap), no separate delete (orphan-cleanup is the deferred
 * 7-day sweep per CONSTRAINT-07). Every export of this module must be an
 * async function — the state shape, initial state, and generic error
 * string all live in sibling modules for exactly that reason.
 *
 * This is the per-resource Server Action entry-point module per
 * `architecture.md` §6.6.6.
 */

/**
 * Pad the response time to the `MIN_DURATION_MS` floor (Channel 3 — timing).
 *
 * Same discipline as `lib/auth.ts::signInWithMagicLink`: every outcome flows
 * through the `finally` block, so the bound applies uniformly. Slow paths
 * run over the floor without truncation (a ceiling would itself be an
 * oracle). Floor is a project-wide constant in `lib/auth-constants.ts`.
 */
async function padToFloor(startedAt: number): Promise<void> {
  const elapsed = performance.now() - startedAt;
  const remaining = MIN_DURATION_MS - elapsed;
  if (remaining > 0) {
    await new Promise<void>((resolve) => setTimeout(resolve, remaining));
  }
}

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
 * Channel 3 (timing): every outcome pads to {@link MIN_DURATION_MS}.
 *
 * Channel 4 (Server Action surface): exactly one action ID is added by this
 * export. The throwing helper is imported from a sibling non-`'use server'`
 * module so it does not become a second endpoint.
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
