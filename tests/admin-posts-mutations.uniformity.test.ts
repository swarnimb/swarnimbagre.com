import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ZodError, type ZodIssue } from 'zod';

/**
 * T23 acceptance — Channel 2 (response body shape) uniformity for the
 * POST mutation Server Actions. The wrapper resolves with the same
 * `{ status, fieldErrors?, formError? }` envelope across every outcome —
 * success, validation failure, and internal throw — so an attacker probing
 * the endpoint cannot distinguish outcomes from the wire-level response
 * shape alone.
 *
 * Mirrors the F-13 wire-shape tests in `tests/auth.test.ts` and the project
 * equivalents in `tests/admin-projects-mutations.uniformity.test.ts`. Gap
 * closure noted by the T25 plan agent: the original shared
 * `admin-mutations.uniformity.test.ts` covered projects + stats but NOT
 * posts; these tests close that gap by exercising the same three branches
 * for `createPost` (success, ZodError, non-zod throw).
 */

vi.mock('@/lib/admin-posts-mutations-internal', async () => {
  const real = await vi.importActual<
    typeof import('@/lib/admin-posts-mutations-internal')
  >('@/lib/admin-posts-mutations-internal');
  return {
    ...real,
    createPostInternal: vi.fn(),
    updatePostInternal: vi.fn(),
    deletePostInternal: vi.fn(),
  };
});

const internal = await import('@/lib/admin-posts-mutations-internal');
const { createPost } = await import('@/lib/admin-posts-mutations');

function buildFormData(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

/** Build a minimal ZodError so the wrapper's branch is exercised without real zod parsing. */
function makeZodError(field: string, message: string): ZodError {
  const issue = {
    code: 'too_small',
    minimum: 1,
    type: 'string',
    inclusive: true,
    path: [field],
    message,
  } as unknown as ZodIssue;
  return new ZodError([issue]);
}

beforeEach(() => {
  // Use fake timers so each case fast-forwards past the MIN_DURATION_MS floor
  // without consuming real wall time (the timing floor itself is covered by
  // `tests/admin-posts-mutations.timing.test.ts`).
  vi.useFakeTimers({ toFake: ['setTimeout', 'performance'] });
});

afterEach(() => {
  vi.resetAllMocks();
  vi.useRealTimers();
});

describe('createPost — Channel 2 (response body shape)', () => {
  it('createPost resolves with status:"ok" on internal success', async () => {
    vi.mocked(internal.createPostInternal).mockResolvedValue({} as never);
    const p = createPost(
      { status: 'idle' },
      buildFormData({ title: 'T', content: 'C', status: 'draft' }),
    );
    await vi.advanceTimersByTimeAsync(1000);
    await expect(p).resolves.toEqual({ status: 'ok' });
  });

  it('createPost resolves with status:"error" + fieldErrors on ZodError throw', async () => {
    vi.mocked(internal.createPostInternal).mockRejectedValue(
      makeZodError('title', 'title is required'),
    );
    const p = createPost(
      { status: 'idle' },
      buildFormData({ title: '', content: 'C', status: 'draft' }),
    );
    await vi.advanceTimersByTimeAsync(1000);
    const result = await p;
    expect(result.status).toBe('error');
    expect(result.fieldErrors).toEqual({ title: 'title is required' });
    expect(result.formError).toBeUndefined();
  });

  it('createPost resolves with status:"error" + formError on non-zod throw', async () => {
    vi.mocked(internal.createPostInternal).mockRejectedValue(
      new Error('db boom'),
    );
    const p = createPost(
      { status: 'idle' },
      buildFormData({ title: 'T', content: 'C', status: 'draft' }),
    );
    await vi.advanceTimersByTimeAsync(1000);
    const result = await p;
    expect(result.status).toBe('error');
    expect(result.formError).toBeDefined();
    expect(result.fieldErrors).toBeUndefined();
  });
});
