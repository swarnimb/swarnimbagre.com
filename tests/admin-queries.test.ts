import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getAllProjects, type ProjectRow } from '@/lib/admin-queries';
import { ServiceError } from '@/lib/errors';

/**
 * Build a stub Supabase client whose chained query terminal resolves with the
 * given `{ data, error, count }` payload. Tracks which builder methods were
 * called and with what arguments so tests can assert on filter wiring.
 *
 * Mirrors the pattern in `tests/db.test.ts`. Extends it with:
 *   - `.range()` chain step (admin list pagination).
 *   - the `count` field in the resolved payload (`{ count: 'exact' }` queries).
 */
interface StubCall {
  method: string;
  args: unknown[];
}

interface StubResult {
  data: unknown;
  error: unknown;
  count: number | null;
}

function makeStub(result: StubResult): { client: SupabaseClient; calls: StubCall[] } {
  const calls: StubCall[] = [];
  const chain: Record<string, unknown> = {};
  const recorder = (method: string) => (...args: unknown[]) => {
    calls.push({ method, args });
    return chain;
  };
  chain.select = recorder('select');
  chain.eq = recorder('eq');
  chain.order = recorder('order');
  chain.range = recorder('range');
  chain.then = (onFulfilled: (v: StubResult) => unknown) =>
    Promise.resolve(result).then(onFulfilled);
  const client = {
    from: (table: string) => {
      calls.push({ method: 'from', args: [table] });
      return chain;
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

/** Sample DB error shape returned by PostgREST. */
const DB_ERROR = { code: 'PGRST500', message: 'database boom' };

/** Sample draft row that satisfies ProjectRow. */
const DRAFT_ROW: ProjectRow = {
  id: 'p-draft',
  title: 'Work in progress',
  slug: 'work-in-progress',
  status: 'draft',
  image_id: null,
  created_at: '2026-04-01T00:00:00.000Z',
  updated_at: '2026-04-01T00:00:00.000Z',
};

/** Sample published row that satisfies ProjectRow. */
const PUBLISHED_ROW: ProjectRow = {
  id: 'p-pub',
  title: 'OpenClaw',
  slug: 'openclaw',
  status: 'published',
  image_id: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-02T00:00:00.000Z',
};

/** Silence `console.error` noise emitted by `logDbError` on error-path tests. */
let consoleErrorSpy: ReturnType<typeof vi.spyOn> | undefined;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy?.mockRestore();
});

describe('getAllProjects', () => {
  it('returns drafts and published when filter is "all"', async () => {
    const { client, calls } = makeStub({
      data: [DRAFT_ROW, PUBLISHED_ROW],
      error: null,
      count: 2,
    });

    const result = await getAllProjects('all', 1, 50, client);

    expect(result.rows).toEqual([DRAFT_ROW, PUBLISHED_ROW]);
    expect(result.total).toBe(2);
    // No status filter applied when filter === 'all'.
    expect(calls.find((c) => c.method === 'eq')).toBeUndefined();
  });

  it('returns only drafts when filter is "draft" (asserts .eq("status", "draft") was called)', async () => {
    const { client, calls } = makeStub({
      data: [DRAFT_ROW],
      error: null,
      count: 1,
    });

    const result = await getAllProjects('draft', 1, 50, client);

    expect(result.rows).toEqual([DRAFT_ROW]);
    expect(result.total).toBe(1);
    const eqCall = calls.find((c) => c.method === 'eq');
    expect(eqCall).toBeDefined();
    expect(eqCall?.args).toEqual(['status', 'draft']);
  });

  it('throws a ServiceError tagged with the operation when the database fails', async () => {
    const { client } = makeStub({ data: null, error: DB_ERROR, count: null });

    await expect(getAllProjects('all', 1, 50, client)).rejects.toBeInstanceOf(ServiceError);
    const { client: client2 } = makeStub({ data: null, error: DB_ERROR, count: null });
    await expect(getAllProjects('all', 1, 50, client2)).rejects.toMatchObject({
      operation: 'getAllProjects',
    });
  });
});
