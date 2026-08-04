/**
 * Pure types + consts for the admin NOTES mutation surface (T46).
 *
 * This module is the client-safe envelope for note admin mutations. It
 * carries no runtime dependencies on `next/headers`, Supabase, or zod,
 * only the shape contracts the wrappers and the forms share. The throwing
 * helpers (`createNoteInternal`, `updateNoteInternal`, `deleteNoteInternal`)
 * live in `lib/admin-notes-mutations-internal.ts` and the Server Action
 * wrappers live in `lib/admin-notes-mutations.ts`; both transitively import
 * `next/headers` via the Supabase server-client factory, which would break
 * any client component that imports from them.
 *
 * `NotesInsertForm.tsx` and `NoteRow.tsx` are `'use client'` components; they
 * import ONLY from this module. The Server Action functions themselves cross
 * the boundary as Server Action references via Next.js's transform: no
 * runtime import is needed on the client side.
 *
 * `GENERIC_FORM_ERROR` is NOT re-exported here: it is the canonical
 * cross-resource string in `lib/auth-constants.ts`; consumers import it
 * from there.
 */

/**
 * Discriminated state shape returned by every admin NOTE mutation Server
 * Action. Same envelope shape as the stat / post / project equivalents with
 * the `fieldErrors` keys narrowed to the fields the note forms actually own
 * (`kicker`, `line`, `sort_order`). Notes has no lifecycle: no
 * draft/published, no slug, no image attachment.
 */
export interface NoteMutationState {
  /** `'idle'` is the initial state used by `useActionState`. */
  status: 'idle' | 'ok' | 'error';
  /** Field-level zod errors, keyed by schema field name. */
  fieldErrors?: Partial<Record<'kicker' | 'line' | 'sort_order', string>>;
  /** Form-level error (Supabase failure, RLS denial, etc.). Generic copy. */
  formError?: string;
}

/** Initial state shipped to `useActionState` for note mutations. */
export const NOTE_MUTATION_INITIAL_STATE: NoteMutationState = {
  status: 'idle',
};
