/**
 * Zod schema for the admin REORDER mutation boundary (T44.C).
 *
 * Pure validation, no IO. The schema describes the wire payload that
 * `saveProjectOrder` / `savePostOrder` (and `saveOrderInternal`) accept: an
 * ordered array of row identifiers. The RPCs `save_project_order` /
 * `save_post_order` (migration 012a) derive `sort_order` from array position
 * via `with ordinality`, so the wire payload carries ONLY `{ id }` per row —
 * never `sort_order` itself. `.strict()` rejects any extra key (e.g. a
 * client that smuggles a `sort_order` field), matching the project_media
 * schema convention (T43.E).
 *
 * This file does NOT carry `'use server'` and does NOT import from any module
 * that pulls `next/headers`, so it is safe to import from anywhere
 * server-side. It is NOT safe in a Client Component because it depends on
 * `zod` (server-bundle-only configuration).
 *
 * Per `architecture.md` §6.6.6 (per-resource four-file pattern).
 */

import { z } from 'zod';

/**
 * Top-level reorder boundary schema.
 *
 * Carries the ordered `rows` array. Each row is `{ id }` only; `.strict()`
 * on the row object rejects any additional key. An empty array is accepted
 * — it is a no-op reorder at the DB layer (no rows match), which is harmless.
 * The outer object is `.strict()` to mirror
 * `projectMediaSaveSchema` (T43.E).
 */
export const reorderSaveSchema = z
  .object({
    rows: z.array(z.object({ id: z.string().uuid('id must be a uuid') }).strict()),
  })
  .strict();

/** Inferred input shape for the full reorder payload. */
export type ReorderSaveInput = z.infer<typeof reorderSaveSchema>;
