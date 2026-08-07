import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isTestTitle,
  isFixtureImagePath,
  isTestStat,
  createServiceRoleClient,
  CleanupEnvError,
  CleanupIncompleteError,
  TEST_TITLE_PREFIXES,
  FIXTURE_IMAGE_FILENAMES,
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
