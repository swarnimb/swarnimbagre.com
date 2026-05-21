import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ServiceError } from '@/lib/errors';
import { saveProjectMediaInternal } from '@/lib/admin-project-media-mutations-internal';

/**
 * T43.E acceptance — admin PROJECT MEDIA save throwing helper.
 *
 * Tests live against `saveProjectMediaInternal` (the throwing layer) rather
 * than the `'use server'` wrapper. The wrapper's six-channel uniformity
 * contract is structurally identical to the projects wrapper, whose
 * uniformity is already covered in `tests/admin-projects-mutations*.test.ts`;
 * this file focuses on the schema-parse + RPC dispatch behavior that the
 * new helper introduces.
 */

const VALID_PROJECT_UUID = '00000000-0000-4000-8000-000000000099';
const VALID_UUID_A = '00000000-0000-4000-8000-0000000000aa';

interface RpcCall {
  fn: string;
  args: unknown;
}

/**
 * Build a stub Supabase client that satisfies the RPC chain shape the
 * internal helper uses:
 *   `.rpc(fn, args) -> Promise<{ data, error }>`.
 *
 * Records every call so tests can assert the dispatched RPC name and the
 * snake-case argument keys (`p_project_id`, `p_rows`).
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

describe('saveProjectMediaInternal', () => {
  it('happy path: parses payload and dispatches the RPC with snake-case args', async () => {
    const { client, calls } = makeRpcStub({ error: null });
    const payload = {
      project_id: VALID_PROJECT_UUID,
      rows: [
        { image_id: VALID_UUID_A, image_after_id: null, caption: 'slide one' },
      ],
    };
    await expect(
      saveProjectMediaInternal(payload, client),
    ).resolves.toBeUndefined();
    expect(calls).toHaveLength(1);
    expect(calls[0].fn).toBe('save_project_media');
    expect(calls[0].args).toEqual({
      p_project_id: VALID_PROJECT_UUID,
      p_rows: payload.rows,
    });
  });

  it('happy path: empty rows array dispatches RPC with empty p_rows (clear-all)', async () => {
    const { client, calls } = makeRpcStub({ error: null });
    const payload = {
      project_id: VALID_PROJECT_UUID,
      rows: [],
    };
    await expect(
      saveProjectMediaInternal(payload, client),
    ).resolves.toBeUndefined();
    expect(calls[0].args).toEqual({
      p_project_id: VALID_PROJECT_UUID,
      p_rows: [],
    });
  });

  it('throws ZodError when project_id fails boundary validation', async () => {
    const { client, calls } = makeRpcStub({ error: null });
    const payload = {
      project_id: 'not-a-uuid',
      rows: [],
    };
    await expect(
      saveProjectMediaInternal(payload, client),
    ).rejects.toThrow(ZodError);
    // RPC must NOT have been called — boundary validation gates dispatch.
    expect(calls).toHaveLength(0);
  });

  it('throws ZodError when a row fails boundary validation', async () => {
    const { client, calls } = makeRpcStub({ error: null });
    const payload = {
      project_id: VALID_PROJECT_UUID,
      rows: [
        { image_id: 'not-a-uuid', image_after_id: null, caption: null },
      ],
    };
    await expect(
      saveProjectMediaInternal(payload, client),
    ).rejects.toThrow(ZodError);
    expect(calls).toHaveLength(0);
  });

  it('wraps Supabase RPC error in ServiceError tagged with the operation', async () => {
    // Simulates the row-cap trigger raising inside the RPC, which surfaces
    // as a Postgres error in the Supabase JS client's `{ error }` channel.
    const rpcError = {
      code: 'P0001',
      message: 'project_media row cap exceeded',
      details: null,
      hint: null,
    };
    const { client } = makeRpcStub({ error: rpcError });
    const payload = {
      project_id: VALID_PROJECT_UUID,
      rows: [
        { image_id: VALID_UUID_A, image_after_id: null, caption: null },
      ],
    };
    let thrown: unknown;
    try {
      await saveProjectMediaInternal(payload, client);
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(ServiceError);
    const svc = thrown as ServiceError;
    expect(svc.operation).toBe('saveProjectMedia');
    expect(svc.cause).toBe(rpcError);
  });
});
