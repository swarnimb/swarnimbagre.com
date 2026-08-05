import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from './supabase';
import { ServiceError } from './errors';
import { logSupabaseError } from './admin-mutation-log';
import { noteCreateSchema, noteUpdateSchema } from './admin-notes-mutations-schemas';
import type { Note } from './types';

/**
 * Module note (F-14 analogue, applied to NOTE mutations).
 *
 * This file deliberately does NOT carry the `'use server'` directive. Every
 * export of a `'use server'` module becomes a publicly-addressable Server
 * Action with a stable hashed ID in the client bundle; co-locating these
 * throwing helpers next to the non-throwing wrappers in
 * `lib/admin-notes-mutations.ts` would expose them as additional RPC
 * endpoints and defeat the Channel 4 (Server Action surface) discipline
 * documented in `docs/auth-flow.md` §2a point 4.
 *
 * Pure types + consts shared with the client forms live in
 * `lib/admin-notes-mutations-types.ts`; the zod schemas live in
 * `lib/admin-notes-mutations-schemas.ts`. This module transitively imports
 * `next/headers` via `createServerClient` from `./supabase`, which is not
 * allowed in a Client Component's module graph.
 *
 * This is the per-resource throwing-helpers module per `architecture.md`
 * §6.6.6.
 *
 * Differences from the stats helpers this surface mirrors:
 *   - Notes HAS an update path. CONSTRAINT-10's delete-then-reinsert rule
 *     was a stats-specific call (an ingested stat row is cheap to re-post);
 *     a note is hand-written prose on a fixed tile, so correcting a typo by
 *     deleting the tile is the wrong shape.
 *   - The `notes_set_updated_at` trigger (migration 014, reusing the
 *     `set_updated_at()` function from 001) stamps `updated_at` on every
 *     update, so the payload never carries it.
 *   - No nullable text columns: `kicker` and `line` are both NOT NULL with
 *     length CHECKs, so there is no empty-string-to-null normalisation step.
 *   - The `notes_set_sort_order_default` BEFORE INSERT trigger (migration 016,
 *     mirroring the projects / posts triggers from 012) appends a new row to
 *     the end when `sort_order` arrives NULL. `sort_order` is NOT NULL with no
 *     column default, so "leave it to the trigger" is expressed by omitting
 *     the key from the payload, never by sending an explicit `null`.
 */

/** Operation tag for note create-side logs and ServiceError instances. */
const CREATE_NOTE_OPERATION = 'createNote';
/** Operation tag for note update-side logs and ServiceError instances. */
const UPDATE_NOTE_OPERATION = 'updateNote';
/** Operation tag for note delete-side logs and ServiceError instances. */
const DELETE_NOTE_OPERATION = 'deleteNote';

/**
 * Guard `id` before it reaches a DB call (SEC-02). Shared by the update and
 * delete helpers, which both take the id as a bare argument rather than
 * inside the validated payload.
 *
 * @param id        Candidate row id.
 * @param operation Operation tag used in the thrown `ServiceError`.
 * @throws ServiceError when `id` is not a non-empty string.
 */
function assertNoteId(id: string, operation: string): void {
  if (typeof id !== 'string' || id.trim().length === 0) {
    throw new ServiceError('invalid id argument', {
      operation,
      cause: new Error(`id must be a non-empty string, got: ${typeof id}`),
    });
  }
}

/**
 * Build the `sort_order` fragment of a write payload.
 *
 * The column is NOT NULL with no default, so "the builder left the field
 * blank" has to be expressed by the key being absent, not by an explicit
 * `null`. On INSERT the absent key lets `notes_set_sort_order_default` append
 * the row; on UPDATE it leaves the stored rank untouched.
 *
 * @param sortOrder Parsed rank, or `undefined` when the form field was blank.
 * @returns `{ sort_order }` when a rank was given, otherwise an empty object.
 */
function sortOrderFragment(
  sortOrder: number | undefined,
): { sort_order?: number } {
  return sortOrder === undefined ? {} : { sort_order: sortOrder };
}

/**
 * Insert a new note row.
 *
 * Boundary-validates the input with `noteCreateSchema` (SEC-02) and inserts
 * via the Supabase query builder (SEC-03). No slug derivation, no pre-fetch:
 * notes has no relational integrity beyond its per-row CHECK constraints.
 *
 * A blank `sort_order` is omitted from the payload rather than written as `0`,
 * so the `notes_set_sort_order_default` trigger appends the row to the end
 * instead of every new note tying at position 0.
 *
 * Throws freely: the public Server Action in `lib/admin-notes-mutations.ts`
 * catches and converts to the uniform state envelope so the wire shape is
 * indistinguishable across outcomes (`docs/auth-flow.md` §2a Channel 2).
 *
 * @param input  Raw insert payload. Validated before any DB call.
 * @param client Optional injected client (DI seam for tests). Defaults to a
 *               request-scoped admin server client.
 * @returns The inserted note row.
 * @throws z.ZodError   when `input` fails boundary validation.
 * @throws ServiceError when Supabase rejects (e.g., RLS denial).
 */
export async function createNoteInternal(
  input: unknown,
  client?: SupabaseClient,
): Promise<Note> {
  const parsed = noteCreateSchema.parse(input);
  const supabase = client ?? (await createServerClient());
  const { data, error } = await supabase
    .from('notes')
    .insert({
      kicker: parsed.kicker,
      line: parsed.line,
      ...sortOrderFragment(parsed.sort_order),
    })
    .select()
    .single();
  if (error) {
    logSupabaseError(CREATE_NOTE_OPERATION, error);
    throw new ServiceError(`${CREATE_NOTE_OPERATION} failed`, {
      operation: CREATE_NOTE_OPERATION,
      cause: error,
    });
  }
  return data as Note;
}

/**
 * Update an existing note row by id.
 *
 * Validates `id` (SEC-02) and boundary-validates the payload with
 * `noteUpdateSchema`, then writes the full row via the Supabase query builder
 * (SEC-03). The form re-submits every field, so this is a whole-row write
 * rather than a patch. `updated_at` is intentionally absent from the payload:
 * the `notes_set_updated_at` trigger owns it.
 *
 * `sort_order` is the one field that can drop out of the payload: a blank
 * input means "do not change the rank", so the key is omitted rather than
 * resetting the stored value to `0`.
 *
 * Throws freely: the public Server Action catches and converts.
 *
 * @param id     UUID of the note to update. Must be a non-empty string.
 * @param input  Raw update payload. Validated before any DB call.
 * @param client Optional injected client (DI seam for tests). Defaults to a
 *               request-scoped admin server client.
 * @returns The updated note row.
 * @throws z.ZodError   when `input` fails boundary validation.
 * @throws ServiceError when `id` is empty, or Supabase rejects.
 */
export async function updateNoteInternal(
  id: string,
  input: unknown,
  client?: SupabaseClient,
): Promise<Note> {
  assertNoteId(id, UPDATE_NOTE_OPERATION);
  const parsed = noteUpdateSchema.parse(input);
  const supabase = client ?? (await createServerClient());
  const { data, error } = await supabase
    .from('notes')
    .update({
      kicker: parsed.kicker,
      line: parsed.line,
      ...sortOrderFragment(parsed.sort_order),
    })
    .eq('id', id)
    .select()
    .single();
  if (error) {
    logSupabaseError(UPDATE_NOTE_OPERATION, error);
    throw new ServiceError(`${UPDATE_NOTE_OPERATION} failed`, {
      operation: UPDATE_NOTE_OPERATION,
      cause: error,
    });
  }
  return data as Note;
}

/**
 * Hard-delete a note row by id.
 *
 * CONSTRAINT-10: hard-delete only. No soft-delete column, no tombstone, no
 * undo. Recovery from accidental delete is via Supabase backups; the confirm
 * modal at the UI boundary is the only undo path.
 *
 * Validates `id` is a non-empty string before any DB call (SEC-02). Deletes
 * via the Supabase query builder (SEC-03). Throws freely: the public Server
 * Action catches and converts to the uniform state envelope.
 *
 * Note: Supabase `.delete()` does not error when the row does not exist:
 * the operation is idempotent at the SQL level. A missing row therefore
 * resolves successfully; the admin UI modal opens against a row already on
 * screen so the "not found" case is unreachable in practice.
 *
 * @param id     UUID of the note to delete. Must be a non-empty string.
 * @param client Optional injected client (DI seam for tests). Defaults to a
 *               request-scoped admin server client.
 * @throws ServiceError when `id` is empty or whitespace, or Supabase rejects.
 */
export async function deleteNoteInternal(
  id: string,
  client?: SupabaseClient,
): Promise<void> {
  assertNoteId(id, DELETE_NOTE_OPERATION);
  const supabase = client ?? (await createServerClient());
  const { error } = await supabase.from('notes').delete().eq('id', id);
  if (error) {
    logSupabaseError(DELETE_NOTE_OPERATION, error);
    throw new ServiceError(`${DELETE_NOTE_OPERATION} failed`, {
      operation: DELETE_NOTE_OPERATION,
      cause: error,
    });
  }
}
