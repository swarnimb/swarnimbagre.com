'use server';

import { ZodError } from 'zod';
import { saveProjectMediaInternal } from './admin-project-media-mutations-internal';
import type {
  ProjectMediaMutationFieldName,
  ProjectMediaMutationState,
} from './admin-project-media-mutations-types';
import { GENERIC_FORM_ERROR } from './auth-constants';
import { assertAdminSession } from './session';
import { padToFloor } from './timing';

/**
 * Module note (F-14 analogue, applied to PROJECT MEDIA mutations).
 *
 * Every export from a `'use server'` module is promoted by Next.js to a
 * publicly-addressable Server Action with a stable hashed action ID that
 * ships in the client bundle. Channel 4 (Server Action surface) of the
 * six-channel uniformity contract requires this surface stay tightly
 * bounded — exactly the actions the UI calls, no co-located helpers. The
 * throwing helper (zod parse + Supabase RPC dispatch) lives in
 * `lib/admin-project-media-mutations-internal.ts`, which does NOT carry
 * `'use server'`.
 *
 * SEC-09 allowlist (enforced by `tests/server-actions-manifest.test.ts`)
 * ID landed by this module: `saveProjectMedia`. The action only enters the
 * `.next/server/server-reference-manifest.json` once it is reachable from
 * an `app/**` route — T43.F wires the admin form to it.
 *
 * Per `architecture.md` §6.6.6.
 */

/**
 * Allowlist of zod-error path roots we surface to the form. Anything outside
 * this set is dropped to avoid leaking shape information through Channel 1.
 *
 * Kept as a Set (not a switch) so adding fields touches data, not control
 * flow. The unbounded row-index dimension of `rows.<i>.<field>` paths is
 * handled by the path-builder: only the root segment is matched here.
 */
const ALLOWED_FIELD_ROOTS: ReadonlySet<ProjectMediaMutationFieldName> = new Set([
  'project_id',
  'rows',
  'image_id',
  'image_after_id',
  'caption',
]);

/** Type guard: narrow an unknown root segment into the allowed-fields union. */
function isAllowedFieldRoot(
  value: unknown,
): value is ProjectMediaMutationFieldName {
  return (
    typeof value === 'string' &&
    ALLOWED_FIELD_ROOTS.has(value as ProjectMediaMutationFieldName)
  );
}

/**
 * Stringify a ZodError path into the documented fieldErrors key convention:
 * top-level keys stay as their string segment (`'project_id'`, `'rows'`);
 * per-row paths join with `.` (`'rows.3.image_id'`).
 *
 * Returns `null` if the path's root segment is not in
 * {@link ALLOWED_FIELD_ROOTS}, signaling the issue should be dropped to
 * avoid leaking schema shape.
 */
function buildFieldErrorKey(path: ReadonlyArray<unknown>): string | null {
  if (path.length === 0) return null;
  const root = path[0];
  if (!isAllowedFieldRoot(root)) return null;
  return path.map((segment) => String(segment)).join('.');
}

/**
 * Convert a `ZodError` into the per-field state shape. Only paths whose
 * root segment is in {@link ALLOWED_FIELD_ROOTS} are surfaced; any other
 * path is ignored — Channel 1 (UI text) requires we leak no shape
 * information beyond the form's declared fields.
 */
function projectMediaZodErrorToFieldErrors(
  err: ZodError,
): ProjectMediaMutationState['fieldErrors'] {
  const fieldErrors: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = buildFieldErrorKey(issue.path);
    if (key === null) continue;
    // Keep the first message per field; later issues for the same field are
    // less informative for the user (zod emits them in order).
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

/**
 * Read the FormData payload into the raw save shape. The client serializes
 * the rows array via `JSON.stringify` into a single hidden `rows` field;
 * `project_id` is a separate hidden field. The cast to `unknown` is
 * intentional — the zod schema is the authoritative validator at the
 * boundary (SEC-02).
 *
 * Malformed JSON in the `rows` field leaves `rows` undefined; the schema
 * then rejects with a uniform "rows is required" message. The silent catch
 * is acceptable here because the only legitimate caller (the form) builds
 * the JSON from React state, so a parse failure indicates a hand-crafted
 * request, not legitimate use — the uniform error envelope is the right
 * response and matches the Channel 2 contract.
 */
function readSaveProjectMediaFormData(formData: FormData): unknown {
  const projectId = formData.get('project_id');
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
  return { project_id: projectId, rows };
}

/**
 * Server Action — atomic save-all of `project_media` rows for one project.
 *
 * Channel 1 (UI text): on success, surfaces nothing — the form rerenders
 * client-side from the new state. On error, surfaces the generic
 * `GENERIC_FORM_ERROR` for any non-validation failure, and zod-derived
 * field errors for validation failures (the only carve-out — zod errors
 * are reachable by any caller and so not themselves an enumeration channel).
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
 * Atomicity is provided at the DB layer by the `save_project_media` RPC
 * from migration 010a — DELETE + INSERT in one Postgres transaction. The
 * Server Action is a thin uniformity wrapper around that RPC.
 *
 * F-39: {@link assertAdminSession} runs first, inside the `try`.
 *
 * @param _prevState Previous `useActionState` state. Ignored — the action
 *                   is pure with respect to its inputs.
 * @param formData   Raw form data. Must include hidden `project_id` (UUID)
 *                   and `rows` (JSON-serialized array of row payloads).
 * @returns The new state envelope. Always resolves; never throws.
 */
export async function saveProjectMedia(
  _prevState: ProjectMediaMutationState,
  formData: FormData,
): Promise<ProjectMediaMutationState> {
  const start = performance.now();
  try {
    await assertAdminSession();
    await saveProjectMediaInternal(readSaveProjectMediaFormData(formData));
    return { status: 'ok' };
  } catch (err) {
    if (err instanceof ZodError) {
      return {
        status: 'error',
        fieldErrors: projectMediaZodErrorToFieldErrors(err),
      };
    }
    return { status: 'error', formError: GENERIC_FORM_ERROR };
  } finally {
    await padToFloor(start);
  }
}
