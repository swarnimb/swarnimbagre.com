import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getProjectMediaByProjectAdmin } from '@/lib/admin-queries-project-media';
import { ServiceError } from '@/lib/errors';
import type { ProjectMedia } from '@/lib/types';

/**
 * Build a stub Supabase client whose chained query terminal resolves with
 * the given `{ data, error }` payload. Mirrors the pattern in
 * `tests/db.test.ts` — the PostgREST builder is thenable, so we implement
 * `then` on the chain itself.
 */
function makeStub(result: { data: unknown; error: unknown }): SupabaseClient {
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.order = () => chain;
  chain.then = (onFulfilled: (v: typeof result) => unknown) =>
    Promise.resolve(result).then(onFulfilled);
  return { from: () => chain } as unknown as SupabaseClient;
}

/** Sample DB error shape returned by PostgREST. */
const DB_ERROR = { code: 'PGRST500', message: 'database boom' };

/** Sample media row that satisfies the ProjectMedia type. */
const SAMPLE_MEDIA: ProjectMedia = {
  id: 'm1',
  project_id: 'p1',
  image_id: 'img-1',
  image_after_id: null,
  caption: null,
  order_index: 0,
  created_at: '2026-05-20T00:00:00.000Z',
};

/** Silence `console.error` noise emitted by `logQueryError` on error-path tests. */
let consoleErrorSpy: ReturnType<typeof vi.spyOn> | undefined;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy?.mockRestore();
});

describe('getProjectMediaByProjectAdmin', () => {
  it('returns media rows in order when the database returns data', async () => {
    const stub = makeStub({ data: [SAMPLE_MEDIA], error: null });
    const result = await getProjectMediaByProjectAdmin('p1', stub);
    expect(result).toEqual([SAMPLE_MEDIA]);
  });

  it('returns an empty array when the project has no media rows', async () => {
    const stub = makeStub({ data: [], error: null });
    const result = await getProjectMediaByProjectAdmin('p1', stub);
    expect(result).toEqual([]);
  });

  it('throws a ServiceError tagged with the operation when projectId is an empty string', async () => {
    const stub = makeStub({ data: null, error: null });
    await expect(
      getProjectMediaByProjectAdmin('', stub),
    ).rejects.toBeInstanceOf(ServiceError);
    await expect(
      getProjectMediaByProjectAdmin('', stub),
    ).rejects.toMatchObject({ operation: 'getProjectMediaByProjectAdmin' });
  });

  it('throws a ServiceError tagged with the operation when projectId is not a string', async () => {
    const stub = makeStub({ data: null, error: null });
    await expect(
      getProjectMediaByProjectAdmin(null as unknown as string, stub),
    ).rejects.toBeInstanceOf(ServiceError);
    await expect(
      getProjectMediaByProjectAdmin(null as unknown as string, stub),
    ).rejects.toMatchObject({ operation: 'getProjectMediaByProjectAdmin' });
  });

  it('logs via logQueryError and throws a ServiceError when the database fails', async () => {
    const stub = makeStub({ data: null, error: DB_ERROR });
    await expect(
      getProjectMediaByProjectAdmin('p1', stub),
    ).rejects.toBeInstanceOf(ServiceError);
    await expect(
      getProjectMediaByProjectAdmin('p1', stub),
    ).rejects.toMatchObject({ operation: 'getProjectMediaByProjectAdmin' });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[admin-queries]'),
      expect.any(Object),
    );
  });
});
