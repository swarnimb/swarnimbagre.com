'use server';

import { ZodError } from 'zod';
import { saveOrderInternal } from './admin-reorder-mutations-internal';
import type { ReorderMutationState } from './admin-reorder-mutations-types';
import { GENERIC_FORM_ERROR } from './auth-constants';
import { assertAdminSession } from './session';
import { padToFloor } from './timing';

/**
 * Module note (F-14 analogue, applied to REORDER mutations).
 *
 * Every export from a `'use server'` module is promoted by Next.js to a
 * publicly-addressable Server Action with a stable hashed action ID that
 * ships in the client bundle. Channel 4 (Server Action surface) of the
 * six-channel uniformity contract requires this surface stay tightly
 * bounded — exactly the actions the UI calls, no co-located helpers. The
 * throwing helper (zod parse + Supabase RPC dispatch) lives in
 * `lib/admin-reorder-mutations-internal.ts`, which does NOT carry
 * `'use server'`.
 *
 * SEC-09 allowlist (enforced by `tests/server-actions-manifest.test.ts`)
 * IDs landed by this module: `saveProjectOrder`, `savePostOrder`. The actions
 * only enter the `.next/server/server-reference-manifest.json` once they are
 * reachable from an `app/**` route — the admin reorder UI wires them.
 *
 * Per `architecture.md` §6.6.6.
 */

/**
 * Stringify a ZodError into the documented fieldErrors key convention for the
 * reorder boundary: the array-level key stays `'rows'`; per-row paths join
 * with `.` (`'rows.3.id'`). Keeps the first message per key — later issues
 * for the same key are less informative for the user (zod emits in order).
 *
 * Unlike the project_media wrapper, the reorder boundary has no
 * user-addressable field surface (the array is built from drag state, not a
 * text input), so there is no allowlist to drop unknown roots against; every
 * issue maps to a `rows`-rooted path by construction of the schema.
 */
function reorderZodErrorToFieldErrors(
  err: ZodError,
): ReorderMutationState['fieldErrors'] {
  const fieldErrors: Record<string, string> = {};
  for (const issue of err.issues) {
    if (issue.path.length === 0) continue;
    const key = issue.path.map((segment) => String(segment)).join('.');
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

/**
 * Read the FormData payload into the raw reorder shape. The client serializes
 * the ordered row array via `JSON.stringify` into a single hidden `rows`
 * field. The result is returned untyped — the zod schema is the
 * authoritative validator at the boundary (SEC-02).
 *
 * Malformed JSON leaves `rows` undefined; the schema then rejects with a
 * uniform validation error. The silent catch is acceptable because the only
 * legitimate caller (the reorder UI) builds the JSON from React state, so a
 * parse failure indicates a hand-crafted request — the uniform error
 * envelope is the right response and matches the Channel 2 contract.
 */
function readReorderFormData(formData: FormData): unknown {
  const rowsRaw = formData.get('rows');
  let rows: unknown = undefined;
  if (typeof rowsRaw === 'string') {
    try {
      rows = JSON.parse(rowsRaw);
    } catch {
      // Caller-side serialization is React-state → JSON.stringify; a parse
      // failure here means a hand-crafted request. Leave `rows` undefined
      // and let the zod schema produce a uniform validation error.
    }
  }
  return { rows };
}

/**
 * Map a caught error to the uniform reorder state envelope. ZodError yields
 * field errors (Channel 1 carve-out — zod errors are reachable by any caller
 * and so not themselves an enumeration channel); any other error yields the
 * resource-agnostic {@link GENERIC_FORM_ERROR}. Never re-throws.
 */
function toReorderErrorState(err: unknown): ReorderMutationState {
  if (err instanceof ZodError) {
    return { status: 'error', fieldErrors: reorderZodErrorToFieldErrors(err) };
  }
  return { status: 'error', formError: GENERIC_FORM_ERROR };
}

/**
 * Server Action — persist an admin drag-reorder of projects.
 *
 * Six-channel uniformity wrapper around `save_project_order` (migration
 * 012a). Channel 2: returns the same `{ status, fieldErrors?, formError? }`
 * envelope across outcomes and never throws to the wire. Channel 3: pads to
 * the `MIN_DURATION_MS` floor via {@link padToFloor} on every outcome.
 * Channel 4: exactly one action ID is added by this export; the throwing
 * helper is imported from a sibling non-`'use server'` module.
 *
 * F-39: {@link assertAdminSession} runs first, inside the `try`.
 *
 * @param _prevState Previous `useActionState` state. Ignored — the action is
 *                   pure with respect to its inputs.
 * @param formData   Raw form data. Must include hidden `rows` (JSON-serialized
 *                   ordered array of `{ id }`).
 * @returns The new state envelope. Always resolves; never throws.
 */
export async function saveProjectOrder(
  _prevState: ReorderMutationState,
  formData: FormData,
): Promise<ReorderMutationState> {
  const start = performance.now();
  try {
    await assertAdminSession();
    await saveOrderInternal('projects', readReorderFormData(formData));
    return { status: 'ok' };
  } catch (err) {
    return toReorderErrorState(err);
  } finally {
    await padToFloor(start);
  }
}

/**
 * Server Action — persist an admin drag-reorder of posts. Mirror of
 * {@link saveProjectOrder} against the `save_post_order` RPC (migration
 * 012a). Same six-channel uniformity contract.
 *
 * F-39: {@link assertAdminSession} runs first, inside the `try`.
 *
 * @param _prevState Previous `useActionState` state. Ignored.
 * @param formData   Raw form data. Must include hidden `rows` (JSON-serialized
 *                   ordered array of `{ id }`).
 * @returns The new state envelope. Always resolves; never throws.
 */
export async function savePostOrder(
  _prevState: ReorderMutationState,
  formData: FormData,
): Promise<ReorderMutationState> {
  const start = performance.now();
  try {
    await assertAdminSession();
    await saveOrderInternal('posts', readReorderFormData(formData));
    return { status: 'ok' };
  } catch (err) {
    return toReorderErrorState(err);
  } finally {
    await padToFloor(start);
  }
}
