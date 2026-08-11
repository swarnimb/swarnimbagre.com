/**
 * Zod schemas for the admin PROJECT MEDIA mutation boundary (T43.E).
 *
 * Pure validation, no IO. The schemas describe the wire payload that
 * `saveProjectMedia` and `saveProjectMediaInternal` accept. The internal
 * helper and the test suite import from here.
 *
 * This file does NOT carry `'use server'` and does NOT import from any
 * module that pulls `next/headers`, so it is safe to import from anywhere
 * server-side. It is NOT safe in a Client Component because it depends on
 * `zod` (server-bundle-only configuration).
 *
 * Per `architecture.md` §6.6.6 (per-resource three-file pattern — the
 * schemas file is split from `-internal.ts` to keep that orchestrator under
 * CQ-02's 300-line cap, matching the projects analog).
 */

import { z } from 'zod';
import { PROJECT_MEDIA_MAX_ROWS } from './admin-project-media-mutations-types';

// The row-count cap lives in the client-safe `-types.ts` module (no `zod`
// dependency) so the `'use client'` form can import it without that risk.
// This file consumes it in the schema bound below.

/**
 * Per-row schema. `order_index` is intentionally absent — migration 010a's
 * `save_project_media` RPC derives it from the array position via
 * `with ordinality`, so the wire payload does not carry it. This eliminates
 * the "two rows with the same `order_index`" failure mode at the source.
 *
 * `caption` is also absent. The column survives on the table, but no design
 * pattern renders a caption (CONSTRAINT-05), so the admin no longer collects
 * one. `.strict()` means a payload that still carries the key is rejected —
 * deliberate: the only legitimate caller is the form, which stopped sending
 * it, so a `caption` key now signals a hand-crafted request. The RPC's
 * `nullif(r.value->>'caption', '')` resolves to null without it.
 *
 * The before/after distinctness rule (`image_after_id !== image_id`)
 * mirrors the `project_media_before_after_distinct` CHECK in migration 010.
 */
export const projectMediaRowSchema = z
  .object({
    image_id: z.string().uuid('image_id must be a uuid'),
    image_after_id: z.string().uuid('image_after_id must be a uuid').nullable(),
  })
  .strict()
  .refine(
    (row) => row.image_after_id === null || row.image_after_id !== row.image_id,
    {
      message: 'image_after_id must differ from image_id',
      path: ['image_after_id'],
    },
  );

/** Inferred input shape for a single carousel row. */
export type ProjectMediaInput = z.infer<typeof projectMediaRowSchema>;

/**
 * Top-level save-project-media boundary schema.
 *
 * Carries the project FK and the ordered row array. `rows.length === 0` is
 * accepted — saving with an empty array clears all media for the project
 * (intentional: the admin must be able to remove all carousel slides).
 *
 * Row count is capped at {@link PROJECT_MEDIA_MAX_ROWS}; the DB row-cap
 * trigger from migration 010 is the source of truth and would catch a
 * caller that bypasses this schema (defense-in-depth, Channel 4).
 */
export const projectMediaSaveSchema = z
  .object({
    project_id: z.string().uuid('project_id must be a uuid'),
    rows: z
      .array(projectMediaRowSchema)
      .max(
        PROJECT_MEDIA_MAX_ROWS,
        `rows must be at most ${PROJECT_MEDIA_MAX_ROWS} items`,
      ),
  })
  .strict();

/** Inferred input shape for the full save-media payload. */
export type ProjectMediaSaveInput = z.infer<typeof projectMediaSaveSchema>;
