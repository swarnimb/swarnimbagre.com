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

/**
 * Maximum number of carousel rows per project. Mirrors the row-cap trigger
 * `project_media_enforce_row_cap` in migration 010. App-layer enforcement
 * (this constant) is defense-in-depth: the trigger is the source of truth.
 */
export const PROJECT_MEDIA_MAX_ROWS = 20;

/**
 * Maximum caption length per row. Mirrors the `project_media_caption_length`
 * CHECK constraint in migration 010 (`char_length(caption) <= 280`).
 */
export const PROJECT_MEDIA_CAPTION_MAX_LENGTH = 280;

/**
 * Per-row schema. `order_index` is intentionally absent — migration 010a's
 * `save_project_media` RPC derives it from the array position via
 * `with ordinality`, so the wire payload does not carry it. This eliminates
 * the "two rows with the same `order_index`" failure mode at the source.
 *
 * The before/after distinctness rule (`image_after_id !== image_id`)
 * mirrors the `project_media_before_after_distinct` CHECK in migration 010.
 */
export const projectMediaRowSchema = z
  .object({
    image_id: z.string().uuid('image_id must be a uuid'),
    image_after_id: z.string().uuid('image_after_id must be a uuid').nullable(),
    caption: z
      .string()
      .max(
        PROJECT_MEDIA_CAPTION_MAX_LENGTH,
        `caption must be at most ${PROJECT_MEDIA_CAPTION_MAX_LENGTH} characters`,
      )
      .nullable(),
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
