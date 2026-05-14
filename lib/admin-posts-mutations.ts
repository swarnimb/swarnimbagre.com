'use server';

import { ZodError } from 'zod';
import {
  createPostInternal,
  deletePostInternal,
  updatePostInternal,
} from './admin-posts-mutations-internal';
import type { PostMutationState } from './admin-posts-mutations-types';
import { GENERIC_FORM_ERROR, MIN_DURATION_MS } from './auth-constants';

/**
 * Module note (F-14 analogue, applied to POST mutations).
 *
 * Every export from a `'use server'` module is promoted by Next.js to a
 * publicly-addressable Server Action with a stable hashed action ID that
 * ships in the client bundle. Channel 4 (Server Action surface) of the
 * six-channel uniformity contract requires this surface stay tightly
 * bounded — exactly the actions the UI calls, no co-located helpers. The
 * throwing helpers (zod parse, Supabase calls, slug checks) live in
 * `lib/admin-posts-mutations-internal.ts`, which does NOT carry
 * `'use server'`.
 *
 * SEC-09 allowlist (enforced by `tests/server-actions-manifest.test.ts`)
 * IDs landed by this module: `createPost`, `updatePost`, `deletePost`.
 * Every export of this module must be an async function — the state shape,
 * initial state, and generic error string all live in sibling modules for
 * exactly that reason.
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
 * Convert a `ZodError` into the per-field state shape for the post form.
 * Only the fields the post form owns (`title`, `content`, `status`) are
 * surfaced; any other key in the error tree is ignored. Same Channel 1
 * (UI text) discipline as the project equivalent — no leak beyond the
 * form's declared fields.
 */
function postZodErrorToFieldErrors(
  err: ZodError,
): PostMutationState['fieldErrors'] {
  const fieldErrors: PostMutationState['fieldErrors'] = {};
  for (const issue of err.issues) {
    const key = issue.path[0];
    if (key === 'title' || key === 'content' || key === 'status') {
      // Keep the first message per field; later issues for the same field are
      // less informative for the user (zod emits them in order).
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}

/**
 * Read FormData into the raw post create/update payload. The cast is
 * intentional: unknown raw values flow through to the zod parser at the
 * boundary, which is the authoritative validator. CONSTRAINT-06: `content`
 * is read verbatim — no transformation, no HTML conversion.
 */
function readPostFormData(formData: FormData): unknown {
  return {
    title: formData.get('title'),
    content: formData.get('content'),
    status: formData.get('status'),
  };
}

/**
 * Server Action — create a new post from a `useActionState` form submit.
 *
 * Channel 1 (UI text): on success, surfaces nothing — the form redirects
 * client-side. On error, surfaces the shared `GENERIC_FORM_ERROR` for any
 * non-validation failure (intentionally resource-agnostic so post/project
 * failure copy cannot be told apart), and zod-derived field errors for
 * validation failures.
 *
 * Channel 2 (response body): the returned envelope is the same shape across
 * outcomes — `{ status, fieldErrors?, formError? }`. Never throws to the
 * wire (the inner helper's throws are caught here).
 *
 * Channel 3 (timing): every outcome pads to {@link MIN_DURATION_MS}.
 *
 * Channel 4 (Server Action surface): exactly one action ID is added by this
 * export. The throwing helper is imported from a sibling non-`'use server'`
 * module so it does not become a second endpoint.
 *
 * CONSTRAINT-06: the `content` form field is stored verbatim as raw Markdown.
 * No HTML conversion, no rendering at write time. The T12 client renderer
 * handles read-time rendering and sanitization.
 *
 * @param _prevState Previous `useActionState` state. Ignored — the action is
 *                   pure with respect to its inputs.
 * @param formData   Raw form data. Field reads are unvalidated; the zod
 *                   schema in `lib/admin-posts-mutations-internal.ts` is
 *                   the single boundary.
 * @returns The new state envelope. Always resolves; never throws.
 */
export async function createPost(
  _prevState: PostMutationState,
  formData: FormData,
): Promise<PostMutationState> {
  const start = performance.now();
  try {
    await createPostInternal(readPostFormData(formData));
    return { status: 'ok' };
  } catch (err) {
    if (err instanceof ZodError) {
      return { status: 'error', fieldErrors: postZodErrorToFieldErrors(err) };
    }
    return { status: 'error', formError: GENERIC_FORM_ERROR };
  } finally {
    await padToFloor(start);
  }
}

/**
 * Server Action — update an existing post from a `useActionState` form
 * submit. The `id` is read from a hidden form field (mirroring the project
 * pattern).
 *
 * Same six-channel uniformity discipline as {@link createPost}. The
 * additional guard is the slug-lock: `updatePostInternal` pre-fetches the
 * existing row's `status` and omits `slug` from the update payload when the
 * row is `published`. Even if that omit logic regresses, the migration 006
 * trigger `posts_prevent_slug_change` raises and the wrapper swallows the
 * throw to the same uniform `{ status: 'error', formError }` shape.
 *
 * @param _prevState Previous `useActionState` state. Ignored.
 * @param formData   Raw form data. Must include a hidden `id` field with the
 *                   post's UUID.
 * @returns The new state envelope. Always resolves; never throws.
 */
export async function updatePost(
  _prevState: PostMutationState,
  formData: FormData,
): Promise<PostMutationState> {
  const start = performance.now();
  try {
    const rawId = formData.get('id');
    const id = typeof rawId === 'string' ? rawId : '';
    await updatePostInternal(id, readPostFormData(formData));
    return { status: 'ok' };
  } catch (err) {
    if (err instanceof ZodError) {
      return { status: 'error', fieldErrors: postZodErrorToFieldErrors(err) };
    }
    return { status: 'error', formError: GENERIC_FORM_ERROR };
  } finally {
    await padToFloor(start);
  }
}

/**
 * Server Action — hard-delete a post row by id.
 *
 * CONSTRAINT-10: hard-delete only. No soft-delete column, no tombstone, no
 * undo. The UI's confirm modal (mirroring T22's `DeleteConfirmModal`) is
 * the only undo path; recovery from accidental delete is via Supabase
 * backups.
 *
 * Same six-channel uniformity discipline as {@link createPost} and
 * {@link updatePost}, but with a simpler input surface — no FormData,
 * no zod schema, no `fieldErrors`. The action takes a single `id` argument
 * and resolves with `{ status: 'ok' }` on success or
 * `{ status: 'error', formError: GENERIC_FORM_ERROR }` on any internal
 * throw (including the SEC-02 id-validation guard in the internal helper).
 *
 * Channel 1 (UI text): on error, surfaces only the generic form error.
 * Channel 2 (response body): uniform `{ status, formError? }` envelope —
 * never throws to the wire.
 * Channel 3 (timing): every outcome pads to {@link MIN_DURATION_MS}.
 * Channel 4 (Server Action surface): exactly one action ID is added by this
 * export. The throwing helper is imported from a sibling non-`'use server'`
 * module so it does not become a second endpoint.
 *
 * @param id UUID of the post to delete. Validated downstream — anything
 *           non-string or empty resolves to the generic-error envelope after
 *           the timing floor.
 * @returns The new state envelope. Always resolves; never throws.
 */
export async function deletePost(
  id: string,
): Promise<PostMutationState> {
  const start = performance.now();
  try {
    await deletePostInternal(id);
    return { status: 'ok' };
  } catch {
    return { status: 'error', formError: GENERIC_FORM_ERROR };
  } finally {
    await padToFloor(start);
  }
}
