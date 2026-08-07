/**
 * T47 — Playwright `globalSetup`.
 *
 * Only job: capture the builder's project ordering before the suite runs, so
 * `global-teardown.ts` can put it back. The T44.D reorder step rewrites
 * `sort_order` across every project row, including the real six, and there is
 * no staging database to absorb that (CONSTRAINT-02).
 *
 * Runs in plain Node. `playwright.config.ts` has already primed `process.env`
 * from `.env.local` by the time this executes, so the service-role key is
 * available without further plumbing.
 */

import { createServiceRoleClient } from './fixtures/cleanup';
import { snapshotProjectSortOrder } from './fixtures/sort-order-snapshot';

/**
 * Snapshot `projects.sort_order` to disk.
 *
 * A failure here aborts the run before any test writes to production, which is
 * the correct outcome: without the snapshot, teardown cannot restore ordering.
 */
export default async function globalSetup(): Promise<void> {
  const client = createServiceRoleClient();
  const captured = await snapshotProjectSortOrder(client);
  console.log(`[e2e setup] captured sort_order for ${captured} projects.`);
}
