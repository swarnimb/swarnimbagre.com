import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ZodError } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ServiceError } from '@/lib/errors';
import {
  createPostInternal,
  createProjectInternal,
  deletePostInternal,
  deleteProjectInternal,
  deleteStatInternal,
  insertStatInternal,
  updatePostInternal,
  updateProjectInternal,
} from '@/lib/admin-mutations-internal';
import type { Post, Project, Stat } from '@/lib/types';

/**
 * T21 acceptance — admin mutation throwing helpers.
 *
 * Tests live against `createProjectInternal` / `updateProjectInternal` (the
 * throwing layer) rather than the `'use server'` wrappers. The wrappers'
 * uniformity contract is tested separately in
 * `tests/admin-mutations.uniformity.test.ts` and
 * `tests/admin-mutations.timing.test.ts`. Mirrors the
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
};

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
    };
    const { client, calls } = makeCreateStub({ data: insertedRow, error: null });

    const result = await createProjectInternal(
      { title: 'New Thing', description: 'first cut', status: 'draft' },
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
    });
  });

  it('throws ServiceError when Supabase rejects the insert', async () => {
    const { client } = makeCreateStub({
      data: null,
      error: { code: '23505', message: 'duplicate key value' },
    });

    await expect(
      createProjectInternal(
        { title: 'Dup', description: 'collision', status: 'draft' },
        client,
      ),
    ).rejects.toBeInstanceOf(ServiceError);
  });
});

describe('updateProjectInternal', () => {
  it('omits slug from the update payload when the existing row is published (CONSTRAINT-12)', async () => {
    const { client, calls } = makeUpdateStub({
      fetchResult: { data: { status: 'published' }, error: null },
      updateResult: { data: { ...PUBLISHED_ROW, title: 'Renamed' }, error: null },
    });

    await updateProjectInternal(
      PUBLISHED_ROW.id,
      { title: 'Renamed', description: 'still shipped', status: 'published' },
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
      fetchResult: { data: { status: 'draft' }, error: null },
      updateResult: { data: { ...DRAFT_ROW, title: 'New Title' }, error: null },
    });

    await updateProjectInternal(
      DRAFT_ROW.id,
      { title: 'New Title', description: DRAFT_ROW.description, status: 'draft' },
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
      fetchResult: { data: { status: 'published' }, error: null },
      updateResult: { data: null, error: triggerError },
    });

    await expect(
      updateProjectInternal(
        PUBLISHED_ROW.id,
        { title: 'Renamed', description: 'still shipped', status: 'published' },
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
        { title: 'X', description: 'X', status: 'draft' },
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
        { title: 'X', description: 'X', status: 'draft' },
        client,
      ),
    ).rejects.toBeInstanceOf(ServiceError);
    expect(calls.find((c) => c.method === 'from')).toBeUndefined();
  });
});

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

// =============================================================================
// Posts (T23) — TS-04 data-write critical-path tests.
//
// Mirror the projects-side critical-path tests above but exercise the post
// helpers. Three tests per the T23 spec acceptance:
//   1. createPost stores raw Markdown verbatim (CONSTRAINT-06).
//   2. updatePost omits slug from the update payload on published rows
//      (CONSTRAINT-12 slug-lock, app-side layer-one guard).
//   3. deletePost issues DELETE FROM posts WHERE id = $1 and resolves.
//
// The stub-client helpers (`makeCreateStub` / `makeUpdateStub` / `makeDeleteStub`)
// are table-agnostic — the helpers verify `.from('posts')` was called rather
// than embedding table identity in the stub.
// =============================================================================

describe('createPostInternal — TS-04 stores raw Markdown verbatim (CONSTRAINT-06)', () => {
  it('passes the content string to the DB insert unchanged — leading/trailing whitespace and Markdown syntax preserved', async () => {
    // Content with leading/trailing whitespace + multiple Markdown features:
    // headings, lists, inline code, code fence, hard line breaks. If any layer
    // trimmed, normalized, or HTML-converted this string, the assertion fails.
    const RAW_MARKDOWN =
      '  \n# Heading\n\n- list item one\n- list item two\n\nInline `code` and **bold** and _italic_.\n\n```ts\nconst x = 1;\n```\n\ntrailing whitespace below \n\n  ';

    const insertedRow: Post = {
      id: 'post-new',
      title: 'Verbatim',
      slug: 'verbatim',
      content: RAW_MARKDOWN,
      status: 'draft',
      image_id: null,
      created_at: '2026-05-13T00:00:00.000Z',
      updated_at: '2026-05-13T00:00:00.000Z',
    };
    const { client, calls } = makeCreateStub({ data: insertedRow, error: null });

    const result = await createPostInternal(
      { title: 'Verbatim', content: RAW_MARKDOWN, status: 'draft' },
      client,
    );

    expect(result).toEqual(insertedRow);

    const fromCall = calls.find((c) => c.method === 'from');
    expect(fromCall?.args[0]).toBe('posts');

    const insertCall = calls.find((c) => c.method === 'insert');
    expect(insertCall).toBeDefined();
    const payload = insertCall?.args[0] as Record<string, unknown>;
    // CONSTRAINT-06: content is stored verbatim — strict equality, no trim.
    expect(payload.content).toBe(RAW_MARKDOWN);
    // Sanity: the other fields were also forwarded.
    expect(payload.title).toBe('Verbatim');
    expect(payload.status).toBe('draft');
    expect(payload.slug).toBe('verbatim');
  });
});

describe('updatePostInternal — TS-04 rejects slug change on published post (CONSTRAINT-12)', () => {
  it('omits slug from the update payload when the existing row is published, even if title changes', async () => {
    const { client, calls } = makeUpdateStub({
      fetchResult: { data: { status: 'published' }, error: null },
      updateResult: {
        data: {
          id: 'post-pub',
          title: 'Renamed Heading',
          slug: 'original-slug',
          content: 'body',
          status: 'published',
          image_id: null,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-05-13T00:00:00.000Z',
        } as Post,
        error: null,
      },
    });

    await updatePostInternal(
      'post-pub',
      {
        title: 'Renamed Heading',
        content: 'body',
        status: 'published',
      },
      client,
    );

    const updateCall = calls.find((c) => c.method === 'update');
    expect(updateCall).toBeDefined();
    const payload = updateCall?.args[0] as Record<string, unknown>;
    expect(payload).toBeDefined();
    expect(payload.title).toBe('Renamed Heading');
    expect(payload.content).toBe('body');
    expect(payload.status).toBe('published');
    // The slug key must be ABSENT — not merely undefined — so the DB trigger
    // is never asked to compare a value (defense in depth around CONSTRAINT-12).
    expect(Object.prototype.hasOwnProperty.call(payload, 'slug')).toBe(false);
  });
});

describe('deletePostInternal — TS-04 removes the row', () => {
  it('issues DELETE FROM posts WHERE id = $1 and resolves on success', async () => {
    const { client, calls } = makeDeleteStub({ error: null });

    await expect(deletePostInternal('post-1', client)).resolves.toBeUndefined();

    const fromCall = calls.find((c) => c.method === 'from');
    expect(fromCall?.args[0]).toBe('posts');
    expect(calls.find((c) => c.method === 'delete')).toBeDefined();
    const eqCall = calls.find((c) => c.method === 'eq');
    expect(eqCall?.args).toEqual(['id', 'post-1']);
  });
});

// =============================================================================
// Stats (T24) — TS-04 data-write critical-path tests.
//
// `insertStatInternal` covers the insert side: the four fields are written
// verbatim, `unit` normalizes to explicit `null` when empty/whitespace, and
// boundary validation rejects before any DB call. `deleteStatInternal`
// mirrors the project / post delete tests. The stub-client helpers are
// table-agnostic — they verify `.from('stats')` was called rather than
// embedding table identity in the stub.
// =============================================================================

describe('insertStatInternal — TS-04 inserts the row + normalizes optional unit', () => {
  it('writes category/label/value verbatim and explicit null when unit is absent', async () => {
    const insertedRow: Stat = {
      id: 'stat-new',
      category: 'health',
      label: 'sleep hours',
      value: '7.5',
      unit: null,
      created_at: '2026-05-13T00:00:00.000Z',
    };
    const { client, calls } = makeCreateStub({ data: insertedRow, error: null });

    const result = await insertStatInternal(
      { category: 'health', label: 'sleep hours', value: '7.5' },
      client,
    );

    expect(result).toEqual(insertedRow);
    const fromCall = calls.find((c) => c.method === 'from');
    expect(fromCall?.args[0]).toBe('stats');
    const insertCall = calls.find((c) => c.method === 'insert');
    expect(insertCall).toBeDefined();
    const payload = insertCall?.args[0] as Record<string, unknown>;
    expect(payload.category).toBe('health');
    expect(payload.label).toBe('sleep hours');
    expect(payload.value).toBe('7.5');
    // The wrapper writes an explicit `null` when unit is absent so the column
    // receives NULL, not an empty string.
    expect(payload.unit).toBeNull();
  });

  it('writes the unit verbatim when supplied as a non-empty string', async () => {
    const insertedRow: Stat = {
      id: 'stat-new',
      category: 'health',
      label: 'sleep hours',
      value: '7.5',
      unit: 'h',
      created_at: '2026-05-13T00:00:00.000Z',
    };
    const { client, calls } = makeCreateStub({ data: insertedRow, error: null });

    await insertStatInternal(
      { category: 'health', label: 'sleep hours', value: '7.5', unit: 'h' },
      client,
    );

    const insertCall = calls.find((c) => c.method === 'insert');
    const payload = insertCall?.args[0] as Record<string, unknown>;
    expect(payload.unit).toBe('h');
  });

  it('preprocesses whitespace-only unit to explicit null (no empty-string column writes)', async () => {
    const insertedRow: Stat = {
      id: 'stat-new',
      category: 'health',
      label: 'sleep hours',
      value: '7.5',
      unit: null,
      created_at: '2026-05-13T00:00:00.000Z',
    };
    const { client, calls } = makeCreateStub({ data: insertedRow, error: null });

    await insertStatInternal(
      { category: 'health', label: 'sleep hours', value: '7.5', unit: '   ' },
      client,
    );

    const insertCall = calls.find((c) => c.method === 'insert');
    const payload = insertCall?.args[0] as Record<string, unknown>;
    expect(payload.unit).toBeNull();
  });

  it('rejects with a ZodError when category is empty (no DB call made)', async () => {
    const { client, calls } = makeCreateStub({ data: null, error: null });

    await expect(
      insertStatInternal(
        { category: '', label: 'sleep hours', value: '7.5' },
        client,
      ),
    ).rejects.toBeInstanceOf(ZodError);
    expect(calls.find((c) => c.method === 'from')).toBeUndefined();
    expect(calls.find((c) => c.method === 'insert')).toBeUndefined();
  });

  it('throws ServiceError when Supabase rejects the insert (e.g., RLS denial)', async () => {
    const { client } = makeCreateStub({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    });

    await expect(
      insertStatInternal(
        { category: 'C', label: 'L', value: 'V' },
        client,
      ),
    ).rejects.toBeInstanceOf(ServiceError);
  });
});

describe('deleteStatInternal — TS-04 removes the row', () => {
  it('issues DELETE FROM stats WHERE id = $1 and resolves on success', async () => {
    const { client, calls } = makeDeleteStub({ error: null });

    await expect(deleteStatInternal('stat-1', client)).resolves.toBeUndefined();

    const fromCall = calls.find((c) => c.method === 'from');
    expect(fromCall?.args[0]).toBe('stats');
    expect(calls.find((c) => c.method === 'delete')).toBeDefined();
    const eqCall = calls.find((c) => c.method === 'eq');
    expect(eqCall?.args).toEqual(['id', 'stat-1']);
  });

  it('throws ServiceError when id is empty or whitespace (no DB call made)', async () => {
    const { client, calls } = makeDeleteStub({ error: null });

    await expect(deleteStatInternal('', client)).rejects.toBeInstanceOf(
      ServiceError,
    );
    await expect(deleteStatInternal('   ', client)).rejects.toBeInstanceOf(
      ServiceError,
    );
    expect(calls.find((c) => c.method === 'from')).toBeUndefined();
  });
});
