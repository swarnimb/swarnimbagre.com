import { ServiceError } from './errors';

/**
 * Shared internal helpers and constants for the public read-query layer.
 *
 * Created under CQ-02 (services < 300 lines) when the post read loaders were
 * split out of `lib/db.ts` into `lib/db-posts.ts`. Both `db.ts` and
 * `db-posts.ts` import from here. This module is deliberately a third party
 * that depends on neither of them — `db.ts` re-exports `db-posts.ts`, and
 * `db-posts.ts` would import runtime values from `db.ts` if these lived there,
 * which is the circular import this module exists to break.
 *
 * Not a public surface: callers continue to import the loaders from `@/lib/db`.
 */

/** Status literal used to filter public reads. */
export const PUBLISHED = 'published';

/**
 * Validate a slug parameter at the data-layer boundary.
 *
 * @param slug      The candidate slug to check.
 * @param operation Caller name, used in the thrown ServiceError.
 * @throws ServiceError if slug is not a non-empty string.
 */
export function assertSlug(slug: unknown, operation: string): asserts slug is string {
  if (typeof slug !== 'string' || slug.length === 0) {
    throw new ServiceError('invalid slug argument', {
      operation,
      cause: new Error(`slug must be a non-empty string, got: ${typeof slug}`),
    });
  }
}

/**
 * Log a Supabase error without leaking row data or PII.
 *
 * @param operation Caller name.
 * @param error     The Supabase error object (or any thrown value).
 */
export function logDbError(operation: string, error: { code?: string; message?: string } | null): void {
  console.error(`[db] ${operation} failed`, {
    operation,
    errorCode: error?.code ?? null,
    errorMessage: error?.message ?? null,
    stack: new Error().stack,
  });
}
