import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getPublishedProjects,
  getPublishedPosts,
  getProjectBySlug,
  getPostBySlug,
  getPublishedPostById,
  getOrderedStats,
  getNotes,
  getProjectMediaByProject,
} from '@/lib/db';
import { ServiceError } from '@/lib/errors';
import type { Project, Post, Stat, Note, ProjectMedia } from '@/lib/types';

/**
 * Build a stub Supabase client whose chained query terminal resolves with the
 * given `{ data, error }` payload. Works for both list queries (awaited at the
 * end of the chain — `.order()` is the last call) and single-row queries
 * (terminated with `.maybeSingle()`). The PostgREST builder is thenable, so we
 * implement `then` to make the chain itself awaitable.
 */
function makeStub(result: { data: unknown; error: unknown }): SupabaseClient {
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.order = () => chain;
  chain.maybeSingle = () => Promise.resolve(result);
  chain.then = (onFulfilled: (v: typeof result) => unknown) =>
    Promise.resolve(result).then(onFulfilled);
  return { from: () => chain } as unknown as SupabaseClient;
}

/**
 * Recording variant of {@link makeStub}: captures every `.order(column, opts)`
 * call so the list-read tests can assert the exact ordering wiring (T44 —
 * `sort_order` ASC then `created_at` DESC) rather than just the echoed data.
 */
function makeOrderRecordingStub(result: { data: unknown; error: unknown }): {
  client: SupabaseClient;
  orderCalls: unknown[][];
} {
  const orderCalls: unknown[][] = [];
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.order = (...args: unknown[]) => {
    orderCalls.push(args);
    return chain;
  };
  chain.maybeSingle = () => Promise.resolve(result);
  chain.then = (onFulfilled: (v: typeof result) => unknown) =>
    Promise.resolve(result).then(onFulfilled);
  return { client: { from: () => chain } as unknown as SupabaseClient, orderCalls };
}

/** Sample DB error shape returned by PostgREST. */
const DB_ERROR = { code: 'PGRST500', message: 'database boom' };

/** Sample project row that satisfies the Project type. */
const SAMPLE_PROJECT: Project = {
  id: 'p1',
  title: 'OpenClaw',
  slug: 'openclaw',
  description: 'Telegram agent that scrapes stats.',
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
  sort_order: 0,
  subtitle: null,
  tags: null,
};

/** Sample post row that satisfies the Post type. */
const SAMPLE_POST: Post = {
  id: 'po1',
  title: 'On building in the open',
  slug: 'building-in-the-open',
  content: 'A short post body.',
  status: 'published',
  image_id: null,
  created_at: '2026-02-01T00:00:00.000Z',
  updated_at: '2026-02-02T00:00:00.000Z',
  sort_order: 0,
};

/** Sample stat rows in the order the query is expected to return them. */
const SAMPLE_STATS: Stat[] = [
  {
    id: 's1',
    category: 'reading',
    label: 'Books finished',
    value: '12',
    unit: null,
    created_at: '2026-03-10T00:00:00.000Z',
    aside: 'Two of them twice.',
    sort_order: 0,
  },
  {
    id: 's2',
    category: 'reading',
    label: 'Pages this week',
    value: '210',
    unit: 'pages',
    created_at: '2026-03-09T00:00:00.000Z',
    aside: null,
    sort_order: 1,
  },
  {
    id: 's3',
    category: 'running',
    label: 'Weekly distance',
    value: '24',
    unit: 'km',
    created_at: '2026-03-08T00:00:00.000Z',
    aside: null,
    sort_order: 2,
  },
];

/** Sample note rows in the order the query is expected to return them. */
const SAMPLE_NOTES: Note[] = [
  {
    id: 'n1',
    kicker: 'Currently reading',
    line: 'Something long and mostly unfinished.',
    sort_order: 0,
    created_at: '2026-06-02T00:00:00.000Z',
    updated_at: '2026-06-02T00:00:00.000Z',
  },
  {
    id: 'n2',
    kicker: 'Currently watching',
    line: 'The same three shows on rotation.',
    sort_order: 1,
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: '2026-06-01T00:00:00.000Z',
  },
];

/** Silence `console.error` noise emitted by `logDbError` on error-path tests. */
let consoleErrorSpy: ReturnType<typeof vi.spyOn> | undefined;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy?.mockRestore();
});

describe('getPublishedProjects', () => {
  it('returns rows when the database returns data', async () => {
    const stub = makeStub({ data: [SAMPLE_PROJECT], error: null });
    const result = await getPublishedProjects(stub);
    expect(result).toEqual([SAMPLE_PROJECT]);
  });

  it('returns an empty array when the database returns zero rows', async () => {
    const stub = makeStub({ data: [], error: null });
    const result = await getPublishedProjects(stub);
    expect(result).toEqual([]);
  });

  it('orders by sort_order asc then created_at desc (T44)', async () => {
    const { client, orderCalls } = makeOrderRecordingStub({
      data: [SAMPLE_PROJECT],
      error: null,
    });
    await getPublishedProjects(client);
    expect(orderCalls).toEqual([
      ['sort_order', { ascending: true }],
      ['created_at', { ascending: false }],
    ]);
  });

  it('throws a ServiceError tagged with the operation when the database fails', async () => {
    const stub = makeStub({ data: null, error: DB_ERROR });
    await expect(getPublishedProjects(stub)).rejects.toBeInstanceOf(ServiceError);
    await expect(getPublishedProjects(stub)).rejects.toMatchObject({
      operation: 'getPublishedProjects',
    });
  });
});

describe('getPublishedPosts', () => {
  it('returns rows when the database returns data', async () => {
    const stub = makeStub({ data: [SAMPLE_POST], error: null });
    const result = await getPublishedPosts(stub);
    expect(result).toEqual([SAMPLE_POST]);
  });

  it('orders by sort_order asc then created_at desc (T44)', async () => {
    const { client, orderCalls } = makeOrderRecordingStub({
      data: [SAMPLE_POST],
      error: null,
    });
    await getPublishedPosts(client);
    expect(orderCalls).toEqual([
      ['sort_order', { ascending: true }],
      ['created_at', { ascending: false }],
    ]);
  });

  it('throws a ServiceError tagged with the operation when the database fails', async () => {
    const stub = makeStub({ data: null, error: DB_ERROR });
    await expect(getPublishedPosts(stub)).rejects.toBeInstanceOf(ServiceError);
    await expect(getPublishedPosts(stub)).rejects.toMatchObject({
      operation: 'getPublishedPosts',
    });
  });
});

describe('getProjectBySlug', () => {
  it('returns the project when a matching slug is found', async () => {
    const stub = makeStub({ data: SAMPLE_PROJECT, error: null });
    const result = await getProjectBySlug('openclaw', stub);
    expect(result).toEqual(SAMPLE_PROJECT);
  });

  it('returns null when no project matches the slug', async () => {
    const stub = makeStub({ data: null, error: null });
    const result = await getProjectBySlug('does-not-exist', stub);
    expect(result).toBeNull();
  });

  it('throws a ServiceError tagged with the operation when the database fails', async () => {
    const stub = makeStub({ data: null, error: DB_ERROR });
    await expect(getProjectBySlug('openclaw', stub)).rejects.toBeInstanceOf(ServiceError);
    await expect(getProjectBySlug('openclaw', stub)).rejects.toMatchObject({
      operation: 'getProjectBySlug',
    });
  });

  it('throws a ServiceError when the slug is an empty string', async () => {
    const stub = makeStub({ data: null, error: null });
    await expect(getProjectBySlug('', stub)).rejects.toBeInstanceOf(ServiceError);
    await expect(getProjectBySlug('', stub)).rejects.toMatchObject({
      operation: 'getProjectBySlug',
    });
  });

  it('throws a ServiceError when the slug is not a string', async () => {
    const stub = makeStub({ data: null, error: null });
    await expect(
      getProjectBySlug(null as unknown as string, stub),
    ).rejects.toBeInstanceOf(ServiceError);
    await expect(
      getProjectBySlug(null as unknown as string, stub),
    ).rejects.toMatchObject({ operation: 'getProjectBySlug' });
  });
});

describe('getPostBySlug', () => {
  it('returns the post when a matching slug is found', async () => {
    const stub = makeStub({ data: SAMPLE_POST, error: null });
    const result = await getPostBySlug('building-in-the-open', stub);
    expect(result).toEqual(SAMPLE_POST);
  });

  it('returns null when no post matches the slug', async () => {
    const stub = makeStub({ data: null, error: null });
    const result = await getPostBySlug('does-not-exist', stub);
    expect(result).toBeNull();
  });

  it('throws a ServiceError tagged with the operation when the database fails', async () => {
    const stub = makeStub({ data: null, error: DB_ERROR });
    await expect(
      getPostBySlug('building-in-the-open', stub),
    ).rejects.toBeInstanceOf(ServiceError);
    await expect(
      getPostBySlug('building-in-the-open', stub),
    ).rejects.toMatchObject({ operation: 'getPostBySlug' });
  });

  it('throws a ServiceError when the slug is an empty string', async () => {
    const stub = makeStub({ data: null, error: null });
    await expect(getPostBySlug('', stub)).rejects.toBeInstanceOf(ServiceError);
    await expect(getPostBySlug('', stub)).rejects.toMatchObject({
      operation: 'getPostBySlug',
    });
  });

  it('throws a ServiceError when the slug is not a string', async () => {
    const stub = makeStub({ data: null, error: null });
    await expect(
      getPostBySlug(null as unknown as string, stub),
    ).rejects.toBeInstanceOf(ServiceError);
    await expect(
      getPostBySlug(null as unknown as string, stub),
    ).rejects.toMatchObject({ operation: 'getPostBySlug' });
  });
});

describe('getPublishedPostById', () => {
  // SECURITY (T45.C, Override 3): this loader is the boundary that prevents a
  // draft post linked via `Project.post_id` from leaking onto the public
  // project detail page. The `status='published'` filter lives in the query,
  // so a draft row never matches and PostgREST returns `data: null`. These
  // tests assert the loader resolves to `null` for every non-published input
  // and only returns a post for a published id.

  it('returns the post for a published id', async () => {
    const stub = makeStub({ data: SAMPLE_POST, error: null });
    const result = await getPublishedPostById('po1', stub);
    expect(result).toEqual(SAMPLE_POST);
  });

  it('returns null for a DRAFT post (filtered out by status=published, no row returned)', async () => {
    // With the `.eq('status', 'published')` filter applied, a draft row does
    // not match the query and PostgREST resolves with `data: null`.
    const stub = makeStub({ data: null, error: null });
    const result = await getPublishedPostById('draft-post-id', stub);
    expect(result).toBeNull();
  });

  it('returns null for a MISSING id (no matching row)', async () => {
    const stub = makeStub({ data: null, error: null });
    const result = await getPublishedPostById('does-not-exist', stub);
    expect(result).toBeNull();
  });

  it('returns null for a null id without touching the database', async () => {
    const from = vi.fn();
    const stub = { from } as unknown as SupabaseClient;
    const result = await getPublishedPostById(null, stub);
    expect(result).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it('throws a ServiceError tagged with the operation when the database fails', async () => {
    const stub = makeStub({ data: null, error: DB_ERROR });
    await expect(getPublishedPostById('po1', stub)).rejects.toBeInstanceOf(ServiceError);
    await expect(getPublishedPostById('po1', stub)).rejects.toMatchObject({
      operation: 'getPublishedPostById',
    });
  });
});

describe('getOrderedStats', () => {
  // T46 replaced `getStatsByCategory` with this loader. The return shape is a
  // flat array in query order, not a category-keyed map. The Other page
  // renders a fixed tile sequence, which alphabetical grouping could not
  // express.

  it('returns rows in query order when the database returns data', async () => {
    const stub = makeStub({ data: SAMPLE_STATS, error: null });
    const result = await getOrderedStats(stub);
    expect(result).toEqual(SAMPLE_STATS);
    expect(result.map((row) => row.id)).toEqual(['s1', 's2', 's3']);
  });

  it('returns an empty array when there are no stat rows', async () => {
    const stub = makeStub({ data: [], error: null });
    const result = await getOrderedStats(stub);
    expect(result).toEqual([]);
  });

  it('orders by sort_order asc then created_at desc (T46)', async () => {
    const { client, orderCalls } = makeOrderRecordingStub({
      data: SAMPLE_STATS,
      error: null,
    });
    await getOrderedStats(client);
    expect(orderCalls).toEqual([
      ['sort_order', { ascending: true }],
      ['created_at', { ascending: false }],
    ]);
  });

  it('throws a ServiceError tagged with the operation when the database fails', async () => {
    const stub = makeStub({ data: null, error: DB_ERROR });
    await expect(getOrderedStats(stub)).rejects.toBeInstanceOf(ServiceError);
    await expect(getOrderedStats(stub)).rejects.toMatchObject({
      operation: 'getOrderedStats',
    });
  });
});

describe('getNotes', () => {
  it('returns rows in query order when the database returns data', async () => {
    const stub = makeStub({ data: SAMPLE_NOTES, error: null });
    const result = await getNotes(stub);
    expect(result).toEqual(SAMPLE_NOTES);
    expect(result.map((row) => row.id)).toEqual(['n1', 'n2']);
  });

  it('returns an empty array when there are no note rows', async () => {
    const stub = makeStub({ data: [], error: null });
    const result = await getNotes(stub);
    expect(result).toEqual([]);
  });

  it('orders by sort_order asc then created_at desc (T46)', async () => {
    const { client, orderCalls } = makeOrderRecordingStub({
      data: SAMPLE_NOTES,
      error: null,
    });
    await getNotes(client);
    expect(orderCalls).toEqual([
      ['sort_order', { ascending: true }],
      ['created_at', { ascending: false }],
    ]);
  });

  it('throws a ServiceError tagged with the operation when the database fails', async () => {
    const stub = makeStub({ data: null, error: DB_ERROR });
    await expect(getNotes(stub)).rejects.toBeInstanceOf(ServiceError);
    await expect(getNotes(stub)).rejects.toMatchObject({
      operation: 'getNotes',
    });
  });
});

/** Sample `project_media` row that satisfies the ProjectMedia type. */
const SAMPLE_MEDIA: ProjectMedia = {
  id: 'm1',
  project_id: 'p1',
  image_id: 'img-1',
  image_after_id: null,
  order_index: 0,
  created_at: '2026-05-20T00:00:00.000Z',
};

describe('getProjectMediaByProject', () => {
  it('returns rows when the database returns data', async () => {
    const stub = makeStub({ data: [SAMPLE_MEDIA], error: null });
    const result = await getProjectMediaByProject('p1', stub);
    expect(result).toEqual([SAMPLE_MEDIA]);
  });

  it('returns an empty array when the project has no media rows', async () => {
    const stub = makeStub({ data: [], error: null });
    const result = await getProjectMediaByProject('p1', stub);
    expect(result).toEqual([]);
  });

  it('throws a ServiceError tagged with the operation when projectId is an empty string', async () => {
    const stub = makeStub({ data: null, error: null });
    await expect(getProjectMediaByProject('', stub)).rejects.toBeInstanceOf(ServiceError);
    await expect(getProjectMediaByProject('', stub)).rejects.toMatchObject({
      operation: 'getProjectMediaByProject',
    });
  });

  it('throws a ServiceError tagged with the operation when projectId is not a string', async () => {
    const stub = makeStub({ data: null, error: null });
    await expect(
      getProjectMediaByProject(null as unknown as string, stub),
    ).rejects.toBeInstanceOf(ServiceError);
    await expect(
      getProjectMediaByProject(null as unknown as string, stub),
    ).rejects.toMatchObject({ operation: 'getProjectMediaByProject' });
  });

  it('throws a ServiceError tagged with the operation when the database fails', async () => {
    const stub = makeStub({ data: null, error: DB_ERROR });
    await expect(getProjectMediaByProject('p1', stub)).rejects.toBeInstanceOf(ServiceError);
    await expect(getProjectMediaByProject('p1', stub)).rejects.toMatchObject({
      operation: 'getProjectMediaByProject',
    });
  });
});
