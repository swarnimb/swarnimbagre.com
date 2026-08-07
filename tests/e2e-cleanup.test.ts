import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isTestTitle,
  isFixtureImagePath,
  isSweepableImage,
  isTestStat,
  assertWithinCeiling,
  createServiceRoleClient,
  CleanupCeilingError,
  CleanupEnvError,
  CleanupIncompleteError,
  TEST_TITLE_PREFIXES,
  FIXTURE_IMAGE_FILENAMES,
  ROWS_PER_RUN,
  SWEEP_CEILINGS,
  SWEEP_DEBRIS_RUN_ALLOWANCE,
  type ImageParentIndex,
} from '@/tests/e2e/fixtures/cleanup';

/**
 * T47: the predicates behind the e2e teardown sweep. The sweep runs with a
 * service-role key against the PRODUCTION database (CONSTRAINT-02 — there is
 * no staging project), so these three functions are the only thing standing
 * between a test run and the builder's real content. They were written as pure
 * functions precisely so this file can prove they never match real rows
 * without touching a database (TS-03).
 *
 * The negative cases matter more than the positive ones here. A false negative
 * leaves a stray fixture row on `/projects`; a false positive deletes a real
 * project.
 */

/** Every project and post title the builder actually has, verbatim. */
const REAL_TITLES: string[] = [
  'AmIBroke',
  'CardMaxxer',
  'Claude Code Magic',
  'ParSaveables',
  'SalesRep CRM',
  'swarnimbagre.com',
  'A project in under 8 hours',
  'Prompt → context → harness → ?',
  'The first build: how it felt when a free-tier tool delete my project',
  'Trying to go beyond vibe-coding simple apps',
];

/** The builder's real stats rows, verbatim. */
const REAL_STATS = [
  { category: 'tennis', label: 'of tennis this year' },
  { category: 'disc golf', label: 'of disc golf this year' },
  { category: 'volleyball', label: 'of volleyball this year' },
  { category: 'drums', label: 'spent learning to play drums' },
];

describe('isTestTitle', () => {
  // These are the literal title shapes `admin-smoke.spec.ts` writes: three
  // different slug prefixes across projects, posts and edited rows. A sweep
  // keyed on slug misses some of them, which is why the predicate is on title.
  it('matches every title shape the e2e suite creates', () => {
    const fixtureTitles = [
      'T28 project t28-1754521234567',
      'T28 project edited t28-1754521234567',
      'T28 image project t28-1754521234567',
      'T42 e2e project t28-1754521234567',
      'T43F media project t28-1754521234567',
      'T28 post t28-1754521234567',
    ];

    for (const title of fixtureTitles) {
      expect(isTestTitle(title)).toBe(true);
    }
  });

  // THE SAFETY TEST. If this ever fails, the teardown sweep deletes the
  // builder's real work from production. Nothing else in the suite catches it.
  it('rejects every one of the real project and post titles', () => {
    for (const title of REAL_TITLES) {
      expect(isTestTitle(title)).toBe(false);
    }
  });

  // The trailing space in each prefix is load-bearing: without it `T28X` and
  // any future `T280`-style marker would match.
  it('rejects a lookalike prefix that is not followed by a space', () => {
    expect(isTestTitle('T28X project')).toBe(false);
    expect(isTestTitle('T43FX media project')).toBe(false);
  });

  // Matching is anchored at the start. A real post that merely mentions a task
  // id somewhere in its title is not a fixture row.
  it('rejects a title that contains a prefix mid-string rather than at the start', () => {
    expect(isTestTitle('Notes on T28 project cleanup')).toBe(false);
    expect(isTestTitle('What T42 taught me')).toBe(false);
  });

  // F-50, THE FIX. The builder is about to add real project rows, and a task
  // id in a real title is not far-fetched — the whole site is built out of
  // numbered tasks. Before F-50 this title matched on the prefix alone and an
  // unattended `npm run test:e2e` would have deleted the row from production.
  // A prefix is a naming convention; the run-id token is machine-generated.
  it('rejects a real title that carries a fixture prefix but no run-id token', () => {
    expect(isTestTitle('T28 Redesign')).toBe(false);
    expect(isTestTitle('T42 retro')).toBe(false);
    expect(isTestTitle('T43F rollout notes')).toBe(false);
  });

  // A version-like number is not a run id. `Date.now()` has been 13 digits
  // since 2001 and stays that way until 2286, so anything shorter is a human.
  it('rejects a prefixed title whose t28- number is too short to be a timestamp', () => {
    expect(isTestTitle('T28 project t28-2026')).toBe(false);
    expect(isTestTitle('T28 project t28-123456789')).toBe(false);
    expect(isTestTitle('T28 project t28-1234567890')).toBe(true);
  });

  // The token requirement must not break self-healing: debris from a run that
  // crashed months ago still carries that run's token, so it still matches.
  it('accepts fixture rows left behind by an earlier crashed run', () => {
    expect(isTestTitle('T28 project t28-1700000000000')).toBe(true);
    expect(isTestTitle('T43F media project t28-1699999999999')).toBe(true);
  });

  // The XSS step appends its payload after the run id, so the token is not at
  // the end of the string. The match is unanchored for exactly this row.
  it('accepts the xss step title, where the run id sits mid-string', () => {
    expect(isTestTitle('T28 project t28-1754521234567 <script>alert(1)</script>')).toBe(true);
  });

  it('exposes the prefixes it matches on', () => {
    expect(TEST_TITLE_PREFIXES).toEqual(['T28 ', 'T42 ', 'T43F ']);
  });
});

describe('isFixtureImagePath', () => {
  // Real observed bucket paths, in the CONSTRAINT-07 shape
  // `images/{parentType}/{parentId}/{uuid}_{name}`.
  it('matches the bucket paths the suite uploads', () => {
    const uploaded = [
      'images/projects/47323482-8612-4935-8546-215d2fa53fc1/2f1dad51-9dad-4185-aea3-15885a9bbfd0_t28-first.png',
      'images/projects/47323482-8612-4935-8546-215d2fa53fc1/2f1dad51-9dad-4185-aea3-15885a9bbfd0_t43f-single.png',
      'images/projects/47323482-8612-4935-8546-215d2fa53fc1/2f1dad51-9dad-4185-aea3-15885a9bbfd0_t43f-before.png',
      'images/projects/47323482-8612-4935-8546-215d2fa53fc1/2f1dad51-9dad-4185-aea3-15885a9bbfd0_t43f-after.png',
    ];

    for (const path of uploaded) {
      expect(isFixtureImagePath(path)).toBe(true);
    }
  });

  it('rejects a plausible real upload path', () => {
    expect(
      isFixtureImagePath(
        'images/projects/47323482-8612-4935-8546-215d2fa53fc1/2f1dad51-9dad-4185-aea3-15885a9bbfd0_hero-shot.png',
      ),
    ).toBe(false);
  });

  // The underscore separator is the guard against sweeping real content: it is
  // the boundary the uploader puts between the generated uuid and the original
  // filename. Without it in the match, a real file the builder happened to name
  // `something-t28-first.png` would be deleted from production storage.
  it('rejects a path ending in a fixture name without the underscore separator', () => {
    expect(
      isFixtureImagePath(
        'images/projects/47323482-8612-4935-8546-215d2fa53fc1/2f1dad51-9dad-4185-aea3-15885a9bbfd0-t28-first.png',
      ),
    ).toBe(false);
  });

  it('exposes the fixture filenames it matches on', () => {
    expect(FIXTURE_IMAGE_FILENAMES).toEqual([
      't28-first.png',
      't43f-single.png',
      't43f-before.png',
      't43f-after.png',
    ]);
  });
});

describe('isSweepableImage', () => {
  // Ids stand in for real rows. `TEST_PROJECT_ID` is a fixture project being
  // deleted in this same pass; `REAL_PROJECT_ID` and `REAL_POST_ID` are the
  // builder's live content; `DEAD_PROJECT_ID` is a project that no longer
  // exists, which is what debris from a crashed run points at.
  const TEST_PROJECT_ID = '11111111-1111-4111-8111-111111111111';
  const REAL_PROJECT_ID = '22222222-2222-4222-8222-222222222222';
  const REAL_POST_ID = '33333333-3333-4333-8333-333333333333';
  const DEAD_PROJECT_ID = '44444444-4444-4444-8444-444444444444';

  const index: ImageParentIndex = {
    sweptParentIds: new Set([TEST_PROJECT_ID]),
    liveProjectIds: new Set([TEST_PROJECT_ID, REAL_PROJECT_ID]),
    livePostIds: new Set([REAL_POST_ID]),
  };

  /** Bucket path in the CONSTRAINT-07 shape, ending in `_{filename}`. */
  const pathFor = (parentId: string, filename: string): string =>
    `images/projects/${parentId}/2f1dad51-9dad-4185-aea3-15885a9bbfd0_${filename}`;

  it('sweeps a fixture upload parented to a fixture project going in this pass', () => {
    expect(
      isSweepableImage(
        {
          bucket_path: pathFor(TEST_PROJECT_ID, 't28-first.png'),
          parent_id: TEST_PROJECT_ID,
          parent_type: 'projects',
        },
        index,
      ),
    ).toBe(true);
  });

  // F-50, THE FIX. The builder is about to upload real project images for the
  // first time. A real file named `t28-first.png` used to be swept on filename
  // alone; now the parent has to be unreachable, and a live real project is
  // not. This is the case that made the finding non-theoretical.
  it('refuses a fixture-looking path whose parent is a live real project', () => {
    expect(
      isSweepableImage(
        {
          bucket_path: pathFor(REAL_PROJECT_ID, 't28-first.png'),
          parent_id: REAL_PROJECT_ID,
          parent_type: 'projects',
        },
        index,
      ),
    ).toBe(false);
  });

  // `images.parent_type` is polymorphic over projects and posts, so the live
  // check has to consult the right table. Checking only projects would treat
  // every real post image as an orphan and delete it.
  it('refuses a fixture-looking path whose parent is a live real post', () => {
    expect(
      isSweepableImage(
        {
          bucket_path: `images/posts/${REAL_POST_ID}/2f1dad51-9dad-4185-aea3-15885a9bbfd0_t43f-single.png`,
          parent_id: REAL_POST_ID,
          parent_type: 'posts',
        },
        index,
      ),
    ).toBe(false);
  });

  // Self-healing. `images.parent_id` has no FK, so when an earlier run crashed
  // after its project was deleted the image row survived pointing at nothing.
  // Nothing else in the codebase can see these rows.
  it('sweeps a fixture upload whose parent project no longer exists', () => {
    expect(
      isSweepableImage(
        {
          bucket_path: pathFor(DEAD_PROJECT_ID, 't43f-before.png'),
          parent_id: DEAD_PROJECT_ID,
          parent_type: 'projects',
        },
        index,
      ),
    ).toBe(true);
  });

  it('sweeps a fixture upload that was already orphaned to a null parent', () => {
    expect(
      isSweepableImage(
        { bucket_path: pathFor(DEAD_PROJECT_ID, 't43f-after.png'), parent_id: null, parent_type: null },
        index,
      ),
    ).toBe(true);
  });

  // When `parent_type` is null but `parent_id` is not — a shape the app never
  // writes — both tables are consulted. An unknown parent must not be enough
  // evidence to delete.
  it('refuses a row with a null parent_type whose id still exists as a post', () => {
    expect(
      isSweepableImage(
        { bucket_path: pathFor(REAL_POST_ID, 't28-first.png'), parent_id: REAL_POST_ID, parent_type: null },
        index,
      ),
    ).toBe(false);
  });

  // The filename is still a precondition. Being parented to a fixture project
  // no longer authorises a delete on its own.
  it('refuses a non-fixture filename even under a fixture project', () => {
    expect(
      isSweepableImage(
        {
          bucket_path: pathFor(TEST_PROJECT_ID, 'hero-shot.png'),
          parent_id: TEST_PROJECT_ID,
          parent_type: 'projects',
        },
        index,
      ),
    ).toBe(false);
  });
});

describe('sweep ceilings', () => {
  // The ceiling is a backstop behind the predicates, not a replacement for
  // them: one mis-titled real project is one extra row and no plausible
  // ceiling catches it. What it catches is a predicate that has come loose.
  it('derives each ceiling from one run of rows times the debris allowance', () => {
    expect(SWEEP_DEBRIS_RUN_ALLOWANCE).toBe(6);
    expect(ROWS_PER_RUN).toEqual({ projects: 4, posts: 1, stats: 1, images: 4 });
    expect(SWEEP_CEILINGS).toEqual({ projects: 24, posts: 6, stats: 6, images: 24 });
  });

  // The worst real pass observed cleared 7 projects and 8 images in one go.
  // If the ceiling tripped on that, self-healing would be dead on arrival.
  it('does not throw for the largest sweep actually observed', () => {
    expect(() => assertWithinCeiling('projects', 7)).not.toThrow();
    expect(() => assertWithinCeiling('images', 8)).not.toThrow();
  });

  it('does not throw at exactly the ceiling', () => {
    expect(() => assertWithinCeiling('projects', SWEEP_CEILINGS.projects)).not.toThrow();
    expect(() => assertWithinCeiling('images', SWEEP_CEILINGS.images)).not.toThrow();
    expect(() => assertWithinCeiling('posts', SWEEP_CEILINGS.posts)).not.toThrow();
    expect(() => assertWithinCeiling('stats', SWEEP_CEILINGS.stats)).not.toThrow();
  });

  it('throws CleanupCeilingError one row past the ceiling', () => {
    expect(() => assertWithinCeiling('projects', SWEEP_CEILINGS.projects + 1)).toThrow(
      CleanupCeilingError,
    );
  });

  // The builder has to be able to act on this without reading the source, so
  // the table, the count and the limit all have to reach the terminal.
  it('names the table, the candidate count and the ceiling', () => {
    const error = new CleanupCeilingError('images', 99, 24);

    expect(error.message).toContain('table=images');
    expect(error.message).toContain('candidates=99');
    expect(error.message).toContain('ceiling=24');
    expect(error.table).toBe('images');
    expect(error.count).toBe(99);
    expect(error.ceiling).toBe(24);
  });
});

describe('isTestStat', () => {
  // Stats rows carry no title, so the sweep matches on the run-scoped category
  // the fixture writes, with the label as a fallback.
  it('matches the stats row the suite creates', () => {
    expect(
      isTestStat({ category: 't28-1754521234567', label: 'T28 stat t28-1754521234567' }),
    ).toBe(true);
  });

  it('rejects the real stats rows', () => {
    for (const row of REAL_STATS) {
      expect(isTestStat(row)).toBe(false);
    }
  });

  // F-50 applies the same run-id requirement here. `t28-` on its own is a
  // string the builder could plausibly type into a category field; a category
  // carrying a 13-digit timestamp is not.
  it('rejects a category that starts with the fixture prefix but carries no run id', () => {
    expect(isTestStat({ category: 't28-manual', label: 'hours spent on T28' })).toBe(false);
  });

  // Stats from a crashed run still carry their own token, so they still go.
  it('accepts a stats row left behind by an earlier run', () => {
    expect(isTestStat({ category: 't28-t28-1700000000000', label: 'T28 stat t28-1700000000000' })).toBe(
      true,
    );
  });
});

describe('createServiceRoleClient', () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    // Both variables are set to known dummies first, so each test removes
    // exactly one and the assertion cannot pass for the wrong reason.
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  });

  // Restore wholesale rather than deleting keys: this file shares a process
  // with the rest of the suite and must not leak env state into it.
  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it('throws CleanupEnvError naming the URL variable when it is absent', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    expect(() => createServiceRoleClient()).toThrow(CleanupEnvError);
    expect(() => createServiceRoleClient()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it('throws CleanupEnvError naming the service-role variable when it is absent', () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    expect(() => createServiceRoleClient()).toThrow(CleanupEnvError);
    expect(() => createServiceRoleClient()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });
});

describe('CleanupIncompleteError', () => {
  // The whole point of the assertion pass is telling the builder what survived
  // and where, so the counts have to reach the terminal, not just the object.
  it('names every table and count it was constructed with', () => {
    const error = new CleanupIncompleteError({ projects: 3, posts: 1, stats: 0, images: 2 });

    expect(error.message).toContain('projects=3');
    expect(error.message).toContain('posts=1');
    expect(error.message).toContain('stats=0');
    expect(error.message).toContain('images=2');
    expect(error.survivors).toEqual({ projects: 3, posts: 1, stats: 0, images: 2 });
  });
});
