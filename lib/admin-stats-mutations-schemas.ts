/**
 * Zod schemas for the admin STATS mutation boundary (T24, extended at T46 by
 * migration 014).
 *
 * Pure validation, no IO. Follows the per-resource four-file pattern in
 * `architecture.md` §6.6.6. The stats surface kept its schemas inline in
 * `-internal.ts` longer than its siblings did; they were split out here so
 * that orchestrator stays under CQ-02's 300-line cap, matching the notes and
 * project-media analogs.
 *
 * Bounds are a mix of DB-mirroring and app-side:
 *   - `stats_aside_length`            : `length(btrim(aside)) between 1 and 160`
 *   - `stats_sort_order_non_negative` : `sort_order >= 0`
 * both from migration 014, are mirrored exactly. The 200-char cap on the four
 * original text fields is an app-side invention — migration 001 enforces
 * non-empty only.
 *
 * This file does NOT carry `'use server'` and does NOT import from any module
 * that pulls `next/headers`, so it is safe to import from anywhere
 * server-side. It is NOT safe in a Client Component because it depends on
 * `zod` (server-bundle-only configuration).
 */

import { z } from 'zod';

/**
 * Maximum length per stat text field (category, label, value, unit). The DB
 * has no length CHECK on these columns (migration 001 enforces non-empty
 * only); 200 chars is an app-side cap that matches the project / post
 * `TITLE_MAX_LENGTH` for symmetry across the admin write surface and
 * prevents pathological inputs reaching Postgres.
 */
const STAT_FIELD_MAX_LENGTH = 200;

/**
 * Ceiling for the optional `aside` quip. Mirrors the `stats_aside_length`
 * CHECK in migration 014 exactly (`length(btrim(aside)) between 1 and 160`).
 * Unlike the four original text fields, this bound is NOT an app-side
 * invention: overshooting it is a DB-level rejection, so the app boundary
 * has to agree with it.
 */
export const STAT_ASIDE_MAX_LENGTH = 160;

/**
 * Lower bound for `sort_order`. Mirrors the `stats_sort_order_non_negative`
 * CHECK in migration 014.
 */
export const STAT_SORT_ORDER_MIN = 0;

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
 *
 * T46 (migration 014) added two more fields. `aside` is the optional italic
 * quip under the label: same empty-string-to-`undefined` preprocess as
 * `unit`, but capped at {@link STAT_ASIDE_MAX_LENGTH} because that bound is
 * a real DB CHECK, not an app-side convention. `sort_order` is the manual
 * display rank: a non-negative integer bounded by the
 * `stats_sort_order_non_negative` CHECK, and `.optional()` rather than
 * `.default(0)` so a blank input means "not specified" instead of "zero".
 * See `sortOrderFragment` in `lib/admin-stats-mutations-internal.ts` for what
 * absent does to the payload.
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
  aside: z.preprocess(
    (v) => (typeof v === 'string' && v.trim().length === 0 ? undefined : v),
    z
      .string()
      .trim()
      .min(1)
      .max(
        STAT_ASIDE_MAX_LENGTH,
        `must be at most ${STAT_ASIDE_MAX_LENGTH} characters`,
      )
      .optional(),
  ),
  sort_order: z
    .number()
    .int('sort_order must be a whole number')
    .min(STAT_SORT_ORDER_MIN, 'sort_order cannot be negative')
    .optional(),
}).strict();

/**
 * Inferred input shape for `insertStatInternal` (and `updateStatInternal`,
 * which is shape-identical) in `lib/admin-stats-mutations-internal.ts`.
 */
export type StatInsertInput = z.infer<typeof statInsertSchema>;
