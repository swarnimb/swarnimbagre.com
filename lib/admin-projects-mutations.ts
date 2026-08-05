'use server';

import { ZodError } from 'zod';
import {
  createProjectInternal,
  deleteProjectInternal,
  updateProjectInternal,
} from './admin-projects-mutations-internal';
import {
  projectZodErrorToFieldErrors,
  readProjectCreateFormData,
  readProjectUpdateFormData,
} from './admin-projects-mutations-formdata';
import type { ProjectMutationState } from './admin-projects-mutations-types';
import { GENERIC_FORM_ERROR } from './auth-constants';
import { assertAdminSession } from './session';
import { padToFloor } from './timing';

/**
 * Module note (F-14 analogue, applied to PROJECT mutations).
 *
 * Every export from a `'use server'` module is promoted by Next.js to a
 * publicly-addressable Server Action with a stable hashed action ID that
 * ships in the client bundle. Channel 4 (Server Action surface) of the
 * six-channel uniformity contract requires this surface stay tightly
 * bounded — exactly the actions the UI calls, no co-located helpers. The
 * throwing helpers (zod parse, Supabase calls, slug checks) live in
 * `lib/admin-projects-mutations-internal.ts`, which does NOT carry
 * `'use server'`. The FormData readers and the zod-error field mapper live in
 * `lib/admin-projects-mutations-formdata.ts` for the same reason — they were
 * split out at audit 24 when this module crossed the CQ-02 300-line cap, and
 * a directive-free module keeps them off the public action surface exactly as
 * module-privacy did before.
 *
 * SEC-09 allowlist (enforced by `tests/server-actions-manifest.test.ts`)
 * IDs landed by this module: `createProject`, `updateProject`,
 * `deleteProject`. Every export of this module must be an async function —
 * the state shape, initial state, and generic error string all live in
 * sibling modules for exactly that reason.
 *
 * This is the per-resource Server Action entry-point module per
 * `architecture.md` §6.6.6.
 */

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
 *                   schema in `lib/admin-projects-mutations-internal.ts` is
 *                   the single boundary.
 * @returns The new state envelope. Always resolves; never throws.
 */
export async function createProject(
  _prevState: ProjectMutationState,
  formData: FormData,
): Promise<ProjectMutationState> {
  const start = performance.now();
  try {
    await assertAdminSession();
    await createProjectInternal(readProjectCreateFormData(formData));
    return { status: 'ok' };
  } catch (err) {
    if (err instanceof ZodError) {
      return { status: 'error', fieldErrors: projectZodErrorToFieldErrors(err) };
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
 * F-39: {@link assertAdminSession} runs first, inside the `try`.
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
    await assertAdminSession();
    const rawId = formData.get('id');
    const id = typeof rawId === 'string' ? rawId : '';
    await updateProjectInternal(id, readProjectUpdateFormData(formData));
    return { status: 'ok' };
  } catch (err) {
    if (err instanceof ZodError) {
      return { status: 'error', fieldErrors: projectZodErrorToFieldErrors(err) };
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
 * Channel 3 (timing): every outcome pads to the response-timing floor via
 * {@link padToFloor} (the `MIN_DURATION_MS` bound, `lib/auth-constants.ts`).
 * Channel 4 (Server Action surface): exactly one action ID is added by this
 * export. The throwing helper is imported from a sibling non-`'use server'`
 * module so it does not become a second endpoint.
 *
 * F-39: {@link assertAdminSession} runs first, inside the `try`.
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
    await assertAdminSession();
    await deleteProjectInternal(id);
    return { status: 'ok' };
  } catch {
    return { status: 'error', formError: GENERIC_FORM_ERROR };
  } finally {
    await padToFloor(start);
  }
}
