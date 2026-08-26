/**
 * Zod schemas for the admin PROJECT mutation boundary.
 *
 * Pure validation, no IO. Extracted out of
 * `admin-projects-mutations-internal.ts` in T42 to keep that orchestrator
 * file under CQ-02 (300-line service-file cap). Both `-internal.ts` and the
 * test suite import the schemas from here.
 *
 * This file does NOT carry `'use server'` and does NOT import from any
 * module that pulls `next/headers`, so it is safe to import from anywhere
 * server-side. It is NOT safe in a Client Component because it depends on
 * `zod` (server-bundle-only configuration).
 */

import { z } from 'zod';

/** Mirrors `projects.title` CHECK in migration 001 (`length <= 200`). */
export const TITLE_MAX_LENGTH = 200;

/** Mirrors the `projects_subtitle_length` CHECK in migration 013. */
export const SUBTITLE_MAX_LENGTH = 120;

/** Mirrors the cardinality bound in the `projects_tags_shape` CHECK (013). */
export const TAGS_MAX_COUNT = 8;

/**
 * Per-tag ceiling. The DB CHECK can only bound the JOINED length of the array
 * (200 chars), because a per-element predicate would need a subquery, which
 * Postgres forbids inside CHECK. 24 is the practical single-pill width.
 */
export const TAG_MAX_LENGTH = 24;

/**
 * Conservative practical URL ceiling for `github_url`, `live_url`,
 * `post_url`. 2048 chars — above this, browsers and proxies start
 * rejecting. DB column is unconstrained `text` (migration 009); the cap
 * lives at the admin boundary only.
 */
export const URL_MAX_LENGTH = 2048;


/**
 * HTTPS-only URL fragment used by `github_url` and `live_url`. Rejects
 * `http://`, `ftp://`, `mailto:`, `javascript:`, and bare-string inputs.
 * Nullable: empty form fields coerce to `null` in the FormData reader.
 */
const httpsUrlSchema = z
  .string()
  .trim()
  .url('must be a valid URL')
  .startsWith('https://', 'must use https://')
  .max(URL_MAX_LENGTH, `must be at most ${URL_MAX_LENGTH} characters`);

/**
 * `subtitle` fragment (T46, migration 013). One short line under the card
 * title. The 120-character ceiling mirrors the CHECK constraint exactly.
 */
const subtitleSchema = z
  .string()
  .trim()
  .min(1, 'subtitle cannot be empty')
  .max(SUBTITLE_MAX_LENGTH, `must be at most ${SUBTITLE_MAX_LENGTH} characters`);

/**
 * `tags` fragment (T46, migration 013).
 *
 * The DB CHECK enforces cardinality, no null elements, no empty-string
 * elements and a total length ceiling, but it cannot reject a
 * whitespace-only tag: Postgres forbids subqueries inside CHECK, so there is
 * no per-element predicate available there. That case is caught here instead,
 * by trimming before the min(1) runs.
 */
const tagsSchema = z
  .array(
    z
      .string()
      .trim()
      .min(1, 'tags cannot contain blank entries')
      .max(TAG_MAX_LENGTH, `each tag must be at most ${TAG_MAX_LENGTH} characters`),
  )
  .min(1, 'tags cannot be an empty list')
  .max(TAGS_MAX_COUNT, `at most ${TAGS_MAX_COUNT} tags`);

/**
 * Create-project boundary schema.
 *
 * Image FKs (`image_id`, `image_after_id`) are NOT in create — image
 * attachment happens post-insert via the edit flow. The five content-model
 * fields (URLs + progress + subtitle + tags) are included so a publish-on-create
 * flow can land a complete row in one round-trip.
 */
export const projectCreateSchema = z.object({
  title: z.string().trim().min(1, 'title is required').max(TITLE_MAX_LENGTH),
  description: z.string().trim().min(1, 'description is required'),
  status: z.enum(['draft', 'published']).default('draft'),
  github_url: httpsUrlSchema.nullable(),
  live_url: httpsUrlSchema.nullable(),
  subtitle: subtitleSchema.nullable(),
  tags: tagsSchema.nullable(),
  post_id: z.string().uuid('post_id must be a uuid').nullable(),
}).strict();

/** Inferred input shape for the create boundary. */
export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;

/**
 * Update-project boundary schema. Same shape as create plus the two image
 * FKs (`image_id` from T26, `image_after_id` from T42). The form re-submits
 * the full row, not a patch; the throwing helper computes whether `slug`
 * should be re-derived (when existing `status === 'draft'`).
 *
 * Image FKs are UUID-or-null. The FormData reader coerces empty strings to
 * `null` BEFORE the schema runs so the parser only ever sees the post-
 * coercion shape (SEC-02).
 */
export const projectUpdateSchema = z.object({
  title: z.string().trim().min(1, 'title is required').max(TITLE_MAX_LENGTH),
  description: z.string().trim().min(1, 'description is required'),
  status: z.enum(['draft', 'published']),
  image_id: z.string().uuid('image_id must be a uuid').nullable(),
  github_url: httpsUrlSchema.nullable(),
  live_url: httpsUrlSchema.nullable(),
  subtitle: subtitleSchema.nullable(),
  tags: tagsSchema.nullable(),
  image_after_id: z
    .string()
    .uuid('image_after_id must be a uuid')
    .nullable(),
  post_id: z.string().uuid('post_id must be a uuid').nullable(),
}).strict();

/** Inferred input shape for the update boundary. */
export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>;
