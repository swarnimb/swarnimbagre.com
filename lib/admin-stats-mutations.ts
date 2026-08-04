'use server';

import { ZodError } from 'zod';
import {
  deleteStatInternal,
  insertStatInternal,
  updateStatInternal,
} from './admin-stats-mutations-internal';
import type { StatMutationState } from './admin-stats-mutations-types';
import { GENERIC_FORM_ERROR } from './auth-constants';
import { padToFloor } from './timing';

/**
 * Module note (F-14 analogue, applied to STAT mutations).
 *
 * Every export from a `'use server'` module is promoted by Next.js to a
 * publicly-addressable Server Action with a stable hashed action ID that
 * ships in the client bundle. Channel 4 (Server Action surface) of the
 * six-channel uniformity contract requires this surface stay tightly
 * bounded — exactly the actions the UI calls, no co-located helpers. The
 * throwing helpers (zod parse, Supabase calls) live in
 * `lib/admin-stats-mutations-internal.ts`, which does NOT carry
 * `'use server'`.
 *
 * SEC-09 allowlist (enforced by `tests/server-actions-manifest.test.ts`)
 * IDs landed by this module: `insertStat`, `deleteStat`. Stats has no edit
 * and no slug — `insertStat` and `deleteStat` are the only mutation actions;
 * corrections are delete-then-reinsert (CONSTRAINT-10). Every export of
 * this module must be an async function — the state shape, initial state,
 * and generic error string all live in sibling modules for exactly that
 * reason.
 *
 * This is the per-resource Server Action entry-point module per
 * `architecture.md` §6.6.6.
 */

/**
 * Convert a `ZodError` into the per-field state shape for the stat form.
 * Only the fields the stat form owns (`category`, `label`, `value`, `unit`,
 * `aside`, `sort_order`) are surfaced; any other key in the error tree is
 * ignored. Same Channel 1 (UI text) discipline as the project / post
 * equivalents — no leak beyond the form's declared fields.
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
      key === 'unit' ||
      key === 'aside' ||
      key === 'sort_order'
    ) {
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
 * rather than the field being silently zeroed. Mirrors `readPercentField` in
 * `lib/admin-projects-mutations.ts`.
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
 * Read FormData into the raw stat insert payload. The cast is intentional:
 * unknown raw values flow through to the zod parser at the boundary, which
 * is the authoritative validator. Empty-string `unit` and `aside`
 * submissions are preprocessed to `undefined` inside the zod schema; the
 * wrapper does not normalise those here. `sort_order` is the exception: it
 * arrives as a string from FormData and the schema is a strict number
 * parser, so the string-to-number step happens here.
 */
function readStatFormData(formData: FormData): unknown {
  return {
    category: formData.get('category'),
    label: formData.get('label'),
    value: formData.get('value'),
    unit: formData.get('unit'),
    aside: formData.get('aside'),
    sort_order: readSortOrderField(formData),
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
 * Channel 3 (timing): every outcome pads to the response-timing floor via
 * {@link padToFloor} (the `MIN_DURATION_MS` bound, `lib/auth-constants.ts`).
 *
 * Channel 4 (Server Action surface): exactly one action ID is added by this
 * export. The throwing helper is imported from a sibling non-`'use server'`
 * module so it does not become a second endpoint.
 *
 * @param _prevState Previous `useActionState` state. Ignored — the action is
 *                   pure with respect to its inputs.
 * @param formData   Raw form data. Field reads are unvalidated; the zod
 *                   schema in `lib/admin-stats-mutations-internal.ts` is
 *                   the single boundary.
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
 * Server Action: update an existing stat row.
 *
 * Added at T46 so the seven hand-maintained Other-page tiles can be corrected
 * in place. Previously a typo in a stat meant deleting the row and retyping
 * every field, which was an acceptable trade for append-only telemetry and a
 * bad one for long-lived hand-written content.
 *
 * Same six-channel uniformity discipline as {@link insertStat}. The row id
 * travels in the FormData as a hidden `id` field rather than as a bound
 * argument, so the action keeps the two-parameter `useActionState` signature
 * the rest of the admin forms use.
 *
 * @param _prevState Previous `useActionState` state. Ignored.
 * @param formData   Raw form data, including the hidden `id` field.
 * @returns The new state envelope. Always resolves; never throws.
 */
export async function updateStat(
  _prevState: StatMutationState,
  formData: FormData,
): Promise<StatMutationState> {
  const start = performance.now();
  try {
    const rawId = formData.get('id');
    const id = typeof rawId === 'string' ? rawId : '';
    await updateStatInternal(id, readStatFormData(formData));
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
 * Channel 3 (timing): every outcome pads to the response-timing floor via
 * {@link padToFloor} (the `MIN_DURATION_MS` bound, `lib/auth-constants.ts`).
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
