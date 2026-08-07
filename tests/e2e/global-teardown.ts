/**
 * T47 — Playwright `globalTeardown`.
 *
 * Hygiene stopped being the spec's job. The suite writes to the PRODUCTION
 * database (CONSTRAINT-02: no staging project), and driving deletes through the
 * admin UI left live rows behind on runs that reported green. This teardown
 * talks to Postgres directly with the service role instead.
 *
 * Playwright runs `globalTeardown` after the last test regardless of whether
 * tests passed, which is the case that leaked before. It runs in plain Node, so
 * nothing here may import a module that reaches `next/headers`.
 *
 * A failure here fails the run. That is deliberate: silently leaving rows in
 * production while reporting success is the defect being fixed.
 */

import {
  assertNoTestArtifacts,
  createServiceRoleClient,
  sweepTestArtifacts,
} from './fixtures/cleanup';
import { restoreProjectSortOrder } from './fixtures/sort-order-snapshot';

/**
 * Sweep fixture rows and storage objects, restore project ordering, then
 * verify against a fresh read that nothing survived.
 */
export default async function globalTeardown(): Promise<void> {
  const client = createServiceRoleClient();

  const report = await sweepTestArtifacts(client);
  console.log(
    `[e2e teardown] removed projects=${report.projects} posts=${report.posts} ` +
      `stats=${report.stats} images=${report.images} storage=${report.storageObjects}.`,
  );

  const restored = await restoreProjectSortOrder(client);
  console.log(`[e2e teardown] restored sort_order on ${restored} projects.`);

  await assertNoTestArtifacts(client);
  console.log('[e2e teardown] verified: no test rows remain.');
}
