/**
 * Named error class for data-layer and service-layer failures.
 *
 * Always thrown with an `operation` string that identifies the failing call
 * site (e.g. `'getPublishedProjects'`). The original error is preserved via
 * the standard `cause` option so stack traces stay intact.
 */
export class ServiceError extends Error {
  /** Identifier of the operation that failed. Used in logs and assertions. */
  public readonly operation: string;

  /**
   * @param message  Short human-readable description of what failed.
   * @param options  Carries the originating `cause` and the `operation` name.
   */
  constructor(message: string, options: { cause?: unknown; operation: string }) {
    super(message, { cause: options.cause });
    this.name = 'ServiceError';
    this.operation = options.operation;
  }
}

/**
 * Named error thrown when input fails boundary validation (SEC-02, EH-05).
 *
 * Carries the field name so call sites can route a generic, user-facing
 * message without exposing the raw value (SEC-05, EH-04).
 */
export class ValidationError extends Error {
  /** Name of the field that failed validation. */
  public readonly field: string;

  /**
   * @param field  Identifier of the field that failed validation.
   * @param reason Short, internal-facing description of why it failed.
   */
  constructor(field: string, reason: string) {
    super(`Validation failed: ${field} — ${reason}`);
    this.name = 'ValidationError';
    this.field = field;
  }
}

/** Log-safe classifier shape — the error *kind*, never its message/cause. */
export interface LogSafeError {
  name: string;
  status?: number;
  code?: string;
}

/**
 * Reduce an arbitrary thrown value to a log-safe classifier shape (SEC-05).
 *
 * Keeps only the error *kind* — `name`, an HTTP-ish `status`, and a string
 * `code` — and deliberately drops `message`, `cause`, and any nested payload.
 * Supabase `AuthError.message` can echo the submitted email or rate-limit
 * detail, and SEC-05 forbids PII in logs without qualification. Spread the
 * result into a structured log line instead of a raw caught error. Closes
 * finding F-29 (docs/security-report.md audit 16).
 *
 * @param error Any caught value (`AuthError`, `ServiceError`, `Error`, or non-Error).
 * @returns A flat object safe to serialize into a log line.
 */
export function toLogSafeError(error: unknown): LogSafeError {
  if (error !== null && typeof error === 'object') {
    const e = error as { name?: unknown; status?: unknown; code?: unknown };
    return {
      name: typeof e.name === 'string' ? e.name : 'UnknownError',
      ...(typeof e.status === 'number' ? { status: e.status } : {}),
      ...(typeof e.code === 'string' ? { code: e.code } : {}),
    };
  }
  return { name: 'NonError' };
}
