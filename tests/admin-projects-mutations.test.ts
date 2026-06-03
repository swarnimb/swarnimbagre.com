import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ZodError } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ServiceError } from '@/lib/errors';
import {
  createProjectInternal,
  deleteProjectInternal,
  updateProjectInternal,
} from '@/lib/admin-projects-mutations-internal';
import type { Project } from '@/lib/types';

/**
 * T21 acceptance — admin PROJECT mutation throwing helpers.
 *
 * Tests live against `createProjectInternal` / `updateProjectInternal` /
 * `deleteProjectInternal` (the throwing layer) rather than the
 * `'use server'` wrappers. The wrappers' uniformity contract is tested
 * separately in `tests/admin-projects-mutations.uniformity.test.ts` and
 * `tests/admin-projects-mutations.timing.test.ts`. Mirrors the
 * `attemptMagicLink` / `signInWithMagicLink` split already in
 * `tests/auth.test.ts`.
 */

/** Sample published row used by the slug-lock guard test. */
const PUBLISHED_ROW: Project = {
  id: 'p-pub',
  title: 'OpenClaw',
  slug: 'openclaw',
  description: 'shipped',
  status: 'published',
  image_id: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-02T00:00:00.000Z',
  github_url: null,
  live_url: null,
  post_url: null,
  progress_percent: null,
  thumb_kind: null,
  image_after_id: null,
  post_id: null,
};

/** Sample draft row used as the pre-fetch result on draft-edit paths. */
const DRAFT_ROW: Project = {
  id: 'p-draft',
  title: 'Work in progress',
  slug: 'work-in-progress',
  description: 'still thinking',
  status: 'draft',
  image_id: null,
  created_at: '2026-04-01T00:00:00.000Z',
  updated_at: '2026-04-01T00:00:00.000Z',
  github_url: null,
  live_url: null,
  post_url: null,
  progress_percent: null,
  thumb_kind: null,
  image_after_id: null,
  post_id: null,
};

/**
 * Null defaults for the five T42 content-model fields. Spread into create-
 * and update-side test inputs so each case only declares the fields it
 * actually exercises — the rest carry through as `null`. Kept here (not in
 * the schemas module) because it is test-scaffolding, not production shape.
 */
const NULL_T42_FIELDS = {
  github_url: null,
  live_url: null,
  post_url: null,
  progress_percent: null,
  thumb_kind: null,
  // T45.A — `post_id` rides alongside the T42 content-model fields on both the
  // create- and update-side payloads. Defaulted to null here so each case only
  // declares it when it specifically exercises the post link.
  post_id: null,
} as const;

/**
 * Null defaults for the update-side image FKs and T42 fields. Spread into
 * `updateProjectInternal` test inputs so the schema's strict parse accepts
 * the payload without each case having to enumerate every nullable field.
 */
const NULL_UPDATE_FIELDS = {
  image_id: null,
  ...NULL_T42_FIELDS,
  image_after_id: null,
} as const;

/**
 * Null defaults for the `image_after_id` column on the pre-fetch SELECT
 * fixture. Mirrors the shape `fetchExistingProject` returns. Kept separate
 * from `NULL_UPDATE_FIELDS` because the fetch row shape is `{ status,
 * image_id, image_after_id }` — narrower than the payload schema.
 */
const FETCH_NULLS = { image_id: null, image_after_id: null } as const;

interface StubCall {
  method: string;
  args: unknown[];
}

/**
 * Build a stub Supabase client that simulates the create-side chain:
 *   `.from(...).insert(...).select().single() -> { data, error }`.
 *
 * Records every chained call so tests can assert that `.insert(...)` was
 * invoked with the expected payload (including the auto-generated slug).
 */
function makeCreateStub(result: { data: unknown; error: unknown }): {
  client: SupabaseClient;
  calls: StubCall[];
} {
  const calls: StubCall[] = [];
  const chain: Record<string, unknown> = {};
  const recorder = (method: string) => (...args: unknown[]) => {
    calls.push({ method, args });
    return chain;
  };
  chain.insert = recorder('insert');
  chain.select = recorder('select');
  chain.single = (..._args: unknown[]) => {
    calls.push({ method: 'single', args: _args });
    return Promise.resolve(result);
  };
  const client = {
    from: (table: string) => {
      calls.push({ method: 'from', args: [table] });
      return chain;
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

/**
 * Build a stub Supabase client for the update path: two distinct chains share
 * one `.from()` call site (one for the pre-fetch SELECT, one for the UPDATE).
 *
 * The stub maintains a small state machine — the first `.eq(...).single()`
 * call resolves with `fetchResult`, the second resolves with `updateResult`.
 */
function makeUpdateStub(opts: {
  fetchResult: { data: unknown; error: unknown };
  updateResult: { data: unknown; error: unknown };
}): { client: SupabaseClient; calls: StubCall[] } {
  const calls: StubCall[] = [];
  let singleCallCount = 0;
  const chain: Record<string, unknown> = {};
  const recorder = (method: string) => (...args: unknown[]) => {
    calls.push({ method, args });
    return chain;
  };
  chain.select = recorder('select');
  chain.update = recorder('update');
  chain.eq = recorder('eq');
  chain.single = (..._args: unknown[]) => {
    calls.push({ method: 'single', args: _args });
    singleCallCount += 1;
    return Promise.resolve(
      singleCallCount === 1 ? opts.fetchResult : opts.updateResult,
    );
  };
  const client = {
    from: (table: string) => {
      calls.push({ method: 'from', args: [table] });
      return chain;
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

/**
 * Build a stub Supabase client for the delete path:
 *   `.from('projects').delete().eq('id', id) -> { error }`
 *
 * Mirrors `makeCreateStub` / `makeUpdateStub` — a flat chain that records
 * each call so tests assert that `.delete().eq('id', id)` is reached with
 * the expected arguments.
 */
function makeDeleteStub(result: { error: unknown }): {
  client: SupabaseClient;
  calls: StubCall[];
} {
  const calls: StubCall[] = [];
  const chain: Record<string, unknown> = {};
  chain.delete = (..._args: unknown[]) => {
    calls.push({ method: 'delete', args: _args });
    return chain;
  };
  chain.eq = (...args: unknown[]) => {
    calls.push({ method: 'eq', args });
    return Promise.resolve(result);
  };
  const client = {
    from: (table: string) => {
      calls.push({ method: 'from', args: [table] });
      return chain;
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn> | undefined;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy?.mockRestore();
});

describe('createProjectInternal', () => {
  it('rejects with a ZodError when title is empty (no DB call made)', async () => {
    const { client, calls } = makeCreateStub({ data: null, error: null });

    await expect(
      createProjectInternal(
        { title: '', description: 'something', status: 'draft' },
        client,
      ),
    ).rejects.toBeInstanceOf(ZodError);

    // Nothing reached the DB layer.
    expect(calls.find((c) => c.method === 'from')).toBeUndefined();
    expect(calls.find((c) => c.method === 'insert')).toBeUndefined();
  });

  it('inserts the row with the slug derived from the title on valid input', async () => {
    const insertedRow: Project = {
      id: 'p-new',
      title: 'New Thing',
      slug: 'new-thing',
      description: 'first cut',
      status: 'draft',
      image_id: null,
      created_at: '2026-05-13T00:00:00.000Z',
      updated_at: '2026-05-13T00:00:00.000Z',
      github_url: null,
      live_url: null,
      post_url: null,
      progress_percent: null,
      thumb_kind: null,
      image_after_id: null,
      post_id: null,
    };
    const { client, calls } = makeCreateStub({ data: insertedRow, error: null });

    const result = await createProjectInternal(
      {
        title: 'New Thing',
        description: 'first cut',
        status: 'draft',
        ...NULL_T42_FIELDS,
      },
      client,
    );

    expect(result).toEqual(insertedRow);
    const insertCall = calls.find((c) => c.method === 'insert');
    expect(insertCall).toBeDefined();
    expect(insertCall?.args[0]).toEqual({
      title: 'New Thing',
      description: 'first cut',
      status: 'draft',
      slug: 'new-thing',
      ...NULL_T42_FIELDS,
    });
  });

  it('throws ServiceError when Supabase rejects the insert', async () => {
    const { client } = makeCreateStub({
      data: null,
      error: { code: '23505', message: 'duplicate key value' },
    });

    await expect(
      createProjectInternal(
        {
          title: 'Dup',
          description: 'collision',
          status: 'draft',
          ...NULL_T42_FIELDS,
        },
        client,
      ),
    ).rejects.toBeInstanceOf(ServiceError);
  });

  // T42 — five new content-model fields ride alongside the existing
  // title/description/status/slug payload on the create-side INSERT. Image
  // FKs stay out of create (CONSTRAINT-12 / T42 schema docstring) — they
  // attach post-insert via the edit flow.
  it('passes new content-model fields into the insert payload', async () => {
    const insertedRow: Project = {
      id: 'p-full',
      title: 'Full Thing',
      slug: 'full-thing',
      description: 'all fields populated',
      status: 'draft',
      image_id: null,
      created_at: '2026-05-13T00:00:00.000Z',
      updated_at: '2026-05-13T00:00:00.000Z',
      github_url: 'https://example.com',
      live_url: 'https://example.com/live',
      post_url: '/writing/foo',
      progress_percent: 75,
      thumb_kind: 'disc',
      image_after_id: null,
      post_id: null,
    };
    const { client, calls } = makeCreateStub({
      data: insertedRow,
      error: null,
    });

    await createProjectInternal(
      {
        title: 'Full Thing',
        description: 'all fields populated',
        status: 'draft',
        github_url: 'https://example.com',
        live_url: 'https://example.com/live',
        post_url: '/writing/foo',
        progress_percent: 75,
        thumb_kind: 'disc',
        post_id: null,
      },
      client,
    );

    const insertCall = calls.find((c) => c.method === 'insert');
    expect(insertCall).toBeDefined();
    const payload = insertCall?.args[0] as Record<string, unknown>;
    expect(payload.github_url).toBe('https://example.com');
    expect(payload.live_url).toBe('https://example.com/live');
    expect(payload.post_url).toBe('/writing/foo');
    expect(payload.progress_percent).toBe(75);
    expect(payload.thumb_kind).toBe('disc');
  });

  // T45.A — `post_id` (nullable uuid FK into `posts`) rides on the create-side
  // INSERT payload, mirroring how the T42 content-model fields are persisted.
  it('createProject persists post_id', async () => {
    const POST_ID = '00000000-0000-4000-8000-00000000d00d';
    const insertedRow: Project = {
      id: 'p-linked',
      title: 'Linked Thing',
      slug: 'linked-thing',
      description: 'links to a post',
      status: 'draft',
      image_id: null,
      created_at: '2026-05-28T00:00:00.000Z',
      updated_at: '2026-05-28T00:00:00.000Z',
      github_url: null,
      live_url: null,
      post_url: null,
      progress_percent: null,
      thumb_kind: null,
      image_after_id: null,
      post_id: POST_ID,
    };
    const { client, calls } = makeCreateStub({ data: insertedRow, error: null });

    await createProjectInternal(
      {
        title: 'Linked Thing',
        description: 'links to a post',
        status: 'draft',
        ...NULL_T42_FIELDS,
        post_id: POST_ID,
      },
      client,
    );

    const insertCall = calls.find((c) => c.method === 'insert');
    expect(insertCall).toBeDefined();
    const payload = insertCall?.args[0] as Record<string, unknown>;
    expect(payload.post_id).toBe(POST_ID);
  });
});

describe('updateProjectInternal', () => {
  it('omits slug from the update payload when the existing row is published (CONSTRAINT-12)', async () => {
    const { client, calls } = makeUpdateStub({
      fetchResult: {
        data: { status: 'published', ...FETCH_NULLS },
        error: null,
      },
      updateResult: { data: { ...PUBLISHED_ROW, title: 'Renamed' }, error: null },
    });

    await updateProjectInternal(
      PUBLISHED_ROW.id,
      {
        title: 'Renamed',
        description: 'still shipped',
        status: 'published',
        ...NULL_UPDATE_FIELDS,
      },
      client,
    );

    const updateCall = calls.find((c) => c.method === 'update');
    expect(updateCall).toBeDefined();
    const payload = updateCall?.args[0] as Record<string, unknown>;
    expect(payload).toBeDefined();
    expect(payload.title).toBe('Renamed');
    expect(payload.description).toBe('still shipped');
    expect(payload.status).toBe('published');
    // The slug key must be ABSENT — not merely undefined — so the DB trigger
    // is never asked to compare a value (defense in depth around CONSTRAINT-12).
    expect(Object.prototype.hasOwnProperty.call(payload, 'slug')).toBe(false);
  });

  it('includes a derived slug in the update payload when the existing row is draft', async () => {
    const { client, calls } = makeUpdateStub({
      fetchResult: {
        data: { status: 'draft', ...FETCH_NULLS },
        error: null,
      },
      updateResult: { data: { ...DRAFT_ROW, title: 'New Title' }, error: null },
    });

    await updateProjectInternal(
      DRAFT_ROW.id,
      {
        title: 'New Title',
        description: DRAFT_ROW.description,
        status: 'draft',
        ...NULL_UPDATE_FIELDS,
      },
      client,
    );

    const updateCall = calls.find((c) => c.method === 'update');
    const payload = updateCall?.args[0] as Record<string, unknown>;
    expect(payload.slug).toBe('new-title');
  });

  it('throws ServiceError when the slug-lock trigger raises on a published-row UPDATE', async () => {
    // Simulates the T8 trigger raising when an update would change slug on a
    // published row. Even though the app-side omit logic prevents this from
    // reaching the trigger today, the defense-in-depth path must surface as a
    // ServiceError — never an unhandled throw and never a silent ok.
    const triggerError = {
      code: 'P0001',
      message: 'slug is locked on published rows',
    };
    const { client } = makeUpdateStub({
      fetchResult: {
        data: { status: 'published', ...FETCH_NULLS },
        error: null,
      },
      updateResult: { data: null, error: triggerError },
    });

    await expect(
      updateProjectInternal(
        PUBLISHED_ROW.id,
        {
          title: 'Renamed',
          description: 'still shipped',
          status: 'published',
          ...NULL_UPDATE_FIELDS,
        },
        client,
      ),
    ).rejects.toBeInstanceOf(ServiceError);
  });

  it('throws ServiceError when the pre-fetch fails (e.g., row not found)', async () => {
    const { client } = makeUpdateStub({
      fetchResult: { data: null, error: { code: 'PGRST116', message: 'no rows' } },
      updateResult: { data: null, error: null },
    });

    await expect(
      updateProjectInternal(
        'unknown-id',
        {
          title: 'X',
          description: 'X',
          status: 'draft',
          ...NULL_UPDATE_FIELDS,
        },
        client,
      ),
    ).rejects.toBeInstanceOf(ServiceError);
  });

  it('rejects with a ServiceError when id is empty (no DB call made)', async () => {
    const { client, calls } = makeUpdateStub({
      fetchResult: { data: null, error: null },
      updateResult: { data: null, error: null },
    });

    await expect(
      updateProjectInternal(
        '',
        {
          title: 'X',
          description: 'X',
          status: 'draft',
          ...NULL_UPDATE_FIELDS,
        },
        client,
      ),
    ).rejects.toBeInstanceOf(ServiceError);
    expect(calls.find((c) => c.method === 'from')).toBeUndefined();
  });

  // T26 — image-attach + orphan-on-swap on the project update path.
  // The stub returns the same chain object for every `.from(...)` call, so we
  // distinguish parent vs orphan UPDATEs by the table name recorded on each
  // `.from()` call and the order of `.update()` calls relative to it.
  it('attaches an image_id on update and does NOT orphan when previous was null (T26)', async () => {
    const NEW_IMAGE_ID = '00000000-0000-4000-8000-000000000aaa';
    const { client, calls } = makeUpdateStub({
      fetchResult: {
        data: { status: 'draft', ...FETCH_NULLS },
        error: null,
      },
      updateResult: {
        data: { ...DRAFT_ROW, image_id: NEW_IMAGE_ID },
        error: null,
      },
    });

    await updateProjectInternal(
      DRAFT_ROW.id,
      {
        title: DRAFT_ROW.title,
        description: DRAFT_ROW.description,
        status: 'draft',
        ...NULL_UPDATE_FIELDS,
        image_id: NEW_IMAGE_ID,
      },
      client,
    );

    // Parent UPDATE carries the new image_id.
    const updateCall = calls.find((c) => c.method === 'update');
    const payload = updateCall?.args[0] as Record<string, unknown>;
    expect(payload.image_id).toBe(NEW_IMAGE_ID);

    // No orphan path: only two `from()` calls (SELECT + UPDATE on `projects`),
    // never `from('images')`. `orphanIfChanged` short-circuits on null previous.
    const fromCalls = calls.filter((c) => c.method === 'from');
    expect(fromCalls.map((c) => c.args[0])).toEqual(['projects', 'projects']);
  });

  it('orphans the previous image row when image_id changes on update (T26)', async () => {
    const OLD_IMAGE_ID = '00000000-0000-4000-8000-000000000111';
    const NEW_IMAGE_ID = '00000000-0000-4000-8000-000000000222';
    const { client, calls } = makeUpdateStub({
      fetchResult: {
        data: { status: 'draft', image_id: OLD_IMAGE_ID, image_after_id: null },
        error: null,
      },
      updateResult: {
        data: { ...DRAFT_ROW, image_id: NEW_IMAGE_ID },
        error: null,
      },
    });

    await updateProjectInternal(
      DRAFT_ROW.id,
      {
        title: DRAFT_ROW.title,
        description: DRAFT_ROW.description,
        status: 'draft',
        ...NULL_UPDATE_FIELDS,
        image_id: NEW_IMAGE_ID,
      },
      client,
    );

    // Three `from()` calls in order: SELECT projects, UPDATE projects, UPDATE images.
    const fromCalls = calls.filter((c) => c.method === 'from');
    expect(fromCalls.map((c) => c.args[0])).toEqual([
      'projects',
      'projects',
      'images',
    ]);

    // Two UPDATE payloads — first the parent row carries the new image_id,
    // second the orphan call NULLs both pointer columns on the previous row.
    const updateCalls = calls.filter((c) => c.method === 'update');
    expect(updateCalls).toHaveLength(2);
    expect((updateCalls[0]?.args[0] as Record<string, unknown>).image_id).toBe(
      NEW_IMAGE_ID,
    );
    expect(updateCalls[1]?.args[0]).toEqual({
      parent_id: null,
      parent_type: null,
    });

    // The orphan UPDATE targets the OLD image id. The parent UPDATE targets the
    // project row id, so eq('id', OLD_IMAGE_ID) must be among the eq calls.
    const eqCalls = calls.filter((c) => c.method === 'eq');
    expect(eqCalls.some((c) => c.args[1] === OLD_IMAGE_ID)).toBe(true);
  });

  // T42 — full content-model field round-trip on the update payload.
  it('passes new content-model fields into the update payload', async () => {
    const IMAGE_AFTER_ID = '00000000-0000-4000-8000-000000000bbb';
    const { client, calls } = makeUpdateStub({
      fetchResult: {
        data: { status: 'draft', image_id: null, image_after_id: null },
        error: null,
      },
      updateResult: { data: { ...DRAFT_ROW }, error: null },
    });

    await updateProjectInternal(
      DRAFT_ROW.id,
      {
        title: DRAFT_ROW.title,
        description: DRAFT_ROW.description,
        status: 'draft',
        image_id: null,
        github_url: 'https://example.com',
        live_url: 'https://example.com/live',
        post_url: '/writing/foo',
        progress_percent: 75,
        thumb_kind: 'disc',
        image_after_id: IMAGE_AFTER_ID,
        post_id: null,
      },
      client,
    );

    const updateCall = calls.find((c) => c.method === 'update');
    expect(updateCall).toBeDefined();
    const payload = updateCall?.args[0] as Record<string, unknown>;
    expect(payload.github_url).toBe('https://example.com');
    expect(payload.live_url).toBe('https://example.com/live');
    expect(payload.post_url).toBe('/writing/foo');
    expect(payload.progress_percent).toBe(75);
    expect(payload.thumb_kind).toBe('disc');
    expect(payload.image_after_id).toBe(IMAGE_AFTER_ID);
  });

  // T42 — `image_after_id` orphan-on-swap mirrors the T26 `image_id` rule.
  // Observed indirectly: when the FK changes, a third `.from(...)` call lands
  // on `images` and the orphan UPDATE NULLs the FK pointer columns. The
  // existing image_id is held constant at null so only one orphan call fires.
  it('detaches the previous image_after_id when it changes', async () => {
    const OLD_AFTER_ID = '00000000-0000-4000-8000-0000000aaaaa';
    const NEW_AFTER_ID = '00000000-0000-4000-8000-0000000bbbbb';
    const { client, calls } = makeUpdateStub({
      fetchResult: {
        data: { status: 'draft', image_id: null, image_after_id: OLD_AFTER_ID },
        error: null,
      },
      updateResult: {
        data: { ...DRAFT_ROW, image_after_id: NEW_AFTER_ID },
        error: null,
      },
    });

    await updateProjectInternal(
      DRAFT_ROW.id,
      {
        title: DRAFT_ROW.title,
        description: DRAFT_ROW.description,
        status: 'draft',
        image_id: null,
        github_url: null,
        live_url: null,
        post_url: null,
        progress_percent: null,
        thumb_kind: null,
        image_after_id: NEW_AFTER_ID,
        post_id: null,
      },
      client,
    );

    // image_id orphan short-circuits on null previous; image_after_id orphan
    // fires — three `from()` calls: SELECT projects, UPDATE projects, UPDATE images.
    const fromCalls = calls.filter((c) => c.method === 'from');
    expect(fromCalls.map((c) => c.args[0])).toEqual([
      'projects',
      'projects',
      'images',
    ]);

    // Parent UPDATE carries the new image_after_id; orphan UPDATE NULLs both
    // pointer columns on the OLD image row.
    const updateCalls = calls.filter((c) => c.method === 'update');
    expect(updateCalls).toHaveLength(2);
    expect(
      (updateCalls[0]?.args[0] as Record<string, unknown>).image_after_id,
    ).toBe(NEW_AFTER_ID);
    expect(updateCalls[1]?.args[0]).toEqual({
      parent_id: null,
      parent_type: null,
    });

    // Orphan UPDATE targets the OLD image_after_id row by primary key.
    const eqCalls = calls.filter((c) => c.method === 'eq');
    expect(eqCalls.some((c) => c.args[1] === OLD_AFTER_ID)).toBe(true);
  });

  it('does not detach image_after_id when it is unchanged', async () => {
    const SAME_AFTER_ID = '00000000-0000-4000-8000-0000000ccccc';
    const { client, calls } = makeUpdateStub({
      fetchResult: {
        data: {
          status: 'draft',
          image_id: null,
          image_after_id: SAME_AFTER_ID,
        },
        error: null,
      },
      updateResult: {
        data: { ...DRAFT_ROW, image_after_id: SAME_AFTER_ID },
        error: null,
      },
    });

    await updateProjectInternal(
      DRAFT_ROW.id,
      {
        title: DRAFT_ROW.title,
        description: DRAFT_ROW.description,
        status: 'draft',
        image_id: null,
        github_url: null,
        live_url: null,
        post_url: null,
        progress_percent: null,
        thumb_kind: null,
        image_after_id: SAME_AFTER_ID,
        post_id: null,
      },
      client,
    );

    // No orphan path: only two `from()` calls (SELECT + UPDATE on `projects`),
    // never `from('images')`. `orphanIfChanged` short-circuits when previous
    // equals next.
    const fromCalls = calls.filter((c) => c.method === 'from');
    expect(fromCalls.map((c) => c.args[0])).toEqual(['projects', 'projects']);
  });
});

describe('deleteProjectInternal', () => {
  it('calls supabase.from("projects").delete().eq("id", id) and resolves on success', async () => {
    const { client, calls } = makeDeleteStub({ error: null });

    await expect(deleteProjectInternal('p-1', client)).resolves.toBeUndefined();

    const fromCall = calls.find((c) => c.method === 'from');
    expect(fromCall?.args[0]).toBe('projects');
    expect(calls.find((c) => c.method === 'delete')).toBeDefined();
    const eqCall = calls.find((c) => c.method === 'eq');
    expect(eqCall?.args).toEqual(['id', 'p-1']);
  });

  it('throws ServiceError when Supabase returns an error', async () => {
    const { client } = makeDeleteStub({
      error: { code: '42501', message: 'permission denied' },
    });

    await expect(
      deleteProjectInternal('p-bad', client),
    ).rejects.toBeInstanceOf(ServiceError);
  });

  it('throws ServiceError when id is empty or whitespace (no DB call made)', async () => {
    const { client, calls } = makeDeleteStub({ error: null });

    await expect(deleteProjectInternal('', client)).rejects.toBeInstanceOf(
      ServiceError,
    );
    await expect(deleteProjectInternal('   ', client)).rejects.toBeInstanceOf(
      ServiceError,
    );
    expect(calls.find((c) => c.method === 'from')).toBeUndefined();
  });
});
