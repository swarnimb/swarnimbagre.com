import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * T23 acceptance — Channel 3 (timing) uniformity for POST mutation Server
 * Actions.
 *
 * Mirrors the F-12 timing test in `tests/auth.test.ts` and the project
 * equivalents in `tests/admin-projects-mutations.timing.test.ts`. Gap
 * closure noted by the T25 plan agent: the original shared
 * `admin-mutations.timing.test.ts` covered projects + stats but NOT posts;
 * these tests close that gap by exercising both timing branches for
 * `createPost` (instant-resolve and inner-throw). The wrapper pads every
 * outcome — success, zod failure, ServiceError throw, DB error — to
 * `MIN_DURATION_MS = 750`.
 */

/** Mirrors lib/auth-constants.ts::MIN_DURATION_MS. Lock-step with production. */
const MIN_DURATION_MS = 750;

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

afterEach(() => {
  vi.resetAllMocks();
});

beforeEach(() => {
  // Default stubs — overridden per case below.
  vi.mocked(internal.createPostInternal).mockResolvedValue({} as never);
  vi.mocked(internal.updatePostInternal).mockResolvedValue({} as never);
  vi.mocked(internal.deletePostInternal).mockResolvedValue(undefined);
});

function buildFormData(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

describe('createPost — timing floor (Channel 3)', () => {
  it('createPost does not settle before MIN_DURATION_MS even when inner helper resolves instantly', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'performance'] });
    try {
      vi.mocked(internal.createPostInternal).mockResolvedValue({} as never);
      let settled = false;
      const p = createPost(
        { status: 'idle' },
        buildFormData({ title: 'T', content: 'C', status: 'draft' }),
      ).then(() => {
        settled = true;
      });

      await vi.advanceTimersByTimeAsync(MIN_DURATION_MS - 1);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await p;
      expect(settled).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('createPost still pads to MIN_DURATION_MS when inner helper throws', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'performance'] });
    try {
      vi.mocked(internal.createPostInternal).mockRejectedValue(
        new Error('boom'),
      );
      let settled = false;
      const p = createPost(
        { status: 'idle' },
        buildFormData({ title: 'T', content: 'C', status: 'draft' }),
      ).then(() => {
        settled = true;
      });

      await vi.advanceTimersByTimeAsync(MIN_DURATION_MS - 1);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await p;
      expect(settled).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
