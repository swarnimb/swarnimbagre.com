import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * T21 acceptance — Channel 3 (timing) uniformity for mutation Server Actions.
 *
 * Mirrors the F-12 timing test in `tests/auth.test.ts` (lines 185-231) for
 * `signInWithMagicLink`. The wrapper pads every outcome — success, zod
 * failure, ServiceError throw, DB error — to `MIN_DURATION_MS = 750`.
 * A fast inner path that resolved in microseconds without the bound would
 * be a single-probe oracle on validation state and existence; padding the
 * `finally` floor closes the channel.
 */

/** Mirrors lib/auth-constants.ts::MIN_DURATION_MS. Lock-step with production. */
const MIN_DURATION_MS = 750;

vi.mock('@/lib/admin-mutations-internal', async () => {
  const real =
    await vi.importActual<typeof import('@/lib/admin-mutations-internal')>(
      '@/lib/admin-mutations-internal',
    );
  return {
    ...real,
    createProjectInternal: vi.fn(),
    updateProjectInternal: vi.fn(),
    deleteProjectInternal: vi.fn(),
  };
});

const internal = await import('@/lib/admin-mutations-internal');
const { createProject, updateProject, deleteProject } = await import(
  '@/lib/admin-mutations'
);

afterEach(() => {
  vi.resetAllMocks();
});

beforeEach(() => {
  // Default stubs — overridden per case below.
  vi.mocked(internal.createProjectInternal).mockResolvedValue({} as never);
  vi.mocked(internal.updateProjectInternal).mockResolvedValue({} as never);
  vi.mocked(internal.deleteProjectInternal).mockResolvedValue(undefined);
});

function buildFormData(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

describe('createProject — timing floor (Channel 3)', () => {
  it('does not settle before MIN_DURATION_MS even when the inner helper resolves instantly', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'performance'] });
    try {
      vi.mocked(internal.createProjectInternal).mockResolvedValue({} as never);
      let settled = false;
      const p = createProject(
        { status: 'idle' },
        buildFormData({ title: 'T', description: 'D', status: 'draft' }),
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

  it('still pads to MIN_DURATION_MS when the inner helper throws', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'performance'] });
    try {
      vi.mocked(internal.createProjectInternal).mockRejectedValue(
        new Error('boom'),
      );
      let settled = false;
      const p = createProject(
        { status: 'idle' },
        buildFormData({ title: 'T', description: 'D', status: 'draft' }),
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

describe('updateProject — timing floor (Channel 3)', () => {
  it('still pads to MIN_DURATION_MS when the inner helper throws', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'performance'] });
    try {
      vi.mocked(internal.updateProjectInternal).mockRejectedValue(
        new Error('boom'),
      );
      let settled = false;
      const p = updateProject(
        { status: 'idle' },
        buildFormData({ id: 'p-1', title: 'T', description: 'D', status: 'draft' }),
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

describe('deleteProject — timing floor (Channel 3)', () => {
  it('does not settle before MIN_DURATION_MS even when the inner helper resolves instantly', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'performance'] });
    try {
      vi.mocked(internal.deleteProjectInternal).mockResolvedValue(undefined);
      let settled = false;
      const p = deleteProject('p-1').then(() => {
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

  it('still pads to MIN_DURATION_MS when the inner helper throws', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'performance'] });
    try {
      vi.mocked(internal.deleteProjectInternal).mockRejectedValue(
        new Error('boom'),
      );
      let settled = false;
      const p = deleteProject('p-1').then(() => {
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
