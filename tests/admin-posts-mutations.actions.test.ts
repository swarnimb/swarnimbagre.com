import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ZodError, type ZodIssue } from 'zod';
import { GENERIC_FORM_ERROR } from '@/lib/auth-constants';
import { ServiceError } from '@/lib/errors';

/**
 * BLOCKING-01 closure — the `updatePost` and `deletePost` Server Actions.
 *
 * TS-04 makes a test per data-write operation non-negotiable, and both of
 * these exported actions were previously reached by no test at all: the
 * sibling `tests/admin-posts-mutations.uniformity.test.ts` stubs them in its
 * module mock but only ever calls `createPost`, and
 * `tests/admin-posts-mutations.test.ts` exercises the throwing helpers a
 * layer below. This file calls the two exported actions directly.
 *
 * TS-01 (these actions write user data) requires two error cases each:
 *   - `updatePost`: a generic internal throw mapping to the shared
 *     `GENERIC_FORM_ERROR`, and a `ZodError` mapping to `fieldErrors`.
 *   - `deletePost`: a generic internal throw, and a `ZodError` — which the
 *     delete wrapper deliberately does NOT special-case, because it owns no
 *     form fields to hang a message on.
 *
 * The auth-guard rejection branch is covered separately and is not repeated
 * here.
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

// The wrappers call the real `assertAdminSession`, which resolves a
// request-scoped Supabase client via `next/headers` and throws outside a
// request context. Stubbing it keeps these cases about the envelope shape.
vi.mock('@/lib/session', async () => {
  const real = await vi.importActual<typeof import('@/lib/session')>(
    '@/lib/session',
  );
  return { ...real, assertAdminSession: vi.fn() };
});

const internal = await import('@/lib/admin-posts-mutations-internal');
const { assertAdminSession } = await import('@/lib/session');
const { updatePost, deletePost } = await import('@/lib/admin-posts-mutations');

function buildFormData(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

/** A complete, valid edit submission. Individual cases override one key. */
function validEditForm(overrides: Record<string, string> = {}): FormData {
  return buildFormData({
    id: 'post-1',
    title: 'Renamed',
    content: '# body',
    status: 'draft',
    image_id: '',
    ...overrides,
  });
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
  // Fake timers so each case fast-forwards past the MIN_DURATION_MS floor
  // without consuming real wall time (the floor itself is covered by
  // `tests/admin-posts-mutations.timing.test.ts`).
  vi.useFakeTimers({ toFake: ['setTimeout', 'performance'] });
  vi.mocked(assertAdminSession).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.resetAllMocks();
  vi.useRealTimers();
});

describe('updatePost — saving an edit', () => {
  it('reports success when the row is written', async () => {
    vi.mocked(internal.updatePostInternal).mockResolvedValue({} as never);

    const p = updatePost({ status: 'idle' }, validEditForm());
    await vi.advanceTimersByTimeAsync(1000);

    await expect(p).resolves.toEqual({ status: 'ok' });
  });

  it('forwards the row id from the hidden field and the edited fields alongside it', async () => {
    vi.mocked(internal.updatePostInternal).mockResolvedValue({} as never);

    const p = updatePost(
      { status: 'idle' },
      validEditForm({ id: 'post-42', title: 'Renamed', content: '# body' }),
    );
    await vi.advanceTimersByTimeAsync(1000);
    await p;

    const [id, payload] = vi.mocked(internal.updatePostInternal).mock.calls[0];
    expect(id).toBe('post-42');
    expect(payload).toEqual({
      title: 'Renamed',
      content: '# body',
      status: 'draft',
      // An empty `image_id` field means "no image attached"; the wrapper
      // normalises it to null before the schema sees it.
      image_id: null,
    });
  });

  it('passes an attached image id through as the trimmed uuid string', async () => {
    vi.mocked(internal.updatePostInternal).mockResolvedValue({} as never);
    const imageId = '11111111-2222-3333-4444-555555555555';

    const p = updatePost({ status: 'idle' }, validEditForm({ image_id: ` ${imageId} ` }));
    await vi.advanceTimersByTimeAsync(1000);
    await p;

    const payload = vi.mocked(internal.updatePostInternal).mock
      .calls[0][1] as Record<string, unknown>;
    expect(payload.image_id).toBe(imageId);
  });

  it('reports the shared save failure message when the write fails, without naming the reason', async () => {
    vi.mocked(internal.updatePostInternal).mockRejectedValue(
      new ServiceError('updatePost failed', {
        operation: 'updatePost',
        cause: new Error('permission denied for table posts'),
      }),
    );

    const p = updatePost({ status: 'idle' }, validEditForm());
    await vi.advanceTimersByTimeAsync(1000);
    const result = await p;

    expect(result).toEqual({ status: 'error', formError: GENERIC_FORM_ERROR });
    expect(result.formError).not.toContain('permission');
    expect(result.formError).not.toContain('posts');
  });

  it('reports a rejected field back against that field', async () => {
    vi.mocked(internal.updatePostInternal).mockRejectedValue(
      makeZodError('title', 'title is required'),
    );

    const p = updatePost({ status: 'idle' }, validEditForm({ title: '' }));
    await vi.advanceTimersByTimeAsync(1000);
    const result = await p;

    expect(result).toEqual({
      status: 'error',
      fieldErrors: { title: 'title is required' },
    });
  });

  it('treats a missing row id as blank so the write is refused rather than aimed at another row', async () => {
    vi.mocked(internal.updatePostInternal).mockResolvedValue({} as never);
    // A file part rather than a text field: `FormData.get` hands back a File,
    // and the wrapper's `typeof rawId === 'string'` check collapses it to ''.
    const fd = validEditForm();
    fd.set('id', new Blob(['not an id']));

    const p = updatePost({ status: 'idle' }, fd);
    await vi.advanceTimersByTimeAsync(1000);
    await p;

    expect(vi.mocked(internal.updatePostInternal).mock.calls[0][0]).toBe('');
  });
});

describe('deletePost — removing a post', () => {
  it('reports success when the row is removed', async () => {
    vi.mocked(internal.deletePostInternal).mockResolvedValue(undefined);

    const p = deletePost('post-1');
    await vi.advanceTimersByTimeAsync(1000);

    await expect(p).resolves.toEqual({ status: 'ok' });
    expect(internal.deletePostInternal).toHaveBeenCalledWith('post-1');
  });

  it('reports the shared save failure message when the delete fails, without naming the reason', async () => {
    vi.mocked(internal.deletePostInternal).mockRejectedValue(
      new ServiceError('deletePost failed', {
        operation: 'deletePost',
        cause: new Error('permission denied for table posts'),
      }),
    );

    const p = deletePost('post-1');
    await vi.advanceTimersByTimeAsync(1000);
    const result = await p;

    expect(result).toEqual({ status: 'error', formError: GENERIC_FORM_ERROR });
    expect(result.formError).not.toContain('permission');
  });

  it('reports the same message for a rejected id, since delete owns no form field to blame', async () => {
    vi.mocked(internal.deletePostInternal).mockRejectedValue(
      makeZodError('title', 'title is required'),
    );

    const p = deletePost('');
    await vi.advanceTimersByTimeAsync(1000);
    const result = await p;

    // The delete wrapper has no ZodError branch on purpose: there is no form
    // behind it, so every failure collapses to the one generic message.
    expect(result).toEqual({ status: 'error', formError: GENERIC_FORM_ERROR });
  });
});
