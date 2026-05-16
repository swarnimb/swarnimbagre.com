/**
 * Shared structured-log helper for the admin mutation surfaces. Extracted
 * from the per-resource `-internal.ts` files under CQ-02 (services < 300
 * lines) — every resource trio had the same ~10-line copy of
 * `logMutationError` matching the shape of `logDbError` in `lib/db.ts`.
 *
 * The signature is deliberately permissive (`Record<string, unknown>`
 * payload) so callers can include resource-specific context — bucket
 * paths, compensating-delete results, orphan-side correlations — without
 * the helper needing per-resource overloads. The common keys
 * (`errorCode`, `errorMessage`) live in `logSupabaseError` below for the
 * common single-error case; the wider `logMutationError` is the escape
 * hatch.
 */

/**
 * Log a structured Supabase mutation failure without leaking row data or
 * PII (EH-02, EH-03, SEC-05). Matches the shape of `logDbError` in
 * `lib/db.ts` so logs are uniform across the data layer.
 *
 * @param operation Identifier of the failing call site (e.g.
 *                  `'createProject'`).
 * @param payload   Structured context. Common keys are `errorCode` and
 *                  `errorMessage`; resource-specific keys (bucketPath,
 *                  orphanOperation, etc.) are also accepted.
 */
export function logMutationError(
  operation: string,
  payload: Record<string, unknown>,
): void {
  console.error(`[admin-mutations] ${operation} failed`, {
    operation,
    ...payload,
    stack: new Error().stack,
  });
}

/**
 * Convenience wrapper for the common single-error case — every existing
 * call site in the project / post / stat trios passes a Supabase error
 * object directly. This wrapper preserves that ergonomic shape while
 * delegating to {@link logMutationError}.
 *
 * @param operation Identifier of the failing call site.
 * @param error     Supabase error object (or any object with `code` /
 *                  `message`). `null` is accepted for parity with the
 *                  previous per-resource implementations.
 */
export function logSupabaseError(
  operation: string,
  error: { code?: string; message?: string } | null,
): void {
  logMutationError(operation, {
    errorCode: error?.code ?? null,
    errorMessage: error?.message ?? null,
  });
}

/**
 * Log a structured Supabase read failure for the admin query surface
 * (`lib/admin-queries-*.ts`). Same payload shape as {@link logSupabaseError}
 * (EH-02, EH-03, SEC-05) but tagged `[admin-queries]` so log triage can
 * distinguish a read-path failure from a mutation-path failure. Centralised
 * here under CQ-07 — the admin query modules previously each carried a
 * byte-duplicate private copy.
 *
 * @param operation Identifier of the failing read call site (e.g.
 *                  `'getAllProjects'`).
 * @param error     Supabase error object (or any object with `code` /
 *                  `message`). `null` is accepted for parity with the
 *                  previous private implementation.
 */
export function logQueryError(
  operation: string,
  error: { code?: string; message?: string } | null,
): void {
  console.error(`[admin-queries] ${operation} failed`, {
    operation,
    errorCode: error?.code ?? null,
    errorMessage: error?.message ?? null,
    stack: new Error().stack,
  });
}
