import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ZodError } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ServiceError } from '@/lib/errors';
import {
  deleteStatInternal,
  insertStatInternal,
  updateStatInternal,
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
 *
 * The `sort_order` block covers both write paths, because that field is the
 * one place where the payload key is conditional rather than the value: the
 * column is NOT NULL and a DB trigger fills it, so a blank field has to be
 * omitted from the payload rather than sent as `0` or `null`.
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
 * Build a stub Supabase client that simulates the update-side chain:
 *   `.from(...).update(...).eq('id', id).select().single() -> { data, error }`.
 */
function makeUpdateStub(result: { data: unknown; error: unknown }): {
  client: SupabaseClient;
  calls: StubCall[];
} {
  const calls: StubCall[] = [];
  const chain: Record<string, unknown> = {};
  const recorder = (method: string) => (...args: unknown[]) => {
    calls.push({ method, args });
    return chain;
  };
  chain.update = recorder('update');
  chain.eq = recorder('eq');
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
      aside: null,
      sort_order: 0,
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
      aside: null,
      sort_order: 0,
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
      aside: null,
      sort_order: 0,
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

/**
 * `sort_order` is NOT NULL with no column default, and a
 * `stats_set_sort_order_default` BEFORE INSERT trigger appends a row whose
 * `sort_order` arrives NULL. So "the operator left the field blank" has to
 * reach Postgres as an ABSENT KEY, never as `0` and never as `null`. Blank
 * used to resolve to `0`, which filed every new stat at rank 0 and tied it
 * with every other one.
 */
describe('sort_order — blank means absent, not zero', () => {
  /** A row shape for the stub to hand back; the tests assert on the payload. */
  const savedRow: Stat = {
    id: 'stat-1',
    category: 'health',
    label: 'sleep hours',
    value: '7.5',
    unit: null,
    created_at: '2026-08-04T00:00:00.000Z',
    aside: null,
    sort_order: 4,
  };
  /** The three required text fields, so each case only varies `sort_order`. */
  const required = { category: 'health', label: 'sleep hours', value: '7.5' };

  it('omits sort_order from the INSERT payload when the field is blank', async () => {
    const { client, calls } = makeCreateStub({ data: savedRow, error: null });

    await insertStatInternal({ ...required, sort_order: undefined }, client);

    const payload = calls.find((c) => c.method === 'insert')
      ?.args[0] as Record<string, unknown>;
    // `in` rather than a value check: sending `sort_order: undefined` would
    // still serialise the key, and the column rejects a NULL that the trigger
    // has not filled in.
    expect('sort_order' in payload).toBe(false);
  });

  it('omits sort_order from the INSERT payload when the key is missing entirely', async () => {
    const { client, calls } = makeCreateStub({ data: savedRow, error: null });

    await insertStatInternal(required, client);

    const payload = calls.find((c) => c.method === 'insert')
      ?.args[0] as Record<string, unknown>;
    expect('sort_order' in payload).toBe(false);
  });

  it('writes an explicit sort_order to the INSERT payload unchanged', async () => {
    const { client, calls } = makeCreateStub({ data: savedRow, error: null });

    await insertStatInternal({ ...required, sort_order: 7 }, client);

    const payload = calls.find((c) => c.method === 'insert')
      ?.args[0] as Record<string, unknown>;
    expect(payload.sort_order).toBe(7);
  });

  it('accepts an explicit 0, which is a real rank and not a blank field', async () => {
    const { client, calls } = makeCreateStub({ data: savedRow, error: null });

    await insertStatInternal({ ...required, sort_order: 0 }, client);

    const payload = calls.find((c) => c.method === 'insert')
      ?.args[0] as Record<string, unknown>;
    expect(payload.sort_order).toBe(0);
  });

  it('omits sort_order from the UPDATE payload when the field is blank', async () => {
    const { client, calls } = makeUpdateStub({ data: savedRow, error: null });

    await updateStatInternal(
      'stat-1',
      { ...required, sort_order: undefined },
      client,
    );

    const payload = calls.find((c) => c.method === 'update')
      ?.args[0] as Record<string, unknown>;
    // Leaving the rank alone, rather than resetting it to 0 on every edit.
    expect('sort_order' in payload).toBe(false);
    expect(payload.category).toBe('health');
  });

  it('writes an explicit sort_order to the UPDATE payload unchanged', async () => {
    const { client, calls } = makeUpdateStub({ data: savedRow, error: null });

    await updateStatInternal('stat-1', { ...required, sort_order: 2 }, client);

    const payload = calls.find((c) => c.method === 'update')
      ?.args[0] as Record<string, unknown>;
    expect(payload.sort_order).toBe(2);
  });

  it('rejects a non-numeric sort_order with a ZodError (no DB call made)', async () => {
    const { client, calls } = makeCreateStub({ data: null, error: null });

    await expect(
      insertStatInternal({ ...required, sort_order: 'abc' }, client),
    ).rejects.toBeInstanceOf(ZodError);
    expect(calls.find((c) => c.method === 'insert')).toBeUndefined();
  });

  it('rejects a negative sort_order with a ZodError (no DB call made)', async () => {
    const { client, calls } = makeCreateStub({ data: null, error: null });

    await expect(
      insertStatInternal({ ...required, sort_order: -1 }, client),
    ).rejects.toBeInstanceOf(ZodError);
    expect(calls.find((c) => c.method === 'insert')).toBeUndefined();
  });
});

/**
 * The two error cases TS-01 requires for the update helper. The happy path is
 * covered by the `sort_order` payload cases above; these cover the ways the
 * write is refused. `updateStatInternal` arrived at T46 with neither.
 */
describe('updateStatInternal — refusing the write', () => {
  /** A complete valid payload, so each case only varies the thing under test. */
  const validPayload = { category: 'health', label: 'sleep hours', value: '7.5' };

  it('refuses a blank or whitespace-only row id before touching the database', async () => {
    const { client, calls } = makeUpdateStub({ data: null, error: null });

    await expect(
      updateStatInternal('', validPayload, client),
    ).rejects.toBeInstanceOf(ServiceError);
    await expect(
      updateStatInternal('   ', validPayload, client),
    ).rejects.toBeInstanceOf(ServiceError);
    // An update with no WHERE target would rewrite every row in the table.
    expect(calls.find((c) => c.method === 'from')).toBeUndefined();
  });

  it('refuses an aside longer than the column allows, before touching the database', async () => {
    const { client, calls } = makeUpdateStub({ data: null, error: null });

    await expect(
      updateStatInternal(
        'stat-1',
        { ...validPayload, aside: 'x'.repeat(161) },
        client,
      ),
    ).rejects.toBeInstanceOf(ZodError);
    // The app boundary mirrors the `stats_aside_length` CHECK, so an oversized
    // aside is rejected here rather than bouncing off Postgres.
    expect(calls.find((c) => c.method === 'from')).toBeUndefined();
  });

  it('surfaces a database rejection of the update as a ServiceError', async () => {
    const { client } = makeUpdateStub({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    });

    await expect(
      updateStatInternal('stat-1', validPayload, client),
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
