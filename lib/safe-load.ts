import { ServiceError } from './errors';

/**
 * UI-boundary wrapper for data loads that should degrade to an empty state
 * rather than throw a 500 when the underlying query fails.
 *
 * Logs the failure with full context (operation, error code, message, stack)
 * in the same structured shape as `logDbError` in `lib/db.ts`, then returns
 * the caller-supplied fallback so the page can render its empty state.
 *
 * This is acceptable per error-handling rule EH-01 because the catch is at
 * the top-level page boundary (Next.js server component), the error is logged
 * visibly with stack trace, and the UI surfaces a degraded — not invisible —
 * outcome. It is NOT a generic silent-catch and must not be used at non-boundary
 * call sites.
 *
 * @param load     Thunk that performs the data load. May throw `ServiceError`
 *                 or any other error.
 * @param fallback Value returned when `load` throws. Typically an empty array
 *                 or empty record.
 * @param context  Identifier of the calling page (e.g. `'page:projects'`).
 *                 Used only in the log entry so a developer can locate the
 *                 failing render path without stack reconstruction.
 * @returns The result of `load()` on success, `fallback` on any thrown error.
 */
export async function safeLoad<T>(
  load: () => Promise<T>,
  fallback: T,
  context: string,
): Promise<T> {
  try {
    return await load();
  } catch (error) {
    logLoadFailure(context, error);
    return fallback;
  }
}

/**
 * Emit a structured log entry for a page-boundary load failure.
 *
 * Mirrors the shape of `logDbError` in `lib/db.ts` so log consumers see a
 * single consistent format across the data layer and the UI boundary.
 *
 * @param context Page-level identifier supplied by the caller.
 * @param error   The thrown value. `ServiceError` fields are surfaced when
 *                present; otherwise the error is logged with whatever shape
 *                it has.
 */
function logLoadFailure(context: string, error: unknown): void {
  const isServiceError = error instanceof ServiceError;
  const cause = isServiceError ? error.cause : undefined;
  const causeShape = cause as { code?: string; message?: string } | undefined;
  console.error(`[safeLoad] ${context} failed`, {
    context,
    operation: isServiceError ? error.operation : null,
    errorName: error instanceof Error ? error.name : typeof error,
    errorMessage: error instanceof Error ? error.message : String(error),
    causeCode: causeShape?.code ?? null,
    causeMessage: causeShape?.message ?? null,
    stack: error instanceof Error ? error.stack : new Error().stack,
  });
}
