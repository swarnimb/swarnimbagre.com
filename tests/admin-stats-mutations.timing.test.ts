import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * T24 acceptance — Channel 3 (timing) uniformity for STAT mutation Server
 * Actions.
 *
 * Mirrors the F-12 timing test in `tests/auth.test.ts` and the project
 * equivalents in `tests/admin-projects-mutations.timing.test.ts`. The
 * wrapper pads every outcome — success, zod failure, ServiceError throw,
 * DB error — to `MIN_DURATION_MS = 750`.
 */

/** Mirrors lib/auth-constants.ts::MIN_DURATION_MS. Lock-step with production. */
const MIN_DURATION_MS = 750;

vi.mock('@/lib/admin-stats-mutations-internal', async () => {
  const real = await vi.importActual<
    typeof import('@/lib/admin-stats-mutations-internal')
  >('@/lib/admin-stats-mutations-internal');
  return {
    ...real,
    insertStatInternal: vi.fn(),
    deleteStatInternal: vi.fn(),
  };
});

const internal = await import('@/lib/admin-stats-mutations-internal');
const { insertStat, deleteStat } = await import(
  '@/lib/admin-stats-mutations'
);

afterEach(() => {
  vi.resetAllMocks();
});

beforeEach(() => {
  // Default stubs — overridden per case below.
  vi.mocked(internal.insertStatInternal).mockResolvedValue({} as never);
  vi.mocked(internal.deleteStatInternal).mockResolvedValue(undefined);
});

function buildFormData(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

describe('insertStat — timing floor (Channel 3)', () => {
  it('does not settle before MIN_DURATION_MS even when the inner helper resolves instantly', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'performance'] });
    try {
      vi.mocked(internal.insertStatInternal).mockResolvedValue({} as never);
      let settled = false;
      const p = insertStat(
        { status: 'idle' },
        buildFormData({ category: 'C', label: 'L', value: 'V' }),
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
      vi.mocked(internal.insertStatInternal).mockRejectedValue(
        new Error('boom'),
      );
      let settled = false;
      const p = insertStat(
        { status: 'idle' },
        buildFormData({ category: 'C', label: 'L', value: 'V' }),
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

describe('deleteStat — timing floor (Channel 3)', () => {
  it('does not settle before MIN_DURATION_MS even when the inner helper resolves instantly', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'performance'] });
    try {
      vi.mocked(internal.deleteStatInternal).mockResolvedValue(undefined);
      let settled = false;
      const p = deleteStat('s-1').then(() => {
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
      vi.mocked(internal.deleteStatInternal).mockRejectedValue(
        new Error('boom'),
      );
      let settled = false;
      const p = deleteStat('s-1').then(() => {
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
