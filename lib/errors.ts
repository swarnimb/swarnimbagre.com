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
