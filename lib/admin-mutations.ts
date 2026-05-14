'use server';

import { ZodError } from 'zod';
import {
  createPostInternal,
  createProjectInternal,
  deletePostInternal,
  deleteProjectInternal,
  deleteStatInternal,
  insertStatInternal,
  updatePostInternal,
  updateProjectInternal,
} from './admin-mutations-internal';
import {
  GENERIC_FORM_ERROR,
  type PostMutationState,
  type ProjectMutationState,
  type StatMutationState,
} from './admin-mutations-types';
import { MIN_DURATION_MS } from './auth-constants';

/**
 * Module note (F-14 analogue, applied to mutations).
 *
 * Every export from a `'use server'` module is promoted by Next.js to a
 * publicly-addressable Server Action with a stable hashed action ID that
 * ships in the client bundle. Channel 4 (Server Action surface) of the
 * six-channel uniformity contract requires this surface stay tightly
 * bounded — exactly the actions the UI calls, no co-located helpers. The
 * throwing helpers (zod parse, Supabase calls, slug checks) live in
 * `lib/admin-mutations-internal.ts`, which does NOT carry `'use server'`.
 *
 * SEC-09 allowlist (enforced by `tests/server-actions-manifest.test.ts`):
 * `signInWithMagicLink`, `signOut`, `createProject`, `updateProject`,
 * `deleteProject`, `createPost`, `updatePost`, `deletePost`, `insertStat`,
 * `deleteStat`. Every export of this module must be an async function —
 * the state shape, initial state, and generic error string all live in the
 * sibling internal module for exactly that reason.
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
 * Convert a `ZodError` into the per-field state shape. Only the fields we
 * own (`title`, `description`, `status`) are surfaced; any other key in the
 * error tree is ignored — Channel 1 (UI text) requires we leak no shape
 * information beyond the form's declared fields.
 */
function zodErrorToFieldErrors(err: ZodError): ProjectMutationState['fieldErrors'] {
  const fieldErrors: ProjectMutationState['fieldErrors'] = {};
  for (const issue of err.issues) {
    const key = issue.path[0];
    if (key === 'title' || key === 'description' || key === 'status') {
      // Keep the first message per field; later issues for the same field are
      // less informative for the user (zod emits them in order).
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}

/**
 * Read FormData into the raw create/update payload. The cast is intentional:
 * unknown raw values flow through to the zod parser at the boundary, which is
 * the authoritative validator.
 */
function readFormData(formData: FormData): unknown {
  return {
    title: formData.get('title'),
    description: formData.get('description'),
    status: formData.get('status'),
  };
}

/**
 * Server Action — create a new project from a `useActionState` form submit.
 *
 * Channel 1 (UI text): on success, surfaces nothing — the form redirects
 * client-side. On error, surfaces the generic `GENERIC_FORM_ERROR` for any
 * non-validation failure, and zod-derived field errors for validation
 * failures (the only carve-out, per the T21 spec — zod errors are reachable
 * by any caller and so not themselves an enumeration channel).
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
 * @param _prevState Previous `useActionState` state. Ignored — the action is
 *                   pure with respect to its inputs.
 * @param formData   Raw form data. Field reads are unvalidated; the zod
 *                   schema in `lib/admin-mutations-internal.ts` is the
 *                   single boundary.
 * @returns The new state envelope. Always resolves; never throws.
 */
export async function createProject(
  _prevState: ProjectMutationState,
  formData: FormData,
): Promise<ProjectMutationState> {
  const start = performance.now();
  try {
    await createProjectInternal(readFormData(formData));
    return { status: 'ok' };
  } catch (err) {
    if (err instanceof ZodError) {
      return { status: 'error', fieldErrors: zodErrorToFieldErrors(err) };
    }
    return { status: 'error', formError: GENERIC_FORM_ERROR };
  } finally {
    await padToFloor(start);
  }
}

/**
 * Server Action — update an existing project from a `useActionState` form
 * submit. The `id` is bound by the caller via `.bind(null, id)` (or by being
 * read from a hidden form field, as this implementation does).
 *
 * Same six-channel uniformity discipline as {@link createProject}. The
 * additional guard here is the slug-lock: the inner helper pre-fetches the
 * existing row's `status` and omits `slug` from the update payload when the
 * row is `published`. Even if that omit logic regresses, the migration 006
 * trigger raises and the wrapper swallows the throw to the same uniform
 * `{ status: 'error', formError }` shape.
 *
 * @param _prevState Previous `useActionState` state. Ignored.
 * @param formData   Raw form data. Must include a hidden `id` field with the
 *                   project's UUID.
 * @returns The new state envelope. Always resolves; never throws.
 */
export async function updateProject(
  _prevState: ProjectMutationState,
  formData: FormData,
): Promise<ProjectMutationState> {
  const start = performance.now();
  try {
    const rawId = formData.get('id');
    const id = typeof rawId === 'string' ? rawId : '';
    await updateProjectInternal(id, readFormData(formData));
    return { status: 'ok' };
  } catch (err) {
    if (err instanceof ZodError) {
      return { status: 'error', fieldErrors: zodErrorToFieldErrors(err) };
    }
    return { status: 'error', formError: GENERIC_FORM_ERROR };
  } finally {
    await padToFloor(start);
  }
}

/**
 * Server Action — hard-delete a project row by id.
 *
 * CONSTRAINT-10: hard-delete only. No soft-delete column, no tombstone, no
 * undo. The UI's `DeleteConfirmModal` (T22) is the only undo path; recovery
 * from accidental delete is via Supabase backups.
 *
 * Same six-channel uniformity discipline as {@link createProject} and
 * {@link updateProject}, but with a simpler input surface — no FormData,
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
 * @param id UUID of the project to delete. Validated downstream — anything
 *           non-string or empty resolves to the generic-error envelope after
 *           the timing floor.
 * @returns The new state envelope. Always resolves; never throws.
 */
export async function deleteProject(
  id: string,
): Promise<ProjectMutationState> {
  const start = performance.now();
  try {
    await deleteProjectInternal(id);
    return { status: 'ok' };
  } catch {
    return { status: 'error', formError: GENERIC_FORM_ERROR };
  } finally {
    await padToFloor(start);
  }
}

// =============================================================================
// Posts (T23) — same six-channel uniformity discipline as projects above.
// Each wrapper here is the ONLY exported surface for its action; the throwing
// internals live in `lib/admin-mutations-internal.ts`. The field schema is
// narrower (`title` | `content` | `status`) and the response envelope is the
// `PostMutationState` from `-types.ts`.
// =============================================================================

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
 *                   schema in `lib/admin-mutations-internal.ts` is the
 *                   single boundary.
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

// =============================================================================
// Stats (T24) — same six-channel uniformity discipline as projects and posts
// above. Each wrapper here is the ONLY exported surface for its action; the
// throwing internals live in `lib/admin-mutations-internal.ts`. The field
// schema is narrower (`category` | `label` | `value` | `unit`) and the
// response envelope is the `StatMutationState` from `-types.ts`.
//
// Stats has no edit and no slug — `insertStat` and `deleteStat` are the only
// mutation actions; corrections are delete-then-reinsert (CONSTRAINT-10).
// =============================================================================

/**
 * Convert a `ZodError` into the per-field state shape for the stat form.
 * Only the fields the stat form owns (`category`, `label`, `value`, `unit`)
 * are surfaced; any other key in the error tree is ignored. Same Channel 1
 * (UI text) discipline as the project / post equivalents — no leak beyond
 * the form's declared fields.
 */
function statZodErrorToFieldErrors(
  err: ZodError,
): StatMutationState['fieldErrors'] {
  const fieldErrors: StatMutationState['fieldErrors'] = {};
  for (const issue of err.issues) {
    const key = issue.path[0];
    if (
      key === 'category' ||
      key === 'label' ||
      key === 'value' ||
      key === 'unit'
    ) {
      // Keep the first message per field; later issues for the same field are
      // less informative for the user (zod emits them in order).
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}

/**
 * Read FormData into the raw stat insert payload. The cast is intentional:
 * unknown raw values flow through to the zod parser at the boundary, which
 * is the authoritative validator. Empty-string `unit` submissions are
 * preprocessed to `undefined` inside the zod schema; the wrapper does not
 * normalise here.
 */
function readStatFormData(formData: FormData): unknown {
  return {
    category: formData.get('category'),
    label: formData.get('label'),
    value: formData.get('value'),
    unit: formData.get('unit'),
  };
}

/**
 * Server Action — insert a new stat row from a `useActionState` form submit.
 *
 * Channel 1 (UI text): on success, surfaces nothing — the form resets and
 * the list refetches client-side. On error, surfaces the shared
 * `GENERIC_FORM_ERROR` for any non-validation failure (resource-agnostic
 * across the admin surface) and zod-derived field errors for validation
 * failures.
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
 * @param _prevState Previous `useActionState` state. Ignored — the action is
 *                   pure with respect to its inputs.
 * @param formData   Raw form data. Field reads are unvalidated; the zod
 *                   schema in `lib/admin-mutations-internal.ts` is the
 *                   single boundary.
 * @returns The new state envelope. Always resolves; never throws.
 */
export async function insertStat(
  _prevState: StatMutationState,
  formData: FormData,
): Promise<StatMutationState> {
  const start = performance.now();
  try {
    await insertStatInternal(readStatFormData(formData));
    return { status: 'ok' };
  } catch (err) {
    if (err instanceof ZodError) {
      return { status: 'error', fieldErrors: statZodErrorToFieldErrors(err) };
    }
    return { status: 'error', formError: GENERIC_FORM_ERROR };
  } finally {
    await padToFloor(start);
  }
}

/**
 * Server Action — hard-delete a stat row by id.
 *
 * CONSTRAINT-10: hard-delete only. No soft-delete column, no tombstone, no
 * undo. The UI's confirm modal (mirroring the T22 / T23 pattern) is the only
 * undo path; recovery from accidental delete is via Supabase backups.
 *
 * Same six-channel uniformity discipline as {@link insertStat}, but with a
 * simpler input surface — no FormData, no zod schema, no `fieldErrors`. The
 * action takes a single `id` argument and resolves with `{ status: 'ok' }`
 * on success or `{ status: 'error', formError: GENERIC_FORM_ERROR }` on any
 * internal throw (including the SEC-02 id-validation guard in the internal
 * helper).
 *
 * Channel 1 (UI text): on error, surfaces only the generic form error.
 * Channel 2 (response body): uniform `{ status, formError? }` envelope —
 * never throws to the wire.
 * Channel 3 (timing): every outcome pads to {@link MIN_DURATION_MS}.
 * Channel 4 (Server Action surface): exactly one action ID is added by this
 * export. The throwing helper is imported from a sibling non-`'use server'`
 * module so it does not become a second endpoint.
 *
 * @param id UUID of the stat to delete. Validated downstream — anything
 *           non-string or empty resolves to the generic-error envelope after
 *           the timing floor.
 * @returns The new state envelope. Always resolves; never throws.
 */
export async function deleteStat(
  id: string,
): Promise<StatMutationState> {
  const start = performance.now();
  try {
    await deleteStatInternal(id);
    return { status: 'ok' };
  } catch {
    return { status: 'error', formError: GENERIC_FORM_ERROR };
  } finally {
    await padToFloor(start);
  }
}
