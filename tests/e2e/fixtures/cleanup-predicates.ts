/**
 * T47 / F-50 — the predicates and ceilings behind the e2e teardown sweep.
 *
 * Split out of `cleanup.ts` so that file stays under the 300-line limit
 * (CQ-02) after F-50 tightened the matching rules. Nothing here touches the
 * network: every function is pure, so `tests/e2e-cleanup.test.ts` can prove
 * the sweep never matches the builder's real rows without a database (TS-03).
 *
 * F-50 context: the sweep runs with a service-role key against the PRODUCTION
 * database (CONSTRAINT-02 — there is no staging project), unattended, on every
 * `npm run test:e2e`. Before F-50 the only thing separating a fixture row from
 * the builder's real work was a title prefix and a filename suffix, both of
 * which a real project can collide with by accident. These predicates now
 * require a marker the builder cannot produce by hand.
 */

/**
 * Title prefixes used by every row `admin-smoke.spec.ts` creates. Necessary
 * but no longer sufficient — see `RUN_ID_TOKEN_PATTERN`.
 */
export const TEST_TITLE_PREFIXES: readonly string[] = ['T28 ', 'T42 ', 'T43F '];

/**
 * The run marker every fixture row embeds: `admin-smoke.spec.ts` builds
 * `RUN_ID = t28-${Date.now()}` and interpolates it into every title, label and
 * stat category it writes. `Date.now()` is 13 digits and will not drop below
 * 10 until the year 2286, so 10 is a floor that cannot be reached by a human
 * typing a version number or a date.
 *
 * This is the guard F-50 exists to add. A prefix match alone means a real
 * project the builder titles `T28 Redesign` is one keystroke away from being
 * deleted from production by an unattended test run; requiring the token makes
 * that impossible while still matching debris from any earlier crashed run,
 * because those rows carry their own run's token. Self-healing is preserved.
 *
 * The pattern is unanchored on purpose: the XSS step appends a payload after
 * the run id, so the token sits mid-string on some fixture titles.
 */
export const RUN_ID_TOKEN_PATTERN = /t28-\d{10,}/;

/**
 * Filenames the suite uploads. `images` rows carry no title and no run marker,
 * and `images.parent_id` has no FK (polymorphic, `001_create_schema.sql`), so
 * rows from crashed runs dangle rather than cascade. The uploaded filename is
 * the only durable marker they carry — which is why the filename alone is not
 * enough to authorise a delete (see `isSweepableImage`).
 */
export const FIXTURE_IMAGE_FILENAMES: readonly string[] = [
  't28-first.png',
  't43f-single.png',
  't43f-before.png',
  't43f-after.png',
];

/** Category prefix the stats fixture writes (`t28-${RUN_ID}`). */
const TEST_STAT_CATEGORY_PREFIX = 't28-';

/** Tables the sweep deletes from. Keys the ceiling table. */
export type SweepTable = 'projects' | 'posts' | 'stats' | 'images';

/**
 * Rows one complete, successful Playwright run creates. Counted off
 * `admin-smoke.spec.ts`: four projects (`T28 project`, `T28 image project`,
 * `T42 e2e project`, `T43F media project` — the edit step renames the first
 * rather than adding a fifth), one post, one stat, and four image uploads
 * (`t28-first`, `t43f-single`, `t43f-before`, `t43f-after`).
 */
export const ROWS_PER_RUN: Readonly<Record<SweepTable, number>> = {
  projects: 4,
  posts: 1,
  stats: 1,
  images: 4,
};

/**
 * How many runs' worth of debris the sweep will absorb in one pass.
 *
 * Six, not one: the sweep is deliberately self-healing, and a crashed run
 * leaves its rows for the next run to collect. The worst real pass observed so
 * far cleared 7 projects and 8 images — under two runs' worth — so six leaves
 * roughly 3x headroom over anything actually seen while still bounding the
 * blast radius.
 */
export const SWEEP_DEBRIS_RUN_ALLOWANCE = 6;

/**
 * Maximum candidate rows per table the sweep will delete in one pass.
 *
 * This is a backstop, not the safety mechanism. At the current size of the
 * database a ceiling cannot catch a single mis-titled real project — that is
 * what `isTestTitle` and `isSweepableImage` are for. What it does catch is a
 * predicate that has come loose and started matching broadly, before the
 * damage scales with the content the builder adds over time.
 */
export const SWEEP_CEILINGS: Readonly<Record<SweepTable, number>> = {
  projects: ROWS_PER_RUN.projects * SWEEP_DEBRIS_RUN_ALLOWANCE,
  posts: ROWS_PER_RUN.posts * SWEEP_DEBRIS_RUN_ALLOWANCE,
  stats: ROWS_PER_RUN.stats * SWEEP_DEBRIS_RUN_ALLOWANCE,
  images: ROWS_PER_RUN.images * SWEEP_DEBRIS_RUN_ALLOWANCE,
};

/** Named error for a candidate set that blew through its ceiling (EH-05). */
export class CleanupCeilingError extends Error {
  public readonly table: SweepTable;
  public readonly count: number;
  public readonly ceiling: number;

  constructor(table: SweepTable, count: number, ceiling: number) {
    super(
      `e2e teardown refused to delete: the candidate set for ${table} is far ` +
        `larger than any run can legitimately produce, which means a match ` +
        `predicate is wrong and these rows may be real. Nothing was deleted ` +
        `and nothing was truncated. Inspect the rows by hand. ` +
        `table=${table} candidates=${count} ceiling=${ceiling}`,
    );
    this.name = 'CleanupCeilingError';
    this.table = table;
    this.count = count;
    this.ceiling = ceiling;
  }
}

/**
 * Gate a candidate set on its ceiling.
 *
 * Deliberately throws rather than truncating: a truncated delete is still a
 * delete of rows nobody checked, and it would hide the broken predicate.
 *
 * @throws CleanupCeilingError when `count` exceeds the table's ceiling.
 */
export function assertWithinCeiling(table: SweepTable, count: number): void {
  const ceiling = SWEEP_CEILINGS[table];
  if (count > ceiling) {
    throw new CleanupCeilingError(table, count, ceiling);
  }
}

/**
 * True when `title` was written by the e2e suite rather than by the builder.
 *
 * Both halves must hold: the fixture prefix AND the run-id token. The prefix
 * alone is a naming convention the builder can walk into; the token is machine
 * -generated and effectively unforgeable by hand.
 */
export function isTestTitle(title: string): boolean {
  const hasPrefix = TEST_TITLE_PREFIXES.some((prefix) => title.startsWith(prefix));
  return hasPrefix && RUN_ID_TOKEN_PATTERN.test(title);
}

/**
 * True when `bucketPath` points at a suite-uploaded fixture image.
 *
 * Paths follow CONSTRAINT-07: `images/{parentType}/{parentId}/{uuid}_{name}`.
 * The leading underscore is part of the match so a real upload that merely
 * ends with the same word cannot be swept.
 *
 * Filename evidence only. Use `isSweepableImage` to decide a delete.
 */
export function isFixtureImagePath(bucketPath: string): boolean {
  return FIXTURE_IMAGE_FILENAMES.some((name) => bucketPath.endsWith(`_${name}`));
}

/** True when a stats row was written by the suite. */
export function isTestStat(row: { category: string; label: string }): boolean {
  const categoryMatches =
    row.category.startsWith(TEST_STAT_CATEGORY_PREFIX) && RUN_ID_TOKEN_PATTERN.test(row.category);
  return categoryMatches || isTestTitle(row.label);
}

/** An `images` row, reduced to what the sweep decision needs. */
export interface ImageRowRef {
  bucket_path: string;
  parent_id: string | null;
  parent_type: string | null;
}

/** Id sets the image decision is made against, read once per sweep. */
export interface ImageParentIndex {
  /** Fixture projects and posts being deleted in this same pass. */
  readonly sweptParentIds: ReadonlySet<string>;
  /** Every id currently in `projects`. */
  readonly liveProjectIds: ReadonlySet<string>;
  /** Every id currently in `posts`. */
  readonly livePostIds: ReadonlySet<string>;
}

/**
 * True when `row`'s parent row still exists.
 *
 * `parent_type` is polymorphic over `projects` and `posts`. When it is null
 * but `parent_id` is not — a shape the app never writes, since orphaning nulls
 * both — both tables are consulted, because treating an unknown parent as
 * missing would authorise a delete on the weaker evidence.
 */
function hasLiveParent(parentId: string, parentType: string | null, index: ImageParentIndex): boolean {
  if (parentType === 'posts') return index.livePostIds.has(parentId);
  if (parentType === 'projects') return index.liveProjectIds.has(parentId);
  return index.liveProjectIds.has(parentId) || index.livePostIds.has(parentId);
}

/**
 * True when an image row may be deleted from PRODUCTION.
 *
 * Fixture filename AND an unreachable parent. A real image belongs to a live
 * real project or post, so its parent exists and is not in the swept set —
 * which means a real file the builder happens to name `hero_t28-first.png`
 * survives, where before F-50 it did not.
 *
 * The "parent is gone" arm is what keeps the sweep self-healing: rows from
 * crashed runs keep a stale `parent_id` pointing at a project that has already
 * been deleted, and `lib/admin-images-cleanup.ts` cannot see them because its
 * orphan predicate is `parent_id IS NULL AND parent_type IS NULL`.
 */
export function isSweepableImage(row: ImageRowRef, index: ImageParentIndex): boolean {
  if (!isFixtureImagePath(row.bucket_path)) return false;
  if (row.parent_id === null) return true;
  if (index.sweptParentIds.has(row.parent_id)) return true;
  return !hasLiveParent(row.parent_id, row.parent_type, index);
}
