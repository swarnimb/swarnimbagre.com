import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GENERIC_FORM_ERROR } from '@/lib/auth-constants';
import { ServiceError } from '@/lib/errors';

/**
 * BLOCKING-01 closure — the `deleteOrphanImages` Server Action.
 *
 * TS-04 makes a test per data-write operation non-negotiable, and this one is
 * the widest write on the admin surface: it hard-deletes every orphaned
 * `images` row past the grace period and their Storage objects. Until now no
 * test called it — `tests/admin-mutations-strict.test.ts` imports it only to
 * read its arity, and `tests/admin-images-cleanup.test.ts` covers the
 * throwing helper a layer below. This file invokes the action itself.
 *
 * TS-01 (this action removes user data) requires two error cases: a
 * `ServiceError` from the row delete, and an unexpected throw. Both collapse
 * to the same generic envelope, and neither may carry the partial counts the
 * success envelope uses.
 *
 * The auth-guard rejection branch is covered separately and is not repeated
 * here.
 */

vi.mock('@/lib/admin-images-cleanup', async () => {
  const real = await vi.importActual<
    typeof import('@/lib/admin-images-cleanup')
  >('@/lib/admin-images-cleanup');
  return { ...real, deleteOrphanImagesInternal: vi.fn() };
});

// The wrapper calls the real `assertAdminSession`, which resolves a
// request-scoped Supabase client via `next/headers` and throws outside a
// request context. Stubbing it keeps these cases about the envelope shape.
vi.mock('@/lib/session', async () => {
  const real = await vi.importActual<typeof import('@/lib/session')>(
    '@/lib/session',
  );
  return { ...real, assertAdminSession: vi.fn() };
});

const cleanup = await import('@/lib/admin-images-cleanup');
const { assertAdminSession } = await import('@/lib/session');
const { deleteOrphanImages } = await import('@/lib/admin-images-mutations');

beforeEach(() => {
  // Fake timers so each case fast-forwards past the MIN_DURATION_MS floor
  // without consuming real wall time.
  vi.useFakeTimers({ toFake: ['setTimeout', 'performance'] });
  vi.mocked(assertAdminSession).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.resetAllMocks();
  vi.useRealTimers();
});

describe('deleteOrphanImages — sweeping unreferenced images', () => {
  it('reports how many rows went and how much space came back', async () => {
    vi.mocked(cleanup.deleteOrphanImagesInternal).mockResolvedValue({
      deleted: 3,
      freedBytes: 250_000,
    });

    const p = deleteOrphanImages();
    await vi.advanceTimersByTimeAsync(1000);

    await expect(p).resolves.toEqual({
      status: 'ok',
      deleted: 3,
      freedBytes: 250_000,
    });
    // The action takes no inputs at all — the cutoff and the orphan predicate
    // are both the helper's business.
    expect(cleanup.deleteOrphanImagesInternal).toHaveBeenCalledWith();
  });

  it('still reports a successful sweep when there was nothing to remove', async () => {
    vi.mocked(cleanup.deleteOrphanImagesInternal).mockResolvedValue({
      deleted: 0,
      freedBytes: 0,
    });

    const p = deleteOrphanImages();
    await vi.advanceTimersByTimeAsync(1000);

    // Zero is a real result, not an error — the page renders "Deleted 0".
    await expect(p).resolves.toEqual({
      status: 'ok',
      deleted: 0,
      freedBytes: 0,
    });
  });

  it('reports the shared save failure message when the row delete fails, without naming the reason', async () => {
    vi.mocked(cleanup.deleteOrphanImagesInternal).mockRejectedValue(
      new ServiceError('deleteOrphanImages failed', {
        operation: 'deleteOrphanImages',
        cause: new Error('permission denied for table images'),
      }),
    );

    const p = deleteOrphanImages();
    await vi.advanceTimersByTimeAsync(1000);
    const result = await p;

    // No `deleted` and no `freedBytes` on the failure envelope: a partial
    // count would tell a caller how many rows matched the orphan predicate.
    expect(result).toEqual({ status: 'error', formError: GENERIC_FORM_ERROR });
    expect(result.formError).not.toContain('permission');
    expect(result.formError).not.toContain('images');
  });

  it('reports the same message when the sweep throws something unexpected', async () => {
    vi.mocked(cleanup.deleteOrphanImagesInternal).mockRejectedValue(
      new TypeError('client.storage is undefined'),
    );

    const p = deleteOrphanImages();
    await vi.advanceTimersByTimeAsync(1000);
    const result = await p;

    // The wrapper catches without inspecting the error, so an unforeseen
    // failure mode cannot escape to the wire as a distinguishable shape.
    expect(result).toEqual({ status: 'error', formError: GENERIC_FORM_ERROR });
  });
});
