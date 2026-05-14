import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ZodError } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ServiceError } from '@/lib/errors';
import {
  deleteStatInternal,
  insertStatInternal,
} from '@/lib/admin-stats-mutations-internal';
import type { Stat } from '@/lib/types';

/**
 * T24 acceptance — admin STAT mutation throwing helpers.
 *
 * Tests live against `insertStatInternal` / `deleteStatInternal` (the
 * throwing layer) rather than the `'use server'` wrappers. The wrappers'
 * uniformity contract is tested separately in
 * `tests/admin-stats-mutations.uniformity.test.ts` and
 * `tests/admin-stats-mutations.timing.test.ts`. Mirrors the pattern in
 * `tests/admin-projects-mutations.test.ts` and
 * `tests/admin-posts-mutations.test.ts`.
 *
 * `insertStatInternal` covers the insert side: the four fields are written
 * verbatim, `unit` normalizes to explicit `null` when empty/whitespace, and
 * boundary validation rejects before any DB call. `deleteStatInternal`
 * mirrors the project / post delete tests.
 */

interface StubCall {
  method: string;
  args: unknown[];
}

/**
 * Build a stub Supabase client that simulates the create-side chain:
 *   `.from(...).insert(...).select().single() -> { data, error }`.
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
 * Build a stub Supabase client for the delete path:
 *   `.from('stats').delete().eq('id', id) -> { error }`
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
