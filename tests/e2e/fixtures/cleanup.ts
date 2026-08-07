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
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** Env var holding the Supabase project URL. Primed by `playwright.config.ts`. */
const ENV_SUPABASE_URL = 'NEXT_PUBLIC_SUPABASE_URL';

/** Env var holding the service-role key. Never hardcoded (SEC-01). */
const ENV_SERVICE_ROLE_KEY = 'SUPABASE_SERVICE_ROLE_KEY';

/** Storage bucket holding uploaded images (mirrors `IMAGES_BUCKET` in lib). */
const IMAGES_BUCKET = 'images';

/**
 * Title prefixes used by every row `admin-smoke.spec.ts` creates. Each test
 * title is `<prefix><description> <RUN_ID>`, so the prefix alone identifies a
 * fixture row without depending on the run that produced it — that is what
 * makes the sweep self-healing across earlier crashed runs.
 */
export const TEST_TITLE_PREFIXES: readonly string[] = ['T28 ', 'T42 ', 'T43F '];

/**
 * Filenames the suite uploads. `images` rows carry no title and no run marker,
 * and `images.parent_id` has no FK (polymorphic, `001_create_schema.sql`), so
 * rows from crashed runs dangle rather than cascade. The uploaded filename is
 * the only durable marker they carry.
 */
export const FIXTURE_IMAGE_FILENAMES: readonly string[] = [
  't28-first.png',
  't43f-single.png',
  't43f-before.png',
  't43f-after.png',
];

/** Category prefix the stats fixture writes (`t28-${RUN_ID}`). */
const TEST_STAT_CATEGORY_PREFIX = 't28-';

/** Per-table counts of what the sweep removed. */
export interface CleanupReport {
  projects: number;
  posts: number;
  stats: number;
  images: number;
  storageObjects: number;
}

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

/** True when `title` was written by the e2e suite rather than by the builder. */
export function isTestTitle(title: string): boolean {
  return TEST_TITLE_PREFIXES.some((prefix) => title.startsWith(prefix));
}

/**
 * True when `bucketPath` points at a suite-uploaded fixture image.
 *
 * Paths follow CONSTRAINT-07: `images/{parentType}/{parentId}/{uuid}_{name}`.
 * The leading underscore is part of the match so a real upload that merely
 * ends with the same word cannot be swept.
 */
export function isFixtureImagePath(bucketPath: string): boolean {
  return FIXTURE_IMAGE_FILENAMES.some((name) => bucketPath.endsWith(`_${name}`));
}

/** True when a stats row was written by the suite. */
export function isTestStat(row: { category: string; label: string }): boolean {
  return row.category.startsWith(TEST_STAT_CATEGORY_PREFIX) || isTestTitle(row.label);
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
 * Image rows to sweep: those parented to a fixture project, plus every row
 * whose bucket path is a fixture upload. The second set absorbs debris from
 * earlier crashed runs, which `lib/admin-images-cleanup.ts` cannot see — its
 * predicate is `parent_id IS NULL AND parent_type IS NULL` with a seven-day
 * grace period, and these rows carry a stale non-null `parent_id`.
 */
async function collectTestImages(
  client: SupabaseClient,
  projectIds: string[],
): Promise<{ id: string; bucket_path: string }[]> {
  const rows = await selectAll<{ id: string; bucket_path: string; parent_id: string | null }>(
    client,
    'images',
    'id, bucket_path, parent_id',
    'collectTestImages',
  );
  const parented = new Set(projectIds);
  return rows
    .filter((row) => isFixtureImagePath(row.bucket_path) || (row.parent_id !== null && parented.has(row.parent_id)))
    .map((row) => ({ id: row.id, bucket_path: row.bucket_path }));
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
 * @param client Service-role client.
 * @returns Per-table counts of what was removed.
 */
export async function sweepTestArtifacts(client: SupabaseClient): Promise<CleanupReport> {
  const projectIds = (await findTestProjectIds(client)).map((row) => row.id);
  const images = await collectTestImages(client, projectIds);

  const projects = await deleteByIds(client, 'projects', projectIds, 'sweepTestArtifacts:projects');
  const storageObjects = await removeStorageObjects(client, images.map((row) => row.bucket_path));
  const imageRows = await deleteByIds(
    client,
    'images',
    images.map((row) => row.id),
    'sweepTestArtifacts:images',
  );

  const postRows = await selectAll<{ id: string; title: string }>(client, 'posts', 'id, title', 'sweepTestArtifacts:posts');
  const posts = await deleteByIds(
    client,
    'posts',
    postRows.filter((row) => isTestTitle(row.title)).map((row) => row.id),
    'sweepTestArtifacts:posts',
  );

  const statRows = await selectAll<{ id: string; category: string; label: string }>(
    client,
    'stats',
    'id, category, label',
    'sweepTestArtifacts:stats',
  );
  const stats = await deleteByIds(
    client,
    'stats',
    statRows.filter(isTestStat).map((row) => row.id),
    'sweepTestArtifacts:stats',
  );

  return { projects, posts, stats, images: imageRows, storageObjects };
}

/**
 * Re-query the database and fail loudly if any fixture row survived.
 *
 * The sweep reporting success is not evidence it worked — that is precisely
 * the defect this task exists to fix — so the run is gated on a fresh read.
 *
 * @throws CleanupIncompleteError when anything remains.
 */
export async function assertNoTestArtifacts(client: SupabaseClient): Promise<void> {
  const operation = 'assertNoTestArtifacts';
  const projects = (await findTestProjectIds(client)).length;
  const posts = (
    await selectAll<{ title: string }>(client, 'posts', 'title', operation)
  ).filter((row) => isTestTitle(row.title)).length;
  const stats = (
    await selectAll<{ category: string; label: string }>(client, 'stats', 'category, label', operation)
  ).filter(isTestStat).length;
  const images = (
    await selectAll<{ bucket_path: string }>(client, 'images', 'bucket_path', operation)
  ).filter((row) => isFixtureImagePath(row.bucket_path)).length;

  const survivors = { projects, posts, stats, images };
  if (projects + posts + stats + images > 0) {
    throw new CleanupIncompleteError(survivors);
  }
}
