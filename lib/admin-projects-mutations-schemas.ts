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
import { THUMB_KIND_VALUES, type ThumbKind } from './thumb-kinds';

/** Mirrors `projects.title` CHECK in migration 001 (`length <= 200`). */
export const TITLE_MAX_LENGTH = 200;

/**
 * Conservative practical URL ceiling for `github_url`, `live_url`,
 * `post_url`. 2048 chars — above this, browsers and proxies start
 * rejecting. DB column is unconstrained `text` (migration 009); the cap
 * lives at the admin boundary only.
 */
export const URL_MAX_LENGTH = 2048;

/** Lower bound for `progress_percent` (matches DB CHECK in migration 009). */
export const PROGRESS_PERCENT_MIN = 0;
/** Upper bound for `progress_percent` (matches DB CHECK in migration 009). */
export const PROGRESS_PERCENT_MAX = 100;

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
 * `post_url` fragment — accepts either an absolute https:// URL (external
 * writeup) or a single-`/`-prefixed relative path (internal post slug,
 * e.g. `/writing/some-slug`). A standard `z.string().url()` would reject
 * the relative form; this refine carries both shapes intentionally per
 * the @cto consult (T42 Session A guard #1).
 *
 * F-36 (audit 17): the second branch explicitly excludes `//`-prefixed
 * values. Browsers interpret `//host` as a protocol-relative URL pointing
 * to `host`, not as a relative path. Accepting it would let an admin-side
 * compromise inject `<a href="//attacker.com">` and silently redirect
 * visitors. The single-slash check closes that gap.
 */
const postUrlSchema = z
  .string()
  .trim()
  .min(1, 'post_url cannot be empty')
  .max(URL_MAX_LENGTH, `must be at most ${URL_MAX_LENGTH} characters`)
  .refine(
    (value): boolean =>
      value.startsWith('https://') ||
      (value.startsWith('/') && !value.startsWith('//')),
    { message: 'must start with https:// or a single /' },
  );

/**
 * `thumb_kind` fragment. The closed value set lives in `lib/thumb-kinds.ts`
 * as `THUMB_KIND_VALUES`. The cast widens the readonly tuple to the
 * mutable shape `z.enum` requires; the runtime check is unaffected.
 */
const thumbKindSchema = z.enum(
  THUMB_KIND_VALUES as unknown as [ThumbKind, ...ThumbKind[]],
);

/**
 * Create-project boundary schema.
 *
 * Image FKs (`image_id`, `image_after_id`) are NOT in create — image
 * attachment happens post-insert via the edit flow. The five content-model
 * fields (URLs + progress + thumb_kind) are included so a publish-on-create
 * flow can land a complete row in one round-trip.
 */
export const projectCreateSchema = z.object({
  title: z.string().trim().min(1, 'title is required').max(TITLE_MAX_LENGTH),
  description: z.string().trim().min(1, 'description is required'),
  status: z.enum(['draft', 'published']).default('draft'),
  github_url: httpsUrlSchema.nullable(),
  live_url: httpsUrlSchema.nullable(),
  post_url: postUrlSchema.nullable(),
  progress_percent: z
    .number()
    .int('progress_percent must be a whole number')
    .min(PROGRESS_PERCENT_MIN)
    .max(PROGRESS_PERCENT_MAX)
    .nullable(),
  thumb_kind: thumbKindSchema.nullable(),
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
  post_url: postUrlSchema.nullable(),
  progress_percent: z
    .number()
    .int('progress_percent must be a whole number')
    .min(PROGRESS_PERCENT_MIN)
    .max(PROGRESS_PERCENT_MAX)
    .nullable(),
  thumb_kind: thumbKindSchema.nullable(),
  image_after_id: z
    .string()
    .uuid('image_after_id must be a uuid')
    .nullable(),
}).strict();

/** Inferred input shape for the update boundary. */
export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>;
