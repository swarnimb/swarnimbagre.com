/**
 * Zod schemas for the admin NOTES mutation boundary (T46, migration 014).
 *
 * Pure validation, no IO. Follows the per-resource four-file pattern in
 * `architecture.md` §6.6.6, with the schemas split out the way the project
 * and project-media surfaces do it rather than kept inline the way the older
 * stats surface does.
 *
 * Every bound here mirrors a CHECK constraint in migration 014 exactly:
 *   - `notes_kicker_shape`            : `length(btrim(kicker)) between 1 and 40`
 *   - `notes_line_shape`              : `length(btrim(line)) between 1 and 120`
 *   - `notes_sort_order_non_negative` : `sort_order >= 0`
 * Trimming happens before the length check on both text fields, matching the
 * `btrim` in the CHECK, so a whitespace-only submission is rejected at the
 * app boundary rather than bouncing off Postgres.
 *
 * This file does NOT carry `'use server'` and does NOT import from any module
 * that pulls `next/headers`, so it is safe to import from anywhere
 * server-side. It is NOT safe in a Client Component because it depends on
 * `zod` (server-bundle-only configuration).
 */

import { z } from 'zod';

/** Mirrors the `notes_kicker_shape` CHECK upper bound in migration 014. */
export const KICKER_MAX_LENGTH = 40;

/** Mirrors the `notes_line_shape` CHECK upper bound in migration 014. */
export const LINE_MAX_LENGTH = 120;

/** Mirrors the `notes_sort_order_non_negative` CHECK in migration 014. */
export const SORT_ORDER_MIN = 0;

/**
 * Shared field shape. Notes has no lifecycle (no draft/published, no slug),
 * so create and update take the identical payload; the update path differs
 * only in carrying a row id alongside it.
 *
 * `sort_order` is `.optional()` rather than `.default(0)`. A blank input means
 * "not specified", not "zero": on create the helper omits the key so the
 * `notes_set_sort_order_default` BEFORE INSERT trigger (migration 016, mirroring
 * 012) appends the row to the end, and on update the helper omits the key so
 * the stored rank is left untouched. Defaulting to `0` here made every blank
 * submission collide at position 0. The `undefined`-means-absent convention
 * matches how the stats schema already models `unit` and `aside`.
 */
const noteFields = {
  kicker: z
    .string()
    .trim()
    .min(1, 'kicker is required')
    .max(
      KICKER_MAX_LENGTH,
      `must be at most ${KICKER_MAX_LENGTH} characters`,
    ),
  line: z
    .string()
    .trim()
    .min(1, 'line is required')
    .max(LINE_MAX_LENGTH, `must be at most ${LINE_MAX_LENGTH} characters`),
  sort_order: z
    .number()
    .int('sort_order must be a whole number')
    .min(SORT_ORDER_MIN, 'sort_order cannot be negative')
    .optional(),
};

/**
 * Create-note boundary schema. `.strict()` rejects any extra key, so a client
 * cannot smuggle `id`, `created_at` or `updated_at` into the insert payload.
 */
export const noteCreateSchema = z.object(noteFields).strict();

/** Inferred input shape for the create boundary. */
export type NoteCreateInput = z.infer<typeof noteCreateSchema>;

/**
 * Update-note boundary schema. Same shape as create: the form re-submits the
 * full row, not a patch. The row id travels as a separate argument to the
 * throwing helper rather than inside the payload, matching the post and
 * project update helpers.
 */
export const noteUpdateSchema = z.object(noteFields).strict();

/** Inferred input shape for the update boundary. */
export type NoteUpdateInput = z.infer<typeof noteUpdateSchema>;
