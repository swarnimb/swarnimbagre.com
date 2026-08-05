import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ZodError } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { GENERIC_FORM_ERROR } from '@/lib/auth-constants';
import { ServiceError } from '@/lib/errors';
import type { Note } from '@/lib/types';

/**
 * F-39 acceptance — the admin session guard on the NOTE mutation Server
 * Actions.
 *
 * `assertAdminSession` runs as the first statement inside each wrapper's
 * `try`, so a caller with no verified admin user gets the same
 * `{ status, fieldErrors?, formError? }` envelope as any other failure and
 * the throwing helper is never reached. The wrapper's broader six-channel
 * uniformity is structurally identical to the projects wrapper, already
 * covered in `tests/admin-projects-mutations.uniformity.test.ts`; this file
 * covers the guard branch that is specific to the notes surface.
 *
 * The `sort_order` blocks below cover the field's two halves: the wrapper
 * reading a blank input as absent, and the throwing helper omitting the key
 * from the write payload rather than sending `0`. Those cases reach past the
 * module mock via `vi.importActual`, since they are about what the real
 * helpers put on the wire.
 */

vi.mock('@/lib/admin-notes-mutations-internal', async () => {
  const real = await vi.importActual<
    typeof import('@/lib/admin-notes-mutations-internal')
  >('@/lib/admin-notes-mutations-internal');
  return {
    ...real,
    createNoteInternal: vi.fn(),
    updateNoteInternal: vi.fn(),
    deleteNoteInternal: vi.fn(),
  };
});

vi.mock('@/lib/session', async () => {
  const real = await vi.importActual<typeof import('@/lib/session')>(
    '@/lib/session',
  );
  return { ...real, assertAdminSession: vi.fn() };
});

const internal = await import('@/lib/admin-notes-mutations-internal');
const { assertAdminSession } = await import('@/lib/session');
const { createNote } = await import('@/lib/admin-notes-mutations');

// The real throwing helpers, reached past the module mock above. The payload
// tests are about what these actually hand to Supabase, so a stub of them
// would assert nothing.
const realInternal = await vi.importActual<
  typeof import('@/lib/admin-notes-mutations-internal')
>('@/lib/admin-notes-mutations-internal');

function buildFormData(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

interface StubCall {
  method: string;
  args: unknown[];
}

/**
 * Build a stub Supabase client recording one write chain, either
 *   `.from(...).insert(...).select().single()` or
 *   `.from(...).update(...).eq(...).select().single()`.
 * Mirrors the stubs in `tests/admin-stats-mutations.test.ts`.
 */
function makeWriteStub(result: { data: unknown; error: unknown }): {
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

/** Find the payload object handed to a recorded write call. */
function payloadOf(calls: StubCall[], method: string): Record<string, unknown> {
  return calls.find((c) => c.method === method)?.args[0] as Record<
    string,
    unknown
  >;
}

beforeEach(() => {
  // Fake timers so each case fast-forwards past the MIN_DURATION_MS floor
  // without consuming real wall time.
  vi.useFakeTimers({ toFake: ['setTimeout', 'performance'] });
  vi.mocked(assertAdminSession).mockResolvedValue(undefined);
  vi.mocked(internal.createNoteInternal).mockResolvedValue({} as never);
});

afterEach(() => {
  vi.resetAllMocks();
  vi.useRealTimers();
});

describe('F-39 — admin session guard on the NOTE wrappers', () => {
  it('resolves with the uniform error envelope and never reaches the internal helper', async () => {
    vi.mocked(assertAdminSession).mockRejectedValue(
      new ServiceError('no admin session', {
        operation: 'assertAdminSession',
      }),
    );
    const p = createNote(
      { status: 'idle' },
      buildFormData({ kicker: 'K', line: 'L', sort_order: '0' }),
    );
    await vi.advanceTimersByTimeAsync(1000);
    const result = await p;
    expect(result).toEqual({ status: 'error', formError: GENERIC_FORM_ERROR });
    expect(internal.createNoteInternal).not.toHaveBeenCalled();
  });

  it('reaches the internal helper when the guard resolves', async () => {
    const p = createNote(
      { status: 'idle' },
      buildFormData({ kicker: 'K', line: 'L', sort_order: '0' }),
    );
    await vi.advanceTimersByTimeAsync(1000);
    await expect(p).resolves.toEqual({ status: 'ok' });
    expect(internal.createNoteInternal).toHaveBeenCalledTimes(1);
  });
});

describe('createNote — sort_order reads blank as absent', () => {
  it('passes sort_order: undefined when the input is submitted empty', async () => {
    const p = createNote(
      { status: 'idle' },
      buildFormData({ kicker: 'K', line: 'L', sort_order: '' }),
    );
    await vi.advanceTimersByTimeAsync(1000);
    await p;
    const payload = vi.mocked(internal.createNoteInternal).mock
      .calls[0][0] as Record<string, unknown>;
    expect(payload.sort_order).toBeUndefined();
  });

  it('passes sort_order: undefined when the field is absent from the form', async () => {
    const p = createNote(
      { status: 'idle' },
      buildFormData({ kicker: 'K', line: 'L' }),
    );
    await vi.advanceTimersByTimeAsync(1000);
    await p;
    const payload = vi.mocked(internal.createNoteInternal).mock
      .calls[0][0] as Record<string, unknown>;
    expect(payload.sort_order).toBeUndefined();
  });

  it('passes the parsed number when the input carries a value', async () => {
    const p = createNote(
      { status: 'idle' },
      buildFormData({ kicker: 'K', line: 'L', sort_order: '5' }),
    );
    await vi.advanceTimersByTimeAsync(1000);
    await p;
    const payload = vi.mocked(internal.createNoteInternal).mock
      .calls[0][0] as Record<string, unknown>;
    expect(payload.sort_order).toBe(5);
  });

  it('passes a non-numeric entry through as a string, for zod to reject', async () => {
    const p = createNote(
      { status: 'idle' },
      buildFormData({ kicker: 'K', line: 'L', sort_order: 'abc' }),
    );
    await vi.advanceTimersByTimeAsync(1000);
    await p;
    const payload = vi.mocked(internal.createNoteInternal).mock
      .calls[0][0] as Record<string, unknown>;
    // Not silently blanked: the raw string reaches the boundary so the number
    // schema produces its deterministic field error.
    expect(payload.sort_order).toBe('abc');
  });
});

/**
 * `sort_order` is NOT NULL with no column default, and a
 * `notes_set_sort_order_default` BEFORE INSERT trigger appends a row whose
 * `sort_order` arrives NULL. So "the operator left the field blank" has to
 * reach Postgres as an ABSENT KEY, never as `0` and never as `null`. Blank
 * used to resolve to `0`, which filed every new note at rank 0 and tied it
 * with every other one.
 */
describe('note write payloads — blank sort_order means absent, not zero', () => {
  /** A row shape for the stub to hand back; the tests assert on the payload. */
  const savedRow: Note = {
    id: 'note-1',
    kicker: 'K',
    line: 'L',
    sort_order: 4,
    created_at: '2026-08-04T00:00:00.000Z',
    updated_at: '2026-08-04T00:00:00.000Z',
  };
  /** The two required text fields, so each case only varies `sort_order`. */
  const required = { kicker: 'K', line: 'L' };

  it('omits sort_order from the INSERT payload when the field is blank', async () => {
    const { client, calls } = makeWriteStub({ data: savedRow, error: null });

    await realInternal.createNoteInternal(
      { ...required, sort_order: undefined },
      client,
    );

    // `in` rather than a value check: sending `sort_order: undefined` would
    // still serialise the key, and the column rejects a NULL that the trigger
    // has not filled in.
    expect('sort_order' in payloadOf(calls, 'insert')).toBe(false);
  });

  it('omits sort_order from the INSERT payload when the key is missing entirely', async () => {
    const { client, calls } = makeWriteStub({ data: savedRow, error: null });

    await realInternal.createNoteInternal(required, client);

    expect('sort_order' in payloadOf(calls, 'insert')).toBe(false);
  });

  it('writes an explicit sort_order to the INSERT payload unchanged', async () => {
    const { client, calls } = makeWriteStub({ data: savedRow, error: null });

    await realInternal.createNoteInternal(
      { ...required, sort_order: 7 },
      client,
    );

    expect(payloadOf(calls, 'insert').sort_order).toBe(7);
  });

  it('accepts an explicit 0, which is a real rank and not a blank field', async () => {
    const { client, calls } = makeWriteStub({ data: savedRow, error: null });

    await realInternal.createNoteInternal(
      { ...required, sort_order: 0 },
      client,
    );

    expect(payloadOf(calls, 'insert').sort_order).toBe(0);
  });

  it('omits sort_order from the UPDATE payload when the field is blank', async () => {
    const { client, calls } = makeWriteStub({ data: savedRow, error: null });

    await realInternal.updateNoteInternal(
      'note-1',
      { ...required, sort_order: undefined },
      client,
    );

    // Leaving the rank alone, rather than resetting it to 0 on every edit.
    const payload = payloadOf(calls, 'update');
    expect('sort_order' in payload).toBe(false);
    expect(payload.kicker).toBe('K');
  });

  it('writes an explicit sort_order to the UPDATE payload unchanged', async () => {
    const { client, calls } = makeWriteStub({ data: savedRow, error: null });

    await realInternal.updateNoteInternal(
      'note-1',
      { ...required, sort_order: 2 },
      client,
    );

    expect(payloadOf(calls, 'update').sort_order).toBe(2);
  });

  it('rejects a non-numeric sort_order with a ZodError (no DB call made)', async () => {
    const { client, calls } = makeWriteStub({ data: null, error: null });

    await expect(
      realInternal.createNoteInternal({ ...required, sort_order: 'abc' }, client),
    ).rejects.toBeInstanceOf(ZodError);
    expect(calls.find((c) => c.method === 'insert')).toBeUndefined();
  });

  it('rejects a negative sort_order with a ZodError (no DB call made)', async () => {
    const { client, calls } = makeWriteStub({ data: null, error: null });

    await expect(
      realInternal.createNoteInternal({ ...required, sort_order: -1 }, client),
    ).rejects.toBeInstanceOf(ZodError);
    expect(calls.find((c) => c.method === 'insert')).toBeUndefined();
  });
});
