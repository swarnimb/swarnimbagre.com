import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from './supabase';
import { ServiceError } from './errors';
import { logSupabaseError } from './admin-mutation-log';
import { statInsertSchema } from './admin-stats-mutations-schemas';
import type { Stat } from './types';

/**
 * Module note (F-14 analogue, applied to STAT mutations).
 *
 * This file deliberately does NOT carry the `'use server'` directive. Every
 * export of a `'use server'` module becomes a publicly-addressable Server
 * Action with a stable hashed ID in the client bundle; co-locating these
 * throwing helpers next to the non-throwing wrappers in
 * `lib/admin-stats-mutations.ts` would expose them as additional RPC
 * endpoints and defeat the Channel 4 (Server Action surface) discipline
 * documented in `docs/auth-flow.md` §2a point 4. The split mirrors
 * `lib/auth-internal.ts` vs `lib/auth.ts`: thrown errors are confined to
 * this module, and the wrapper in `lib/admin-stats-mutations.ts` is the
 * only Server Action surface.
 *
 * Pure types + consts shared with the client form live in a separate
 * `lib/admin-stats-mutations-types.ts`; the zod schemas and the bounds they
 * bind live in `lib/admin-stats-mutations-schemas.ts`. Both are separate
 * because this module transitively imports `next/headers` via
 * `createServerClient` from `./supabase`, which is not allowed in a Client
 * Component's module graph.
 *
 * This is the per-resource throwing-helpers module per `architecture.md`
 * §6.6.6 (per-resource pattern). Sibling files: `-types.ts` (client-safe
 * envelope), `-schemas.ts` (zod boundary) and `-mutations.ts` (`'use server'`
 * wrappers).
 *
 * Differences from the project / post helpers:
 *   - No slug, no status, no edit. CONSTRAINT-10: stats are insert-or-delete
 *     only; corrections are delete-then-reinsert. The form surface is
 *     `insertStat`; the row management surface is `deleteStat`. There is no
 *     `updateStat` helper.
 *   - The data model is wider on user-supplied text (five fields:
 *     `category`, `label`, `value`, `unit`, `aside`) but the `unit` and
 *     `aside` columns are nullable (migration 001 and migration 014
 *     respectively). The zod schema treats whitespace-only or empty
 *     submissions of either as absent and the insert payload writes explicit
 *     `null` for those cases (rather than an empty string) so the DB shape
 *     stays clean. The sixth field, `sort_order`, is numeric and NOT NULL, so
 *     an absent one is expressed by omitting the key rather than by writing
 *     `null`.
 *   - No slug-lock trigger fires on stats. The one trigger that does is
 *     `stats_set_sort_order_default` (migration 016, mirroring the projects /
 *     posts triggers from 012): a BEFORE INSERT hook that appends the row to
 *     the end when `sort_order` arrives NULL.
 */

/** Operation tag for stat insert-side logs and ServiceError instances. */
const INSERT_STAT_OPERATION = 'insertStat';
/** Operation tag for stat delete-side logs and ServiceError instances. */
const DELETE_STAT_OPERATION = 'deleteStat';
/** Operation label for update-path logs. Added T46. */
const UPDATE_STAT_OPERATION = 'updateStat';

/**
 * Build the `sort_order` fragment of a write payload.
 *
 * The column is NOT NULL with no default, so "the operator left the field
 * blank" has to be expressed by the key being absent, not by an explicit
 * `null`. On INSERT the absent key lets `stats_set_sort_order_default` append
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
 * Insert a new stat row.
 *
 * Boundary-validates the input with {@link statInsertSchema} (SEC-02) and
 * inserts via the Supabase query builder (SEC-03). `unit` is normalised to
 * an explicit `null` when absent so the column receives a clean NULL rather
 * than an empty string. `sort_order` goes the other way, via
 * {@link sortOrderFragment}: a blank one is omitted so the trigger appends the
 * row instead of every new stat tying at position 0.
 *
 * No slug derivation, no pre-fetch — stats have no relational integrity
 * beyond the per-row CHECK constraints.
 *
 * Throws freely — the public Server Action in `lib/admin-stats-mutations.ts`
 * catches and converts to the uniform state envelope so the wire shape is
 * indistinguishable across outcomes (`docs/auth-flow.md` §2a Channel 2).
 *
 * @param input  Raw insert payload. Validated before any DB call.
 * @param client Optional injected client (DI seam for tests). Defaults to a
 *               request-scoped admin server client.
 * @returns The inserted stat row.
 * @throws z.ZodError   when `input` fails boundary validation.
 * @throws ServiceError when Supabase rejects (e.g., RLS denial).
 */
export async function insertStatInternal(
  input: unknown,
  client?: SupabaseClient,
): Promise<Stat> {
  const parsed = statInsertSchema.parse(input);
  const supabase = client ?? (await createServerClient());
  const payload = {
    category: parsed.category,
    label: parsed.label,
    value: parsed.value,
    unit: parsed.unit ?? null,
    aside: parsed.aside ?? null,
    ...sortOrderFragment(parsed.sort_order),
  };
  const { data, error } = await supabase
    .from('stats')
    .insert(payload)
    .select()
    .single();
  if (error) {
    logSupabaseError(INSERT_STAT_OPERATION, error);
    throw new ServiceError(`${INSERT_STAT_OPERATION} failed`, {
      operation: INSERT_STAT_OPERATION,
      cause: error,
    });
  }
  return data as Stat;
}

/**
 * Update an existing stat row.
 *
 * Added at T46. Stats were insert-or-delete only under CONSTRAINT-10, which
 * suited append-only telemetry: a wrong number was replaced, not corrected.
 * The redesigned Other page changed the shape of the data. Its four numeric
 * tiles are hand-maintained, long-lived, and carry an `aside` quip, so fixing
 * a typo by deleting the row and retyping every field is the wrong trade.
 *
 * CONSTRAINT-10's hard-delete rule is untouched: this adds an edit path, it
 * does not add soft-delete, tombstones, or undo.
 *
 * Validates `id` (SEC-02) before any DB call, then boundary-validates the
 * payload with {@link statInsertSchema}, which is shape-identical for both
 * paths. Throws freely; the public Server Action converts to the uniform
 * envelope.
 *
 * `sort_order` is the one field that can drop out of the payload: a blank
 * input means "do not change the rank" (see {@link sortOrderFragment}).
 *
 * @param id     UUID of the stat to update. Must be a non-empty string.
 * @param input  Raw update payload. Validated before any DB call.
 * @param client Optional injected client (DI seam for tests).
 * @returns The updated stat row.
 * @throws z.ZodError   when `input` fails boundary validation.
 * @throws ServiceError when `id` is empty, or Supabase rejects.
 */
export async function updateStatInternal(
  id: string,
  input: unknown,
  client?: SupabaseClient,
): Promise<Stat> {
  if (typeof id !== 'string' || id.trim().length === 0) {
    throw new ServiceError('invalid id argument', {
      operation: UPDATE_STAT_OPERATION,
      cause: new Error(`id must be a non-empty string, got: ${typeof id}`),
    });
  }
  const parsed = statInsertSchema.parse(input);
  const supabase = client ?? (await createServerClient());
  const payload = {
    category: parsed.category,
    label: parsed.label,
    value: parsed.value,
    unit: parsed.unit ?? null,
    aside: parsed.aside ?? null,
    ...sortOrderFragment(parsed.sort_order),
  };
  const { data, error } = await supabase
    .from('stats')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error) {
    logSupabaseError(UPDATE_STAT_OPERATION, error);
    throw new ServiceError(`${UPDATE_STAT_OPERATION} failed`, {
      operation: UPDATE_STAT_OPERATION,
      cause: error,
    });
  }
  return data as Stat;
}

/**
 * Hard-delete a stat row by id.
 *
 * CONSTRAINT-10: hard-delete only — no soft-delete column, no tombstone, no
 * undo. Recovery from accidental delete is via Supabase backups; the confirm
 * modal at the UI boundary (mirrors the T22 / T23 pattern) is the only undo
 * path.
 *
 * Validates `id` is a non-empty string before any DB call (SEC-02). Deletes
 * via the Supabase query builder (SEC-03). Throws freely — the public Server
 * Action in `lib/admin-stats-mutations.ts` catches and converts to the
 * uniform state envelope so the wire shape is indistinguishable across
 * outcomes (`docs/auth-flow.md` §2a Channel 2).
 *
 * Note: Supabase `.delete()` does not error when the row does not exist —
 * the operation is idempotent at the SQL level. A missing row therefore
 * resolves successfully; the admin UI modal opens against a row already on
 * screen so the "not found" case is unreachable in practice.
 *
 * @param id     UUID of the stat to delete. Must be a non-empty string.
 * @param client Optional injected client (DI seam for tests). Defaults to a
 *               request-scoped admin server client.
 * @throws ServiceError when `id` is empty or whitespace, or Supabase rejects.
 */
export async function deleteStatInternal(
  id: string,
  client?: SupabaseClient,
): Promise<void> {
  if (typeof id !== 'string' || id.trim().length === 0) {
    throw new ServiceError('invalid id argument', {
      operation: DELETE_STAT_OPERATION,
      cause: new Error(`id must be a non-empty string, got: ${typeof id}`),
    });
  }
  const supabase = client ?? (await createServerClient());
  const { error } = await supabase.from('stats').delete().eq('id', id);
  if (error) {
    logSupabaseError(DELETE_STAT_OPERATION, error);
    throw new ServiceError(`${DELETE_STAT_OPERATION} failed`, {
      operation: DELETE_STAT_OPERATION,
      cause: error,
    });
  }
}
