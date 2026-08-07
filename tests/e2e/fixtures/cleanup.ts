/**
 * T47 — e2e teardown sweep.
 *
 * The Playwright suite writes to the PRODUCTION database: CONSTRAINT-02 means
 * there is no staging project, so every row `admin-smoke.spec.ts` creates is a
 * live row. Cleanup used to run through the admin UI and was unreliable — a
 * fully green run was observed leaving three projects behind, one of them
 * `published` and therefore rendering on `/projects`.
 *
 * This module replaces that with a direct service-role sweep. It runs in plain
 * Node from `global-teardown.ts`, so it must import nothing that reaches
 * `next/headers` — `lib/supabase.ts` does, and every `lib/` module that builds
 * on it is transitively disqualified. Hence the standalone client here, built
 * with `@supabase/supabase-js` the same way `scripts/seed-test-fixture.ts`
 * does it.
 *
 * Matching is on TITLE, not slug prefix. The fixtures carry three different
 * slug prefixes (`t28-`, `t42-`, `t43f-`), so a single slug sweep silently
 * misses rows. Titles are fetched in full and filtered in TypeScript rather
 * than through PostgREST `like` filters: the tables hold tens of rows, the
 * predicate is then unit-testable without a database, and there is no risk of
 * a mis-escaped filter string deleting something it shouldn't.
 *
 * F-50 hardening: the match rules and the row ceilings live in
 * `./cleanup-predicates`. Every candidate set is collected and gated BEFORE
 * the first delete, so a broken predicate stops the run instead of half of it.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { CleanupEnvError, CleanupIncompleteError, CleanupQueryError } from './cleanup-errors';
import {
  assertWithinCeiling,
  isSweepableImage,
  isTestStat,
  isTestTitle,
  type ImageParentIndex,
  type ImageRowRef,
} from './cleanup-predicates';

export { CleanupEnvError, CleanupIncompleteError, CleanupQueryError } from './cleanup-errors';

export {
  CleanupCeilingError,
  FIXTURE_IMAGE_FILENAMES,
  isFixtureImagePath,
  isSweepableImage,
  isTestStat,
  isTestTitle,
  ROWS_PER_RUN,
  RUN_ID_TOKEN_PATTERN,
  SWEEP_CEILINGS,
  SWEEP_DEBRIS_RUN_ALLOWANCE,
  TEST_TITLE_PREFIXES,
  assertWithinCeiling,
  type ImageParentIndex,
  type ImageRowRef,
  type SweepTable,
} from './cleanup-predicates';

/** Env var holding the Supabase project URL. Primed by `playwright.config.ts`. */
const ENV_SUPABASE_URL = 'NEXT_PUBLIC_SUPABASE_URL';

/** Env var holding the service-role key. Never hardcoded (SEC-01). */
const ENV_SERVICE_ROLE_KEY = 'SUPABASE_SERVICE_ROLE_KEY';

/** Storage bucket holding uploaded images (mirrors `IMAGES_BUCKET` in lib). */
const IMAGES_BUCKET = 'images';

/** Per-table counts of what the sweep removed. */
export interface CleanupReport {
  projects: number;
  posts: number;
  stats: number;
  images: number;
  storageObjects: number;
}

/** Every row the sweep intends to delete, collected before anything is. */
interface SweepCandidates {
  projectIds: string[];
  postIds: string[];
  statIds: string[];
  images: { id: string; bucket_path: string }[];
}

/**
 * Build a service-role Supabase client for teardown.
 *
 * Service role bypasses RLS, which the sweep needs — the admin policies are
 * session-scoped and teardown has no session.
 *
 * @throws CleanupEnvError when either required variable is absent.
 */
export function createServiceRoleClient(): SupabaseClient {
  const operation = 'createServiceRoleClient';
  const url = process.env[ENV_SUPABASE_URL];
  if (!url || url.trim().length === 0) {
    throw new CleanupEnvError(ENV_SUPABASE_URL, operation);
  }
  const serviceRoleKey = process.env[ENV_SERVICE_ROLE_KEY];
  if (!serviceRoleKey || serviceRoleKey.trim().length === 0) {
    throw new CleanupEnvError(ENV_SERVICE_ROLE_KEY, operation);
  }
  return createClient(url.trim(), serviceRoleKey.trim(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Read every row of `table`, or throw with context. */
async function selectAll<T>(
  client: SupabaseClient,
  table: string,
  columns: string,
  operation: string,
): Promise<T[]> {
  const { data, error } = await client.from(table).select(columns);
  if (error) {
    throw new CleanupQueryError({ operation, table, cause: error });
  }
  return (data ?? []) as T[];
}

/** Delete `ids` from `table` and return how many rows went. */
async function deleteByIds(
  client: SupabaseClient,
  table: string,
  ids: string[],
  operation: string,
): Promise<number> {
  if (ids.length === 0) return 0;
  const { data, error } = await client.from(table).delete().in('id', ids).select('id');
  if (error) {
    throw new CleanupQueryError({
      operation,
      table,
      cause: error,
      detail: `${ids.length} ids`,
    });
  }
  return (data ?? []).length;
}

/**
 * Ids of every project the suite created.
 *
 * @param client Service-role client.
 * @returns One `{ id }` per fixture project.
 */
export async function findTestProjectIds(client: SupabaseClient): Promise<{ id: string }[]> {
  const rows = await selectAll<{ id: string; title: string }>(
    client,
    'projects',
    'id, title',
    'findTestProjectIds',
  );
  return rows.filter((row) => isTestTitle(row.title)).map((row) => ({ id: row.id }));
}

/**
 * Read all four tables and work out what the sweep would delete.
 *
 * The full project and post id sets are read here, once, so the image decision
 * can ask "does this row's parent still exist?" without a query per row.
 */
async function collectSweepCandidates(
  client: SupabaseClient,
  operation: string,
): Promise<SweepCandidates> {
  const projectRows = await selectAll<{ id: string; title: string }>(client, 'projects', 'id, title', operation);
  const postRows = await selectAll<{ id: string; title: string }>(client, 'posts', 'id, title', operation);
  const statRows = await selectAll<{ id: string; category: string; label: string }>(
    client,
    'stats',
    'id, category, label',
    operation,
  );
  const imageRows = await selectAll<ImageRowRef & { id: string }>(
    client,
    'images',
    'id, bucket_path, parent_id, parent_type',
    operation,
  );

  const projectIds = projectRows.filter((row) => isTestTitle(row.title)).map((row) => row.id);
  const postIds = postRows.filter((row) => isTestTitle(row.title)).map((row) => row.id);
  const index: ImageParentIndex = {
    sweptParentIds: new Set([...projectIds, ...postIds]),
    liveProjectIds: new Set(projectRows.map((row) => row.id)),
    livePostIds: new Set(postRows.map((row) => row.id)),
  };

  return {
    projectIds,
    postIds,
    statIds: statRows.filter(isTestStat).map((row) => row.id),
    images: imageRows
      .filter((row) => isSweepableImage(row, index))
      .map((row) => ({ id: row.id, bucket_path: row.bucket_path })),
  };
}

/**
 * Remove storage objects by their stored `bucket_path` values.
 *
 * Runs BEFORE the matching `images` rows are deleted, deliberately inverting
 * the order `lib/admin-images-cleanup.ts` uses. If storage removal fails there,
 * the rows are already gone and the objects are unrecoverable from the app. Here
 * a failure leaves the rows in place, so the next run retries them.
 */
async function removeStorageObjects(client: SupabaseClient, paths: string[]): Promise<number> {
  if (paths.length === 0) return 0;
  const { error } = await client.storage.from(IMAGES_BUCKET).remove(paths);
  if (error) {
    throw new CleanupQueryError({
      operation: 'removeStorageObjects',
      table: `storage:${IMAGES_BUCKET}`,
      cause: error,
      detail: `${paths.length} objects`,
    });
  }
  return paths.length;
}

/**
 * Delete every fixture row, in FK-safe order.
 *
 * `projects` goes first: that cascades `project_media` (`010_project_media.sql`,
 * `on delete cascade`), which releases the `on delete restrict` those rows hold
 * on `images`. Image rows are collected before the delete, because a project
 * delete only nulls `projects.image_id` — the image rows survive with a stale
 * `parent_id` and nothing else would ever find them.
 *
 * Every ceiling is checked before the first delete. A partial sweep that dies
 * halfway is harder to reason about than one that never started.
 *
 * @param client Service-role client.
 * @returns Per-table counts of what was removed.
 * @throws CleanupCeilingError when any candidate set is implausibly large.
 */
export async function sweepTestArtifacts(client: SupabaseClient): Promise<CleanupReport> {
  const operation = 'sweepTestArtifacts';
  const candidates = await collectSweepCandidates(client, operation);

  assertWithinCeiling('projects', candidates.projectIds.length);
  assertWithinCeiling('posts', candidates.postIds.length);
  assertWithinCeiling('stats', candidates.statIds.length);
  assertWithinCeiling('images', candidates.images.length);

  const projects = await deleteByIds(client, 'projects', candidates.projectIds, `${operation}:projects`);
  const storageObjects = await removeStorageObjects(
    client,
    candidates.images.map((row) => row.bucket_path),
  );
  const images = await deleteByIds(
    client,
    'images',
    candidates.images.map((row) => row.id),
    `${operation}:images`,
  );
  const posts = await deleteByIds(client, 'posts', candidates.postIds, `${operation}:posts`);
  const stats = await deleteByIds(client, 'stats', candidates.statIds, `${operation}:stats`);

  return { projects, posts, stats, images, storageObjects };
}

/**
 * Re-query the database and fail loudly if any fixture row survived.
 *
 * The sweep reporting success is not evidence it worked — that is precisely
 * the defect this task exists to fix — so the run is gated on a fresh read.
 * It re-uses the sweep's own candidate collection: an assertion with a looser
 * predicate than the sweep would fail the run over rows the sweep is not
 * allowed to touch.
 *
 * @throws CleanupIncompleteError when anything remains.
 */
export async function assertNoTestArtifacts(client: SupabaseClient): Promise<void> {
  const remaining = await collectSweepCandidates(client, 'assertNoTestArtifacts');
  const survivors = {
    projects: remaining.projectIds.length,
    posts: remaining.postIds.length,
    stats: remaining.statIds.length,
    images: remaining.images.length,
  };

  if (Object.values(survivors).some((count) => count > 0)) {
    throw new CleanupIncompleteError(survivors);
  }
}
