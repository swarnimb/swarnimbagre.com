import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ServiceError } from '@/lib/errors';
import { saveOrderInternal } from '@/lib/admin-reorder-mutations-internal';
import {
  saveProjectOrder,
  savePostOrder,
} from '@/lib/admin-reorder-mutations';
import { REORDER_MUTATION_INITIAL_STATE } from '@/lib/admin-reorder-mutations-types';
import { reorderRows } from '@/lib/admin-project-media-form-state';
import { serializeOrder } from '@/components/admin/ResourceListReorder';

/**
 * T44.C acceptance — admin REORDER save surface.
 *
 * The throwing helper (`saveOrderInternal`) is exercised directly with a
 * stubbed Supabase client (DI seam) for the happy / RPC-error / zod-reject
 * paths. The `'use server'` wrappers (`saveProjectOrder`, `savePostOrder`)
 * cannot inject a client — they resolve a request-scoped server client that
 * pulls `next/headers` — so the wrapper tests cover only the paths that do
 * NOT reach Supabase: the zod-rejection error envelope and the never-throw
 * contract. The happy-path RPC dispatch (name + `p_rows`) is asserted via
 * `saveOrderInternal`. These are unit tests: no real network / DB is touched.
 */

const VALID_UUID_A = '00000000-0000-4000-8000-0000000000aa';
const VALID_UUID_B = '00000000-0000-4000-8000-0000000000bb';

interface RpcCall {
  fn: string;
  args: unknown;
}

/**
 * Build a stub Supabase client satisfying the RPC chain shape the internal
 * helper uses: `.rpc(fn, args) -> Promise<{ data, error }>`. Records every
 * call so tests can assert the dispatched RPC name and the snake-case arg
 * key (`p_rows`).
 */
function makeRpcStub(result: { error: unknown }): {
  client: SupabaseClient;
  calls: RpcCall[];
} {
  const calls: RpcCall[] = [];
  const client = {
    rpc: (fn: string, args: unknown) => {
      calls.push({ fn, args });
      return Promise.resolve({ data: null, ...result });
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

/** Build a FormData carrying the JSON-serialized ordered rows, as the UI does. */
function formDataWithRows(rows: unknown): FormData {
  const fd = new FormData();
  fd.set('rows', JSON.stringify(rows));
  return fd;
}

describe('saveOrderInternal', () => {
  it('projects happy path: dispatches save_project_order with p_rows', async () => {
    const { client, calls } = makeRpcStub({ error: null });
    const rows = [{ id: VALID_UUID_A }, { id: VALID_UUID_B }];
    await expect(
      saveOrderInternal('projects', { rows }, client),
    ).resolves.toBeUndefined();
    expect(calls).toHaveLength(1);
    expect(calls[0].fn).toBe('save_project_order');
    expect(calls[0].args).toEqual({ p_rows: rows });
  });

  it('posts happy path: dispatches save_post_order with p_rows', async () => {
    const { client, calls } = makeRpcStub({ error: null });
    const rows = [{ id: VALID_UUID_A }];
    await expect(
      saveOrderInternal('posts', { rows }, client),
    ).resolves.toBeUndefined();
    expect(calls[0].fn).toBe('save_post_order');
    expect(calls[0].args).toEqual({ p_rows: rows });
  });

  it('empty rows array dispatches RPC with empty p_rows (no-op reorder)', async () => {
    const { client, calls } = makeRpcStub({ error: null });
    await expect(
      saveOrderInternal('projects', { rows: [] }, client),
    ).resolves.toBeUndefined();
    expect(calls[0].args).toEqual({ p_rows: [] });
  });

  it('throws ZodError on a non-uuid id and never dispatches the RPC', async () => {
    const { client, calls } = makeRpcStub({ error: null });
    await expect(
      saveOrderInternal('projects', { rows: [{ id: 'not-a-uuid' }] }, client),
    ).rejects.toThrow(ZodError);
    expect(calls).toHaveLength(0);
  });

  it('throws ZodError on an extra row key (.strict) and never dispatches', async () => {
    const { client, calls } = makeRpcStub({ error: null });
    await expect(
      saveOrderInternal(
        'projects',
        { rows: [{ id: VALID_UUID_A, sort_order: 3 }] },
        client,
      ),
    ).rejects.toThrow(ZodError);
    expect(calls).toHaveLength(0);
  });

  it('wraps a Supabase RPC error in ServiceError tagged with the operation', async () => {
    const rpcError = {
      code: 'P0001',
      message: 'save_project_order: p_rows must be a jsonb array',
      details: null,
      hint: null,
    };
    const { client } = makeRpcStub({ error: rpcError });
    let thrown: unknown;
    try {
      await saveOrderInternal('projects', { rows: [{ id: VALID_UUID_A }] }, client);
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(ServiceError);
    const svc = thrown as ServiceError;
    expect(svc.operation).toBe('saveProjectOrder');
    expect(svc.cause).toBe(rpcError);
  });
});

describe('saveProjectOrder / savePostOrder (wrapper, non-DB paths)', () => {
  it('returns an error envelope on a non-uuid id and does NOT throw', async () => {
    const state = await saveProjectOrder(
      REORDER_MUTATION_INITIAL_STATE,
      formDataWithRows([{ id: 'not-a-uuid' }]),
    );
    expect(state.status).toBe('error');
    expect(state.formError).toBeUndefined();
    expect(state.fieldErrors).toBeDefined();
    expect(state.fieldErrors).toHaveProperty('rows.0.id');
  });

  it('savePostOrder returns an error envelope on malformed rows JSON without throwing', async () => {
    const fd = new FormData();
    fd.set('rows', '{not valid json');
    const state = await savePostOrder(REORDER_MUTATION_INITIAL_STATE, fd);
    expect(state.status).toBe('error');
    // Malformed JSON leaves `rows` undefined -> top-level zod rejection.
    expect(state.fieldErrors).toBeDefined();
  });
});

/**
 * T44.D acceptance — the client-side reorder UI primitives. The drag handler
 * commits local order via `reorderRows`; the Save-order form serializes that
 * order through `serializeOrder` into the single hidden `rows` wire field the
 * Server Actions above read. Both are pure — exercised here without rendering.
 */
describe('ResourceListReorder client primitives (T44.D)', () => {
  it('serializeOrder returns ordered {id} JSON', () => {
    const rows = [
      { id: 'a', title: 'Alpha' },
      { id: 'b', title: 'Beta' },
    ];
    expect(serializeOrder(rows)).toBe('[{"id":"a"},{"id":"b"}]');
  });

  it('reorderRows reorders the client list on drop', () => {
    const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    // Drag row 0 (`a`) and drop onto index 2 — `a` lands after `c`.
    expect(reorderRows(rows, 0, 2)).toEqual([
      { id: 'b' },
      { id: 'c' },
      { id: 'a' },
    ]);
  });
});
