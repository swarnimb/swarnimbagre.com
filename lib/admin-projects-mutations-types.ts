/**
 * Pure types + consts for the admin PROJECTS mutation surface.
 *
 * This module is the client-safe envelope for project admin mutations. It
 * carries no runtime dependencies on `next/headers`, Supabase, or zod —
 * only the shape contracts the wrappers and the form share. The throwing
 * helpers (`createProjectInternal`, `updateProjectInternal`,
 * `deleteProjectInternal`) live in
 * `lib/admin-projects-mutations-internal.ts` and the Server Action
 * wrappers live in `lib/admin-projects-mutations.ts`; both transitively
 * import `next/headers` via the Supabase server-client factory, which
 * would break any client component that imports from them.
 *
 * `ProjectForm.tsx` is a `'use client'` component; it imports ONLY from
 * this module. The Server Action functions themselves cross the boundary
 * as Server Action references via Next.js's transform — no runtime import
 * is needed on the client side.
 *
 * `GENERIC_FORM_ERROR` is NOT re-exported here — it is the canonical
 * cross-resource string in `lib/auth-constants.ts`; consumers import it
 * from there.
 */

/**
 * Discriminated state shape returned by every admin PROJECT mutation Server
 * Action.
 *
 * Channel 2 (response body) of the six-channel uniformity contract: the SHAPE
 * is identical across outcomes — `{ status, fieldErrors?, formError? }` — so
 * an attacker probing the endpoint cannot distinguish "validation failed"
 * from "Supabase fail" from "trigger raised" by the response envelope.
 */
/**
 * Union of field names that can carry a per-field zod validation error.
 * Extended in T42 to cover the six new content-model fields added in
 * migration 009 (`github_url`, `live_url`, `post_url`, `progress_percent`,
 * `image_after_id`). T46 replaced `thumb_kind` with `subtitle` and `tags`
 * (migration 013).
 */
export type ProjectMutationFieldName =
  | 'title'
  | 'description'
  | 'status'
  | 'github_url'
  | 'live_url'
  | 'subtitle'
  | 'tags'
  | 'image_after_id'
  | 'post_id';

export interface ProjectMutationState {
  /** `'idle'` is the initial state used by `useActionState`. */
  status: 'idle' | 'ok' | 'error';
  /** Field-level zod errors, keyed by schema field name. */
  fieldErrors?: Partial<Record<ProjectMutationFieldName, string>>;
  /** Form-level error (Supabase failure, trigger raise, etc.). Generic copy. */
  formError?: string;
}

/** Initial state shipped to `useActionState`. */
export const PROJECT_MUTATION_INITIAL_STATE: ProjectMutationState = {
  status: 'idle',
};
