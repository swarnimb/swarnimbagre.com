/**
 * T47 — named error classes for the e2e teardown sweep (EH-05).
 *
 * Split out of `cleanup.ts` so that file stays under the 300-line limit
 * (CQ-02) after F-50. Re-exported from `cleanup.ts`, so import sites do not
 * need to know they moved.
 *
 * `CleanupCeilingError` deliberately lives in `cleanup-predicates.ts` instead:
 * it is meaningless without the ceiling table it reports against, and keeping
 * them together avoids an import cycle over `SweepTable`.
 */

/** Named error for a missing runner environment variable (EH-05). */
export class CleanupEnvError extends Error {
  public readonly operation: string;

  constructor(variableName: string, operation: string) {
    super(
      `${variableName} is not set in the Playwright runner environment. ` +
        `Set it in .env.local; playwright.config.ts loads that file at config ` +
        `load, so teardown inherits it. operation=${operation}`,
    );
    this.name = 'CleanupEnvError';
    this.operation = operation;
  }
}

/** Named error for a failed Supabase call during the sweep (EH-05, EH-02). */
export class CleanupQueryError extends Error {
  public readonly operation: string;
  public readonly table: string;

  constructor(options: { operation: string; table: string; cause: unknown; detail?: string }) {
    super(
      `e2e teardown failed. operation=${options.operation} table=${options.table} ` +
        `detail=${options.detail ?? 'none'} cause=${String(
          (options.cause as { message?: string } | null)?.message ?? options.cause,
        )}`,
      { cause: options.cause },
    );
    this.name = 'CleanupQueryError';
    this.operation = options.operation;
    this.table = options.table;
  }
}

/** Named error for test rows that survived the sweep (EH-05). */
export class CleanupIncompleteError extends Error {
  public readonly survivors: Record<string, number>;

  constructor(survivors: Record<string, number>) {
    const detail = Object.entries(survivors)
      .map(([table, count]) => `${table}=${count}`)
      .join(' ');
    super(
      `e2e teardown left test rows in the PRODUCTION database. ` +
        `Reporting success while leaving rows behind is the defect T47 exists ` +
        `to fix, so this fails the run. survivors: ${detail}`,
    );
    this.name = 'CleanupIncompleteError';
    this.survivors = survivors;
  }
}
