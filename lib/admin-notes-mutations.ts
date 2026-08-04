'use server';

import { ZodError } from 'zod';
import {
  createNoteInternal,
  deleteNoteInternal,
  updateNoteInternal,
} from './admin-notes-mutations-internal';
import type { NoteMutationState } from './admin-notes-mutations-types';
import { GENERIC_FORM_ERROR } from './auth-constants';
import { padToFloor } from './timing';

/**
 * Module note (F-14 analogue, applied to NOTE mutations).
 *
 * Every export from a `'use server'` module is promoted by Next.js to a
 * publicly-addressable Server Action with a stable hashed action ID that
 * ships in the client bundle. Channel 4 (Server Action surface) of the
 * six-channel uniformity contract requires this surface stay tightly
 * bounded: exactly the actions the UI calls, no co-located helpers. The
 * throwing helpers (zod parse, Supabase calls) live in
 * `lib/admin-notes-mutations-internal.ts`, which does NOT carry
 * `'use server'`.
 *
 * SEC-09 allowlist (enforced by `tests/server-actions-manifest.test.ts`)
 * IDs landed by this module: `createNote`, `updateNote`, `deleteNote`.
 * Every export of this module must be an async function: the state shape,
 * initial state, and generic error string all live in sibling modules for
 * exactly that reason.
 *
 * This is the per-resource Server Action entry-point module per
 * `architecture.md` §6.6.6.
 */

/**
 * Convert a `ZodError` into the per-field state shape for the note forms.
 * Only the fields the forms own (`kicker`, `line`, `sort_order`) are
 * surfaced; any other key in the error tree is ignored. Same Channel 1 (UI
 * text) discipline as the stat / post equivalents: no leak beyond the
 * form's declared fields.
 */
function noteZodErrorToFieldErrors(
  err: ZodError,
): NoteMutationState['fieldErrors'] {
  const fieldErrors: NoteMutationState['fieldErrors'] = {};
  for (const issue of err.issues) {
    const key = issue.path[0];
    if (key === 'kicker' || key === 'line' || key === 'sort_order') {
      // Keep the first message per field; later issues for the same field are
      // less informative for the user (zod emits them in order).
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}

/**
 * Read `sort_order` from FormData. Missing or empty resolves to `0`, matching
 * both the column default and the schema default. A parseable numeric string
 * resolves to a `number`. Anything else passes through as the raw trimmed
 * string so the zod number schema rejects it with a deterministic message
 * rather than the field being silently zeroed.
 */
function readSortOrderField(formData: FormData): unknown {
  const raw = formData.get('sort_order');
  if (typeof raw !== 'string') return 0;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return 0;
  const parsed = Number(trimmed);
  return Number.isNaN(parsed) ? trimmed : parsed;
}

/**
 * Read FormData into the raw note payload. Shared by create and update: notes
 * has no lifecycle field and no image FK, so the two payloads are identical.
 * The text reads are unvalidated and flow through to the zod parser at the
 * boundary, which is the authoritative validator.
 */
function readNoteFormData(formData: FormData): unknown {
  return {
    kicker: formData.get('kicker'),
    line: formData.get('line'),
    sort_order: readSortOrderField(formData),
  };
}

/**
 * Server Action: create a new note row from a `useActionState` form submit.
 *
 * Channel 1 (UI text): on success, surfaces nothing: the form resets and
 * the list refetches client-side. On error, surfaces the shared
 * `GENERIC_FORM_ERROR` for any non-validation failure (resource-agnostic
 * across the admin surface) and zod-derived field errors for validation
 * failures.
 *
 * Channel 2 (response body): the returned envelope is the same shape across
 * outcomes: `{ status, fieldErrors?, formError? }`. Never throws to the
 * wire (the inner helper's throws are caught here).
 *
 * Channel 3 (timing): every outcome pads to the response-timing floor via
 * {@link padToFloor} (the `MIN_DURATION_MS` bound, `lib/auth-constants.ts`).
 *
 * Channel 4 (Server Action surface): exactly one action ID is added by this
 * export. The throwing helper is imported from a sibling non-`'use server'`
 * module so it does not become a second endpoint.
 *
 * @param _prevState Previous `useActionState` state. Ignored: the action is
 *                   pure with respect to its inputs.
 * @param formData   Raw form data. Field reads are unvalidated; the zod
 *                   schema in `lib/admin-notes-mutations-schemas.ts` is the
 *                   single boundary.
 * @returns The new state envelope. Always resolves; never throws.
 */
export async function createNote(
  _prevState: NoteMutationState,
  formData: FormData,
): Promise<NoteMutationState> {
  const start = performance.now();
  try {
    await createNoteInternal(readNoteFormData(formData));
    return { status: 'ok' };
  } catch (err) {
    if (err instanceof ZodError) {
      return { status: 'error', fieldErrors: noteZodErrorToFieldErrors(err) };
    }
    return { status: 'error', formError: GENERIC_FORM_ERROR };
  } finally {
    await padToFloor(start);
  }
}

/**
 * Server Action: update an existing note from a `useActionState` form
 * submit. The `id` is read from a hidden form field, mirroring the post and
 * project update actions.
 *
 * Same six-channel uniformity discipline as {@link createNote}. There is no
 * slug-lock analogue to guard: notes has no slug and no published state, so
 * an update is an unconditional whole-row write.
 *
 * @param _prevState Previous `useActionState` state. Ignored.
 * @param formData   Raw form data. Must include a hidden `id` field with the
 *                   note's UUID.
 * @returns The new state envelope. Always resolves; never throws.
 */
export async function updateNote(
  _prevState: NoteMutationState,
  formData: FormData,
): Promise<NoteMutationState> {
  const start = performance.now();
  try {
    const rawId = formData.get('id');
    const id = typeof rawId === 'string' ? rawId : '';
    await updateNoteInternal(id, readNoteFormData(formData));
    return { status: 'ok' };
  } catch (err) {
    if (err instanceof ZodError) {
      return { status: 'error', fieldErrors: noteZodErrorToFieldErrors(err) };
    }
    return { status: 'error', formError: GENERIC_FORM_ERROR };
  } finally {
    await padToFloor(start);
  }
}

/**
 * Server Action: hard-delete a note row by id.
 *
 * CONSTRAINT-10: hard-delete only. No soft-delete column, no tombstone, no
 * undo. The UI's confirm modal is the only undo path; recovery from
 * accidental delete is via Supabase backups.
 *
 * Same six-channel uniformity discipline as {@link createNote}, but with a
 * simpler input surface: no FormData, no zod schema, no `fieldErrors`. The
 * action takes a single `id` argument and resolves with `{ status: 'ok' }`
 * on success or `{ status: 'error', formError: GENERIC_FORM_ERROR }` on any
 * internal throw (including the SEC-02 id-validation guard in the internal
 * helper).
 *
 * @param id UUID of the note to delete. Validated downstream: anything
 *           non-string or empty resolves to the generic-error envelope after
 *           the timing floor.
 * @returns The new state envelope. Always resolves; never throws.
 */
export async function deleteNote(id: string): Promise<NoteMutationState> {
  const start = performance.now();
  try {
    await deleteNoteInternal(id);
    return { status: 'ok' };
  } catch {
    return { status: 'error', formError: GENERIC_FORM_ERROR };
  } finally {
    await padToFloor(start);
  }
}
