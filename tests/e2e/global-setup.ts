/**
 * T47 — Playwright `globalSetup`.
 *
 * Two jobs:
 *
 * 1. Capture the builder's project ordering before the suite runs, so
 *    `global-teardown.ts` can put it back. The T44.D reorder step rewrites
 *    `sort_order` across every project row, including the real six, and there
 *    is no staging database to absorb that (CONSTRAINT-02).
 * 2. Pre-compile the routes the suite hits first, so no test pays Next dev's
 *    cold-compile cost inside its own step budget. See `fixtures/warm-routes`.
 *
 * Runs in plain Node. `playwright.config.ts` has already primed `process.env`
 * from `.env.local` by the time this executes, so the service-role key is
 * available without further plumbing.
 */

import type { FullConfig } from '@playwright/test';
import { createServiceRoleClient } from './fixtures/cleanup';
import { snapshotProjectSortOrder } from './fixtures/sort-order-snapshot';
import { warmRoutes } from './fixtures/warm-routes';

/**
 * Read the origin the suite points at out of the resolved config.
 *
 * Single source of truth is `use.baseURL` in `playwright.config.ts`; the port
 * is not restated here (CQ-04).
 */
function resolveBaseURL(config: FullConfig): string {
  const baseURL = config.projects[0]?.use.baseURL;
  if (!baseURL) {
    throw new Error('[e2e setup] no `use.baseURL` on the first Playwright project.');
  }
  return baseURL;
}

/**
 * Snapshot `projects.sort_order` to disk, then warm the routes.
 *
 * A snapshot failure aborts the run before any test writes to production,
 * which is the correct outcome: without the snapshot, teardown cannot restore
 * ordering. The snapshot runs first for that reason — an unreachable dev
 * server should not cost the run its safety net.
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  const client = createServiceRoleClient();
  const captured = await snapshotProjectSortOrder(client);
  console.log(`[e2e setup] captured sort_order for ${captured} projects.`);
  await warmRoutes(resolveBaseURL(config));
}
