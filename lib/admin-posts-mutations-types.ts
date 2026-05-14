/**
 * Pure types + consts for the admin POSTS mutation surface.
 *
 * This module is the client-safe envelope for post admin mutations. It
 * carries no runtime dependencies on `next/headers`, Supabase, or zod —
 * only the shape contracts the wrappers and the form share. The throwing
 * helpers (`createPostInternal`, `updatePostInternal`, `deletePostInternal`)
 * live in `lib/admin-posts-mutations-internal.ts` and the Server Action
 * wrappers live in `lib/admin-posts-mutations.ts`; both transitively
 * import `next/headers` via the Supabase server-client factory, which
 * would break any client component that imports from them.
 *
 * `PostForm.tsx` is a `'use client'` component; it imports ONLY from
 * this module. The Server Action functions themselves cross the boundary
 * as Server Action references via Next.js's transform — no runtime import
 * is needed on the client side.
 *
 * `GENERIC_FORM_ERROR` is NOT re-exported here — it is the canonical
 * cross-resource string in `lib/auth-constants.ts`; consumers import it
 * from there.
 */

/**
 * Discriminated state shape returned by every admin POST mutation Server
 * Action (T23). Same envelope shape as the project equivalent but with the
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
