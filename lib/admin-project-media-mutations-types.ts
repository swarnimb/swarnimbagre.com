/**
 * Pure types + consts for the admin PROJECT MEDIA mutation surface (T43.E).
 *
 * This module is the client-safe envelope for project_media admin mutations.
 * It carries no runtime dependencies on `next/headers`, Supabase, or zod —
 * only the shape contracts the wrapper and the form share. The throwing
 * helper (`saveProjectMediaInternal`) lives in
 * `lib/admin-project-media-mutations-internal.ts` and the Server Action
 * wrapper lives in `lib/admin-project-media-mutations.ts`; both transitively
 * import `next/headers` via the Supabase server-client factory, which would
 * break any client component that imports from them.
 *
 * The form for this surface (`ProjectMediaField`, T43.F) is a `'use client'`
 * component that imports ONLY from this module.
 *
 * `GENERIC_FORM_ERROR` is NOT re-exported here — it is the canonical
 * cross-resource string in `lib/auth-constants.ts`; consumers import it
 * from there.
 *
 * Per `architecture.md` §6.6.6 (per-resource three-file pattern).
 */

/**
 * Logical schema-field roots for the save-project-media boundary.
 *
 * Used for documentation and the wrapper's allowlist; the actual fieldErrors
 * key in {@link ProjectMediaMutationState} is a path string (e.g.,
 * `'rows.3.image_id'`) because the rows array is unbounded. Issues that
 * resolve to a path with a root NOT in this union are dropped to avoid
 * leaking shape information through Channel 1.
 */
export type ProjectMediaMutationFieldName =
  | 'project_id'
  | 'rows'
  | 'image_id'
  | 'image_after_id'
  | 'caption';

/**
 * Discriminated state shape returned by the project_media save Server Action.
 *
 * Channel 2 (response body) of the six-channel uniformity contract: the SHAPE
 * is identical across outcomes — `{ status, fieldErrors?, formError? }` — so
 * an attacker probing the endpoint cannot distinguish "validation failed"
 * from "Supabase fail" from "trigger raised" by the response envelope.
 *
 * `fieldErrors` keys follow a path-string convention because the boundary
 * carries an unbounded `rows` array:
 *   - `'project_id'`           — top-level UUID validation
 *   - `'rows'`                  — array-level (max 20 row-cap rejection)
 *   - `'rows.<index>.<field>'`  — per-row field error
 * where `<index>` is the row's 0-based array position and `<field>` is one
 * of `image_id`, `image_after_id`, `caption`. The path roots are constrained
 * to {@link ProjectMediaMutationFieldName} by the wrapper's allowlist; any
 * unexpected root is dropped to avoid shape leakage.
 */
export interface ProjectMediaMutationState {
  /** `'idle'` is the initial state used by `useActionState`. */
  status: 'idle' | 'ok' | 'error';
  /** Field-level zod errors, keyed by schema path string. */
  fieldErrors?: Record<string, string>;
  /** Form-level error (Supabase failure, trigger raise, etc.). Generic copy. */
  formError?: string;
}

/** Initial state shipped to `useActionState`. */
export const PROJECT_MEDIA_MUTATION_INITIAL_STATE: ProjectMediaMutationState = {
  status: 'idle',
};

/**
 * Maximum number of carousel rows per project. Mirrors the row-cap trigger
 * `project_media_enforce_row_cap` in migration 010. App-layer enforcement
 * (this constant) is defense-in-depth: the trigger is the source of truth.
 *
 * Lives in this client-safe module (not `-schemas.ts`) so the `'use client'`
 * `ProjectMediaField` form can import it without risking `zod` in the client
 * bundle — architecture §6.6.6: the form imports from `-types.ts` only.
 */
export const PROJECT_MEDIA_MAX_ROWS = 20;

/**
 * Maximum caption length per row. Mirrors the `project_media_caption_length`
 * CHECK constraint in migration 010 (`char_length(caption) <= 280`). Lives
 * in this client-safe module for the same reason as
 * {@link PROJECT_MEDIA_MAX_ROWS}.
 */
export const PROJECT_MEDIA_CAPTION_MAX_LENGTH = 280;
