import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ZodError, type ZodIssue } from 'zod';
import { ServiceError } from '@/lib/errors';
import type { ImageRecord } from '@/lib/types';

/**
 * T25 acceptance — Channel 2 (response body shape) uniformity for the
 * IMAGE mutation Server Action. The wrapper resolves with the same
 * `{ status, fieldErrors?, formError?, image? }` envelope across every
 * outcome — success (with `image` payload), validation failure, and internal
 * throw — so an attacker probing the endpoint cannot distinguish outcomes
 * from the wire-level response shape alone.
 *
 * Mirrors the F-13 wire-shape tests in `tests/auth.test.ts` and the
 * project / post / stat equivalents.
 *
 * Channel 1 leak guard: this test also asserts that the formError string on
 * non-zod throws is the cross-resource generic — never the helper's
 * specific reason ("storage", "size limit", "svg", etc.).
 */

vi.mock('@/lib/admin-images-mutations-internal', async () => {
  const real = await vi.importActual<
    typeof import('@/lib/admin-images-mutations-internal')
  >('@/lib/admin-images-mutations-internal');
  return {
    ...real,
    uploadImageInternal: vi.fn(),
  };
});

const internal = await import('@/lib/admin-images-mutations-internal');
const { uploadImage } = await import('@/lib/admin-images-mutations');

function buildFormData(entries: Record<string, string | Blob>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

/** Build a minimal ZodError so the wrapper's branch is exercised without
 * real zod parsing. */
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

const SAMPLE_IMAGE: ImageRecord = {
  id: 'img-1',
  bucket_path: 'images/projects/abc/uuid_foo.jpg',
  alt_text: 'kitten',
  parent_id: '11111111-1111-4111-8111-111111111111',
  parent_type: 'projects',
  created_at: '2026-05-13T00:00:00.000Z',
};

beforeEach(() => {
  // Use fake timers so each case fast-forwards past the MIN_DURATION_MS
  // floor without consuming real wall time (the timing floor itself is
  // covered by `tests/admin-images-mutations.timing.test.ts`).
  vi.useFakeTimers({ toFake: ['setTimeout', 'performance'] });
});

afterEach(() => {
  vi.resetAllMocks();
  vi.useRealTimers();
});

describe('uploadImage — Channel 2 (response body shape)', () => {
  it('resolves with status:"ok" and image payload on internal success', async () => {
    vi.mocked(internal.uploadImageInternal).mockResolvedValue(SAMPLE_IMAGE);
    const p = uploadImage(
      { status: 'idle' },
      buildFormData({
        parentType: 'projects',
        parentId: SAMPLE_IMAGE.parent_id ?? '',
        altText: 'kitten',
      }),
    );
    await vi.advanceTimersByTimeAsync(1000);
    await expect(p).resolves.toEqual({ status: 'ok', image: SAMPLE_IMAGE });
  });

  it('resolves with status:"error" + fieldErrors on a ZodError throw', async () => {
    vi.mocked(internal.uploadImageInternal).mockRejectedValue(
      makeZodError('altText', 'alt text is required'),
    );
    const p = uploadImage(
      { status: 'idle' },
      buildFormData({
        parentType: 'projects',
        parentId: SAMPLE_IMAGE.parent_id ?? '',
        altText: '',
      }),
    );
    await vi.advanceTimersByTimeAsync(1000);
    const result = await p;
    expect(result.status).toBe('error');
    expect(result.fieldErrors).toEqual({ altText: 'alt text is required' });
    expect(result.formError).toBeUndefined();
    expect(result.image).toBeUndefined();
  });

  it('resolves with status:"error" + generic formError on any non-zod throw (no content leak)', async () => {
    vi.mocked(internal.uploadImageInternal).mockRejectedValue(
      new ServiceError('uploadImage upload failed', {
        operation: 'uploadImage',
        cause: new Error('storage 5xx — file exceeds 2MB svg whatever'),
      }),
    );
    const p = uploadImage(
      { status: 'idle' },
      buildFormData({
        parentType: 'projects',
        parentId: SAMPLE_IMAGE.parent_id ?? '',
        altText: 'kitten',
      }),
    );
    await vi.advanceTimersByTimeAsync(1000);
    const result = await p;
    expect(result.status).toBe('error');
    expect(result.formError).toBeDefined();
    expect(result.fieldErrors).toBeUndefined();
    expect(result.image).toBeUndefined();
    // Channel 1 leak guard — formError must not contain helper-specific
    // reason strings. CONSTRAINT-13 + auth-flow.md §2a Channel 1.
    const lowered = result.formError?.toLowerCase() ?? '';
    expect(lowered).not.toContain('2mb');
    expect(lowered).not.toContain('storage');
    expect(lowered).not.toContain('svg');
    expect(lowered).not.toContain('size limit');
  });
});
