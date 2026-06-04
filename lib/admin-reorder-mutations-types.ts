/**
 * Pure types + consts for the admin REORDER mutation surface (T44.C).
 *
 * This module is the client-safe envelope for the project/post drag-reorder
 * admin mutations. It carries no runtime dependencies on `next/headers`,
 * Supabase, or zod — only the shape contract the wrapper and the reorder UI
 * share. The throwing helper (`saveOrderInternal`) lives in
 * `lib/admin-reorder-mutations-internal.ts` and the Server Action wrappers
 * (`saveProjectOrder`, `savePostOrder`) live in
 * `lib/admin-reorder-mutations.ts`; both transitively import `next/headers`
 * via the Supabase server-client factory, which would break any client
 * component that imports from them.
 *
 * Mirrors the four-file pattern established by the project_media surface
 * (T43.E) and documented in `architecture.md` §6.6.6. `GENERIC_FORM_ERROR`
 * is NOT re-exported here — it is the canonical cross-resource string in
 * `lib/auth-constants.ts`; consumers import it from there.
 */

/**
 * Discriminated state shape returned by the reorder save Server Actions.
 *
 * Channel 2 (response body) of the six-channel uniformity contract: the SHAPE
 * is identical across outcomes — `{ status, fieldErrors?, formError? }` — so
 * an attacker probing the endpoint cannot distinguish "validation failed"
 * from "Supabase fail" from "trigger raised" by the response envelope. This
 * is byte-for-byte the same envelope as
 * {@link ProjectMediaMutationState} so the two surfaces stay wire-uniform.
 *
 * `fieldErrors` keys follow a path-string convention because the boundary
 * carries an unbounded `rows` array:
 *   - `'rows'`                  — array-level validation
 *   - `'rows.<index>.id'`       — per-row id (non-uuid) error
 * where `<index>` is the row's 0-based array position.
 */
export interface ReorderMutationState {
  /** `'idle'` is the initial state used by `useActionState`. */
  status: 'idle' | 'ok' | 'error';
  /** Field-level zod errors, keyed by schema path string. */
  fieldErrors?: Record<string, string>;
  /** Form-level error (Supabase failure, trigger raise, etc.). Generic copy. */
  formError?: string;
}

/** Initial state shipped to `useActionState`. */
export const REORDER_MUTATION_INITIAL_STATE: ReorderMutationState = {
  status: 'idle',
};
