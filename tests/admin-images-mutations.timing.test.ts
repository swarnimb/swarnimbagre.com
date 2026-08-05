import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ImageRecord } from '@/lib/types';

/**
 * T25 acceptance — Channel 3 (timing) uniformity for the IMAGE mutation
 * Server Action.
 *
 * Mirrors the F-12 timing test in `tests/auth.test.ts` and the project /
 * post / stat equivalents. The wrapper pads every outcome — success, zod
 * failure, ServiceError throw, Storage error — to `MIN_DURATION_MS = 750`.
 */

/** Mirrors lib/auth-constants.ts::MIN_DURATION_MS. Lock-step with production. */
const MIN_DURATION_MS = 750;

vi.mock('@/lib/admin-images-mutations-internal', async () => {
  const real = await vi.importActual<
    typeof import('@/lib/admin-images-mutations-internal')
  >('@/lib/admin-images-mutations-internal');
  return {
    ...real,
    uploadImageInternal: vi.fn(),
  };
});

// F-39: the wrappers now call the real `assertAdminSession`, which resolves a
// request-scoped Supabase client via `next/headers` and throws outside a
// request context. Stubbing it keeps these cases about the timing floor.
vi.mock('@/lib/session', async () => {
  const real = await vi.importActual<typeof import('@/lib/session')>(
    '@/lib/session',
  );
  return { ...real, assertAdminSession: vi.fn() };
});

const internal = await import('@/lib/admin-images-mutations-internal');
const { assertAdminSession } = await import('@/lib/session');
const { uploadImage } = await import('@/lib/admin-images-mutations');

const SAMPLE_IMAGE: ImageRecord = {
  id: 'img-1',
  bucket_path: 'images/projects/abc/uuid_foo.jpg',
  alt_text: 'kitten',
  parent_id: '11111111-1111-4111-8111-111111111111',
  parent_type: 'projects',
  created_at: '2026-05-13T00:00:00.000Z',
};

afterEach(() => {
  vi.resetAllMocks();
});

beforeEach(() => {
  // Default stubs — overridden per case below.
  vi.mocked(assertAdminSession).mockResolvedValue(undefined);
  vi.mocked(internal.uploadImageInternal).mockResolvedValue(SAMPLE_IMAGE);
});

function buildFormData(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

describe('uploadImage — timing floor (Channel 3)', () => {
  it('does not settle before MIN_DURATION_MS even when the inner helper resolves instantly', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'performance'] });
    try {
      vi.mocked(internal.uploadImageInternal).mockResolvedValue(SAMPLE_IMAGE);
      let settled = false;
      const p = uploadImage(
        { status: 'idle' },
        buildFormData({
          parentType: 'projects',
          parentId: SAMPLE_IMAGE.parent_id ?? '',
          altText: 'kitten',
        }),
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
      vi.mocked(internal.uploadImageInternal).mockRejectedValue(
        new Error('boom'),
      );
      let settled = false;
      const p = uploadImage(
        { status: 'idle' },
        buildFormData({
          parentType: 'projects',
          parentId: SAMPLE_IMAGE.parent_id ?? '',
          altText: 'kitten',
        }),
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
