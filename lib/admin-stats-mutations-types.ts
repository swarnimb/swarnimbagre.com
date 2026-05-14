/**
 * Pure types + consts for the admin STATS mutation surface.
 *
 * This module is the client-safe envelope for stat admin mutations. It
 * carries no runtime dependencies on `next/headers`, Supabase, or zod —
 * only the shape contracts the wrappers and the form share. The throwing
 * helpers (`insertStatInternal`, `deleteStatInternal`) live in
 * `lib/admin-stats-mutations-internal.ts` and the Server Action wrappers
 * live in `lib/admin-stats-mutations.ts`; both transitively import
 * `next/headers` via the Supabase server-client factory, which would break
 * any client component that imports from them.
 *
 * `StatsInsertForm.tsx` is a `'use client'` component; it imports ONLY from
 * this module. The Server Action functions themselves cross the boundary
 * as Server Action references via Next.js's transform — no runtime import
 * is needed on the client side.
 *
 * `GENERIC_FORM_ERROR` is NOT re-exported here — it is the canonical
 * cross-resource string in `lib/auth-constants.ts`; consumers import it
 * from there.
 */

/**
 * Discriminated state shape returned by every admin STAT mutation Server
 * Action (T24). Same envelope shape as the project / post equivalents with
 * the `fieldErrors` keys narrowed to the fields the stat form actually owns
 * (`category`, `label`, `value`, `unit`). Stats has no lifecycle (no
 * draft/published, no edit, no slug) — the mutation surface is `insertStat`
 * and `deleteStat` only.
 */
export interface StatMutationState {
  /** `'idle'` is the initial state used by `useActionState`. */
  status: 'idle' | 'ok' | 'error';
  /** Field-level zod errors, keyed by schema field name. */
  fieldErrors?: Partial<Record<'category' | 'label' | 'value' | 'unit', string>>;
  /** Form-level error (Supabase failure, RLS denial, etc.). Generic copy. */
  formError?: string;
}

/** Initial state shipped to `useActionState` for stat mutations. */
export const STAT_MUTATION_INITIAL_STATE: StatMutationState = {
  status: 'idle',
};
