import { ServiceError } from './errors';
import { slugify } from './slug';

/**
 * Shared slug-derivation helper for the admin project / post mutation
 * surfaces. Extracted to its own module under CQ-02 (services < 300 lines)
 * — both `admin-projects-mutations-internal.ts` and
 * `admin-posts-mutations-internal.ts` carried the same four-line
 * derive-or-throw block twice (create + update), and inlining `image_id`
 * support at T26 pushed both files past the cap.
 *
 * The helper is project/post agnostic: callers pass their own `operation`
 * tag so the resulting {@link ServiceError} carries call-site context for
 * structured logs (EH-02).
 */

/**
 * Derive a non-empty slug from `title` or throw a context-rich
 * {@link ServiceError}. Mirrors the previous inline check in
 * `createProjectInternal` / `updateProjectInternal` and the post
 * equivalents.
 *
 * @param title     The raw title to slugify. Already trimmed by the zod
 *                  schema at the boundary, but {@link slugify} is the
 *                  authoritative transformer.
 * @param operation Operation tag used in the thrown ServiceError so logs
 *                  can attribute the failure to the correct call site
 *                  (e.g. `'createProject'`, `'updatePost'`).
 * @returns The derived slug.
 * @throws ServiceError when {@link slugify} collapses `title` to an
 *                     empty string.
 */
export function deriveSlugOrThrow(title: string, operation: string): string {
  const slug = slugify(title);
  if (slug.length === 0) {
    throw new ServiceError('slug derives to empty from title', {
      operation,
      cause: new Error('slugify(title) returned an empty string'),
    });
  }
  return slug;
}
