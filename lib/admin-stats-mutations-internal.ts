import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { createServerClient } from './supabase';
import { ServiceError } from './errors';
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
 * `lib/admin-stats-mutations-types.ts` because this module transitively
 * imports `next/headers` via `createServerClient` from `./supabase`, which
 * is not allowed in a Client Component's module graph.
 *
 * This is the per-resource throwing-helpers module per `architecture.md`
 * §6.6.6 (per-resource pattern). Sibling files: `-types.ts` (client-safe
 * envelope) and `-mutations.ts` (`'use server'` wrappers).
 *
 * Differences from the project / post helpers:
 *   - No slug, no status, no edit. CONSTRAINT-10: stats are insert-or-delete
 *     only; corrections are delete-then-reinsert. The form surface is
 *     `insertStat`; the row management surface is `deleteStat`. There is no
 *     `updateStat` helper.
 *   - The data model is wider on user-supplied text (four fields:
 *     `category`, `label`, `value`, `unit`) but the `unit` column is
 *     nullable in migration 001. The zod schema treats whitespace-only or
 *     empty `unit` submissions as absent and the insert payload writes
 *     explicit `null` for those cases (rather than an empty string) so the
 *     DB shape stays clean.
 *   - No DB triggers fire on stats (no slug-lock equivalent). The whole
 *     write path is a single boundary-validated INSERT and a single
 *     id-validated DELETE.
 */

/**
 * Maximum length per stat text field (category, label, value, unit). The DB
 * has no length CHECK on these columns (migration 001 enforces non-empty
 * only); 200 chars is an app-side cap that matches the project / post
 * `TITLE_MAX_LENGTH` for symmetry across the admin write surface and
 * prevents pathological inputs reaching Postgres.
 */
const STAT_FIELD_MAX_LENGTH = 200;

/** Operation tag for stat insert-side logs and ServiceError instances. */
const INSERT_STAT_OPERATION = 'insertStat';
/** Operation tag for stat delete-side logs and ServiceError instances. */
const DELETE_STAT_OPERATION = 'deleteStat';

/**
 * Log a Supabase error without leaking row data or PII. Matches the shape of
 * `logDbError` in `lib/db.ts` so structured logs are uniform across the data
 * layer (EH-02, EH-03, SEC-05).
 */
function logMutationError(
  operation: string,
  error: { code?: string; message?: string } | null,
): void {
  console.error(`[admin-mutations] ${operation} failed`, {
    operation,
    errorCode: error?.code ?? null,
    errorMessage: error?.message ?? null,
    stack: new Error().stack,
  });
}

/**
 * Zod schema for the insert-stat boundary.
 *
 * All four fields are read as text; `category`, `label`, and `value` are
 * required non-empty (matches the DB CHECKs in migration 001 — defense in
 * depth at the app boundary). `unit` is optional — empty strings and
 * whitespace-only inputs preprocess to `undefined` so the wrapper can write
 * an explicit `null` to the column (the migration declares `unit text null`).
 * Every field is capped at {@link STAT_FIELD_MAX_LENGTH} as an app-side
 * pathological-input bound.
 */
export const statInsertSchema = z.object({
  category: z
    .string()
    .trim()
    .min(1, 'category is required')
    .max(STAT_FIELD_MAX_LENGTH),
  label: z
    .string()
    .trim()
    .min(1, 'label is required')
    .max(STAT_FIELD_MAX_LENGTH),
  value: z
    .string()
    .trim()
    .min(1, 'value is required')
    .max(STAT_FIELD_MAX_LENGTH),
  unit: z.preprocess(
    (v) => (typeof v === 'string' && v.trim().length === 0 ? undefined : v),
    z.string().trim().min(1).max(STAT_FIELD_MAX_LENGTH).optional(),
  ),
}).strict();

/** Inferred input shape for {@link insertStatInternal}. */
export type StatInsertInput = z.infer<typeof statInsertSchema>;

/**
 * Insert a new stat row.
 *
 * Boundary-validates the input with {@link statInsertSchema} (SEC-02) and
 * inserts via the Supabase query builder (SEC-03). `unit` is normalised to
 * an explicit `null` when absent so the column receives a clean NULL rather
 * than an empty string.
 *
 * No slug derivation, no pre-fetch — stats are insert-only with no
 * relational integrity beyond the per-row CHECK constraints.
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
  };
  const { data, error } = await supabase
    .from('stats')
    .insert(payload)
    .select()
    .single();
  if (error) {
    logMutationError(INSERT_STAT_OPERATION, error);
    throw new ServiceError(`${INSERT_STAT_OPERATION} failed`, {
      operation: INSERT_STAT_OPERATION,
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
    logMutationError(DELETE_STAT_OPERATION, error);
    throw new ServiceError(`${DELETE_STAT_OPERATION} failed`, {
      operation: DELETE_STAT_OPERATION,
      cause: error,
    });
  }
}
