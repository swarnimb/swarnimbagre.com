/**
 * Pure types + consts for the admin mutation surface.
 *
 * This module is import-safe from both server and client code. It carries
 * no runtime dependencies on `next/headers`, Supabase, or zod — only the
 * shape contracts the wrappers and the form share. The throwing helpers
 * (`createProjectInternal`, `updateProjectInternal`) live in
 * `lib/admin-mutations-internal.ts` and the Server Action wrappers live in
 * `lib/admin-mutations.ts`; both transitively import `next/headers` via the
 * Supabase server-client factory, which would break any client component
 * that imports from them.
 *
 * `ProjectForm.tsx` is a `'use client'` component; it imports ONLY from this
 * module. The Server Action functions themselves cross the boundary as
 * Server Action references via Next.js's transform — no runtime import is
 * needed on the client side.
 */

/**
 * Discriminated state shape returned by every admin mutation Server Action.
 *
 * Channel 2 (response body) of the six-channel uniformity contract: the SHAPE
 * is identical across outcomes — `{ status, fieldErrors?, formError? }` — so
 * an attacker probing the endpoint cannot distinguish "validation failed"
 * from "Supabase fail" from "trigger raised" by the response envelope.
 */
export interface ProjectMutationState {
  /** `'idle'` is the initial state used by `useActionState`. */
  status: 'idle' | 'ok' | 'error';
  /** Field-level zod errors, keyed by schema field name. */
  fieldErrors?: Partial<Record<'title' | 'description' | 'status', string>>;
  /** Form-level error (Supabase failure, trigger raise, etc.). Generic copy. */
  formError?: string;
}

/** Initial state shipped to `useActionState`. */
export const PROJECT_MUTATION_INITIAL_STATE: ProjectMutationState = {
  status: 'idle',
};

/**
 * Discriminated state shape returned by every admin POST mutation Server
 * Action (T23). Same envelope as {@link ProjectMutationState} but with the
 * `fieldErrors` keys narrowed to the fields the post form actually owns
 * (`title`, `content`, `status`). Channel 1 (UI text) requires we leak no
 * shape information beyond the form's declared fields — so each resource
 * gets its own narrow field union rather than a single shared `string` map.
 */
export interface PostMutationState {
  /** `'idle'` is the initial state used by `useActionState`. */
  status: 'idle' | 'ok' | 'error';
  /** Field-level zod errors, keyed by schema field name. */
  fieldErrors?: Partial<Record<'title' | 'content' | 'status', string>>;
  /** Form-level error (Supabase failure, trigger raise, etc.). Generic copy. */
  formError?: string;
}

/** Initial state shipped to `useActionState` for post mutations. */
export const POST_MUTATION_INITIAL_STATE: PostMutationState = {
  status: 'idle',
};

/**
 * Generic form-level error string. CONSTRAINT-13 voice rule: dry, terse, no
 * SaaS phrasing. The string is intentionally non-specific — any specificity
 * would re-open a Channel 1 (UI text) leak about whether the failure was a
 * trigger raise, a unique violation, or a network blip.
 *
 * Shared by both project and post mutation surfaces — the wire string is
 * intentionally resource-agnostic so cross-resource enumeration via copy
 * differences is impossible.
 */
export const GENERIC_FORM_ERROR = 'Could not save. Try again.';
