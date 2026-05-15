import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ServiceError } from '@/lib/errors';
import {
  ORPHAN_CLEANUP_THRESHOLD_DAYS,
  deleteOrphanImagesInternal,
  listOrphanImages,
} from '@/lib/admin-images-cleanup';
import { IMAGES_BUCKET } from '@/lib/admin-images-mutations-types';

/**
 * T27 acceptance — admin orphan-image cleanup helpers.
 *
 * Tests live against the throwing layer (`listOrphanImages`,
 * `deleteOrphanImagesInternal`) rather than the `'use server'` wrapper,
 * mirroring the pattern in `tests/admin-images-mutations.test.ts`. The
 * wrapper's uniformity contract is asserted indirectly via the `tests/
 * server-actions-manifest.test.ts` allowlist invariant + the strict-input
 * contract test in `tests/admin-mutations-strict.test.ts`.
 *
 * Coverage matrix:
 *  - 7-day boundary cutoff: recent orphans excluded; aged orphans included
 *    (TS-01 boundary + TS-04 data-write critical path).
 *  - DB-first delete order: rows deleted, then Storage objects removed.
 *  - Storage failure recovery: row delete succeeds; Storage error logged
 *    loud with bucket paths; helper resolves successfully (the row delete
 *    is the source of truth for "did cleanup succeed").
 *  - DB failure surfaces as ServiceError with no Storage call made (the
 *    "two error tests" the spec calls for under TS-04).
 */

interface StubCall {
  method: string;
  args: unknown[];
}

const SAMPLE_NOW = new Date('2026-05-14T12:00:00.000Z');
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Build a stub Supabase client for the cleanup paths. Captures every
 * chained call so tests can assert (a) the orphan-list filter shape, (b)
 * the parameterized id list passed to `.in('id', ...)`, and (c) the
 * compensating Storage `remove` call (or its absence).
 *
 * - `.from('images').select(...).is(...).is(...).lt(...).order(...)`
 *   resolves with `selectResult`.
 * - `.from('images').delete().in('id', [...])` resolves with `deleteResult`.
 * - `.storage.from(IMAGES_BUCKET).list(prefix, { search }) -> listResult`.
 * - `.storage.from(IMAGES_BUCKET).remove([paths]) -> removeResult`.
 */
function makeCleanupStub(opts: {
  selectResult: { data: unknown; error: { code?: string; message?: string } | null };
  deleteResult: { error: { code?: string; message?: string } | null };
  listResult?: {
    data: Array<{ name: string; metadata?: { size?: number } }> | null;
    error: { message?: string } | null;
  };
  removeResult?: { error: { message?: string } | null };
}): { client: SupabaseClient; calls: StubCall[] } {
  const calls: StubCall[] = [];
  const listResult = opts.listResult ?? { data: [], error: null };
  const removeResult = opts.removeResult ?? { error: null };

  // Distinguish SELECT (orphan list) vs DELETE (cleanup) on the same
  // `from('images')` chain by tracking whether `.delete` has been invoked.
  let isDeletePath = false;

  const tableChain: Record<string, unknown> = {};
  tableChain.select = (...args: unknown[]) => {
    calls.push({ method: 'select', args });
    return tableChain;
  };
  tableChain.is = (...args: unknown[]) => {
    calls.push({ method: 'is', args });
    return tableChain;
  };
  tableChain.lt = (...args: unknown[]) => {
    calls.push({ method: 'lt', args });
    return tableChain;
  };
  tableChain.order = (...args: unknown[]) => {
    calls.push({ method: 'order', args });
    return Promise.resolve(opts.selectResult);
  };
  tableChain.delete = (...args: unknown[]) => {
    calls.push({ method: 'delete', args });
    isDeletePath = true;
    return tableChain;
  };
  tableChain.in = (...args: unknown[]) => {
    calls.push({ method: 'in', args });
    if (isDeletePath) return Promise.resolve(opts.deleteResult);
    return tableChain;
  };

  const storageChain: Record<string, unknown> = {
    list: (...args: unknown[]) => {
      calls.push({ method: 'storage.list', args });
      return Promise.resolve(listResult);
    },
    remove: (...args: unknown[]) => {
      calls.push({ method: 'storage.remove', args });
      return Promise.resolve(removeResult);
    },
  };

  const client = {
    from: (table: string) => {
      calls.push({ method: 'from', args: [table] });
      return tableChain;
    },
    storage: {
      from: (bucket: string) => {
        calls.push({ method: 'storage.from', args: [bucket] });
        return storageChain;
      },
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

describe('listOrphanImages — 7-day boundary cutoff', () => {
  it('queries images with parent_id IS NULL, parent_type IS NULL, created_at < cutoff', async () => {
    const { client, calls } = makeCleanupStub({
      selectResult: { data: [], error: null },
      deleteResult: { error: null },
    });

    await listOrphanImages(client, SAMPLE_NOW);

    // Filter chain — assert each predicate fired with the expected args.
    const isCalls = calls.filter((c) => c.method === 'is');
    expect(isCalls).toHaveLength(2);
    expect(isCalls[0]?.args).toEqual(['parent_id', null]);
    expect(isCalls[1]?.args).toEqual(['parent_type', null]);

    const ltCall = calls.find((c) => c.method === 'lt');
    expect(ltCall?.args[0]).toBe('created_at');
    // Cutoff = SAMPLE_NOW minus the threshold; the helper passes ISO.
    const expectedCutoff = new Date(
      SAMPLE_NOW.getTime() - ORPHAN_CLEANUP_THRESHOLD_DAYS * MS_PER_DAY,
    ).toISOString();
    expect(ltCall?.args[1]).toBe(expectedCutoff);
  });

  it('throws ServiceError when the Supabase select rejects', async () => {
    const { client } = makeCleanupStub({
      selectResult: {
        data: null,
        error: { code: '42501', message: 'permission denied' },
      },
      deleteResult: { error: null },
    });

    await expect(listOrphanImages(client, SAMPLE_NOW)).rejects.toBeInstanceOf(
      ServiceError,
    );
  });
});

describe('deleteOrphanImagesInternal — happy path (TS-04 critical)', () => {
  it('deletes rows older than 7 days and removes their Storage objects (DB-first)', async () => {
    const orphans = [
      {
        id: 'img-old-1',
        bucket_path: 'images/projects/abc/uuid_a.jpg',
        created_at: new Date(
          SAMPLE_NOW.getTime() - 8 * MS_PER_DAY,
        ).toISOString(),
      },
      {
        id: 'img-old-2',
        bucket_path: 'images/posts/def/uuid_b.png',
        created_at: new Date(
          SAMPLE_NOW.getTime() - 30 * MS_PER_DAY,
        ).toISOString(),
      },
    ];
    const { client, calls } = makeCleanupStub({
      selectResult: { data: orphans, error: null },
      deleteResult: { error: null },
      listResult: {
        // Storage list returns BOTH expected basenames so the helper's
        // basename-match-by-name lookup hits for each orphan path.
        data: [
          { name: 'uuid_a.jpg', metadata: { size: 100_000 } },
          { name: 'uuid_b.png', metadata: { size: 100_000 } },
        ],
        error: null,
      },
      removeResult: { error: null },
    });

    const result = await deleteOrphanImagesInternal(client, SAMPLE_NOW);

    expect(result.deleted).toBe(2);
    // freedBytes accumulates from the size lookups; the stub returns
    // matched metadata for both basenames, so the total is 2 * 100_000.
    expect(result.freedBytes).toBe(200_000);

    // Order — DB delete must come BEFORE storage.remove. Locate each in
    // the call log and assert position.
    const deleteIdx = calls.findIndex((c) => c.method === 'delete');
    const removeIdx = calls.findIndex((c) => c.method === 'storage.remove');
    expect(deleteIdx).toBeGreaterThan(-1);
    expect(removeIdx).toBeGreaterThan(-1);
    expect(deleteIdx).toBeLessThan(removeIdx);

    // Parameterized id list (SEC-03) — `.in('id', [...])` carries the ids
    // we extracted, never a string-concatenated WHERE.
    const inCall = calls.find(
      (c) => c.method === 'in' && c.args[0] === 'id',
    );
    expect(inCall?.args[1]).toEqual(['img-old-1', 'img-old-2']);

    // Storage.remove gets the bucket paths in a single batch call.
    const removeCall = calls.find((c) => c.method === 'storage.remove');
    expect(removeCall?.args[0]).toEqual(orphans.map((o) => o.bucket_path));

    // Bucket name from the constants module — never hardcoded in the helper.
    const storageFromCall = calls.find((c) => c.method === 'storage.from');
    expect(storageFromCall?.args[0]).toBe(IMAGES_BUCKET);
  });
});

describe('deleteOrphanImagesInternal — boundary (TS-01)', () => {
  it('does not delete recent orphans — empty orphan list yields no DB or Storage call', async () => {
    // The boundary case is established at the QUERY layer: the listOrphanImages
    // SELECT filters by `created_at < cutoff`, so a row at exactly the
    // boundary (or newer) never appears in the candidate list. From the
    // cleanup helper's perspective, recent orphans manifest as an empty
    // result set — no delete is issued, no Storage remove is issued.
    const { client, calls } = makeCleanupStub({
      selectResult: { data: [], error: null },
      deleteResult: { error: null },
    });

    const result = await deleteOrphanImagesInternal(client, SAMPLE_NOW);

    expect(result).toEqual({ deleted: 0, freedBytes: 0 });
    expect(calls.find((c) => c.method === 'delete')).toBeUndefined();
    expect(calls.find((c) => c.method === 'storage.remove')).toBeUndefined();
  });
});

describe('deleteOrphanImagesInternal — Storage failure (TS-04 — 2 error tests)', () => {
  it('logs storage.remove failure with bucket paths but still resolves (DB rows already deleted)', async () => {
    const orphans = [
      {
        id: 'img-old-1',
        bucket_path: 'images/projects/abc/uuid_a.jpg',
        created_at: new Date(
          SAMPLE_NOW.getTime() - 8 * MS_PER_DAY,
        ).toISOString(),
      },
    ];
    const { client, calls } = makeCleanupStub({
      selectResult: { data: orphans, error: null },
      deleteResult: { error: null },
      listResult: { data: [], error: null },
      removeResult: { error: { message: 'storage 5xx' } },
    });

    const result = await deleteOrphanImagesInternal(client, SAMPLE_NOW);

    // Cleanup succeeds from the DB perspective even when Storage rejects —
    // the row is gone, the orphan storage object becomes irrecoverable
    // from the app, and a human reconciles via the structured log.
    expect(result.deleted).toBe(1);

    // Both calls fired in the expected order.
    expect(calls.find((c) => c.method === 'delete')).toBeDefined();
    const removeCall = calls.find((c) => c.method === 'storage.remove');
    expect(removeCall).toBeDefined();
    expect(removeCall?.args[0]).toEqual(orphans.map((o) => o.bucket_path));

    // Loud-log invariant: structured log entry includes bucketPaths so a
    // human can find the orphan storage objects in the Supabase dashboard.
    expect(consoleErrorSpy).toHaveBeenCalled();
    const logCalls = consoleErrorSpy?.mock.calls ?? [];
    const matched = logCalls.find((c) => {
      const payload = c[1] as Record<string, unknown> | undefined;
      return (
        payload?.operation === 'deleteOrphanImages' &&
        Array.isArray(payload?.bucketPaths)
      );
    });
    expect(matched).toBeDefined();
  });

  it('throws ServiceError when the row delete itself rejects (no storage.remove issued)', async () => {
    const orphans = [
      {
        id: 'img-old-1',
        bucket_path: 'images/projects/abc/uuid_a.jpg',
        created_at: new Date(
          SAMPLE_NOW.getTime() - 8 * MS_PER_DAY,
        ).toISOString(),
      },
    ];
    const { client, calls } = makeCleanupStub({
      selectResult: { data: orphans, error: null },
      deleteResult: { error: { code: '42501', message: 'permission denied' } },
      listResult: { data: [], error: null },
    });

    await expect(
      deleteOrphanImagesInternal(client, SAMPLE_NOW),
    ).rejects.toBeInstanceOf(ServiceError);

    // The helper short-circuits on the row-delete failure — no Storage
    // remove call is attempted (we never delete Storage objects whose row
    // pointer is still live).
    expect(calls.find((c) => c.method === 'storage.remove')).toBeUndefined();

    // Structured log carries the operation tag + the candidate id count.
    expect(consoleErrorSpy).toHaveBeenCalled();
    const logCalls = consoleErrorSpy?.mock.calls ?? [];
    const matched = logCalls.find((c) => {
      const payload = c[1] as Record<string, unknown> | undefined;
      return (
        payload?.operation === 'deleteOrphanImages' &&
        typeof payload?.candidateIdCount === 'number'
      );
    });
    expect(matched).toBeDefined();
  });
});
