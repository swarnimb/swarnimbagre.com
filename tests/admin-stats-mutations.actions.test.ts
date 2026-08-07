import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ZodError, type ZodIssue } from 'zod';
import { GENERIC_FORM_ERROR } from '@/lib/auth-constants';
import { ServiceError } from '@/lib/errors';

/**
 * BLOCKING-01 closure — the `updateStat` Server Action.
 *
 * TS-04 makes a test per data-write operation non-negotiable. `updateStat`
 * was added at T46 so the hand-maintained Other-page tiles could be corrected
 * in place, but no test ever called it: it appeared only as a string in the
 * `tests/server-actions-manifest.test.ts` allowlist. Its sibling actions
 * `insertStat` and `deleteStat` are covered in
 * `tests/admin-stats-mutations.uniformity.test.ts`.
 *
 * TS-01 (this action writes user data) requires two error cases: a generic
 * internal throw mapping to the shared `GENERIC_FORM_ERROR`, and a `ZodError`
 * mapping to `fieldErrors`. The hidden-id read is covered too, including the
 * branch where the id arrives as something other than a text field.
 *
 * The auth-guard rejection branch is covered separately and is not repeated
 * here.
 */

vi.mock('@/lib/admin-stats-mutations-internal', async () => {
  const real = await vi.importActual<
    typeof import('@/lib/admin-stats-mutations-internal')
  >('@/lib/admin-stats-mutations-internal');
  return {
    ...real,
    insertStatInternal: vi.fn(),
    updateStatInternal: vi.fn(),
    deleteStatInternal: vi.fn(),
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

const internal = await import('@/lib/admin-stats-mutations-internal');
const { assertAdminSession } = await import('@/lib/session');
const { updateStat } = await import('@/lib/admin-stats-mutations');

function buildFormData(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

/** A complete, valid edit submission. Individual cases override one key. */
function validEditForm(overrides: Record<string, string> = {}): FormData {
  return buildFormData({
    id: 'stat-1',
    category: 'health',
    label: 'sleep hours',
    value: '7.5',
    unit: 'h',
    aside: 'on a good week',
    sort_order: '2',
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
  // `tests/admin-stats-mutations.timing.test.ts`).
  vi.useFakeTimers({ toFake: ['setTimeout', 'performance'] });
  vi.mocked(assertAdminSession).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.resetAllMocks();
  vi.useRealTimers();
});

describe('updateStat — correcting a stat tile in place', () => {
  it('reports success when the row is written', async () => {
    vi.mocked(internal.updateStatInternal).mockResolvedValue({} as never);

    const p = updateStat({ status: 'idle' }, validEditForm());
    await vi.advanceTimersByTimeAsync(1000);

    await expect(p).resolves.toEqual({ status: 'ok' });
  });

  it('forwards the row id from the hidden field and the edited fields alongside it', async () => {
    vi.mocked(internal.updateStatInternal).mockResolvedValue({} as never);

    const p = updateStat({ status: 'idle' }, validEditForm({ id: 'stat-42' }));
    await vi.advanceTimersByTimeAsync(1000);
    await p;

    const [id, payload] = vi.mocked(internal.updateStatInternal).mock.calls[0];
    expect(id).toBe('stat-42');
    expect(payload).toEqual({
      category: 'health',
      label: 'sleep hours',
      value: '7.5',
      unit: 'h',
      aside: 'on a good week',
      sort_order: 2,
    });
  });

  it('leaves the rank out of the payload when the rank field is submitted blank', async () => {
    vi.mocked(internal.updateStatInternal).mockResolvedValue({} as never);

    const p = updateStat({ status: 'idle' }, validEditForm({ sort_order: '' }));
    await vi.advanceTimersByTimeAsync(1000);
    await p;

    const payload = vi.mocked(internal.updateStatInternal).mock
      .calls[0][1] as Record<string, unknown>;
    // Blank means "do not change the rank", which the helper expresses by
    // omitting the key from the write rather than resetting it to 0.
    expect(payload.sort_order).toBeUndefined();
  });

  it('reports the shared save failure message when the write fails, without naming the reason', async () => {
    vi.mocked(internal.updateStatInternal).mockRejectedValue(
      new ServiceError('updateStat failed', {
        operation: 'updateStat',
        cause: new Error('permission denied for table stats'),
      }),
    );

    const p = updateStat({ status: 'idle' }, validEditForm());
    await vi.advanceTimersByTimeAsync(1000);
    const result = await p;

    expect(result).toEqual({ status: 'error', formError: GENERIC_FORM_ERROR });
    expect(result.formError).not.toContain('permission');
    expect(result.formError).not.toContain('stats');
  });

  it('reports a rejected field back against that field', async () => {
    vi.mocked(internal.updateStatInternal).mockRejectedValue(
      makeZodError('aside', 'must be at most 160 characters'),
    );

    const p = updateStat(
      { status: 'idle' },
      validEditForm({ aside: 'x'.repeat(161) }),
    );
    await vi.advanceTimersByTimeAsync(1000);
    const result = await p;

    expect(result).toEqual({
      status: 'error',
      fieldErrors: { aside: 'must be at most 160 characters' },
    });
  });
});

/**
 * The hidden `id` field is the only thing pointing an update at a row, and
 * `FormData.get` can hand back a File as easily as a string. The wrapper
 * collapses anything that is not a string to `''`, which the throwing helper
 * then refuses — so a malformed id can never be silently treated as a valid
 * one, and can never widen the write to a different row.
 */
describe('updateStat — a row id that did not arrive as text', () => {
  it('collapses a non-text id to blank so the write is refused', async () => {
    vi.mocked(internal.updateStatInternal).mockResolvedValue({} as never);
    const fd = validEditForm();
    fd.set('id', new Blob(['not an id']));

    const p = updateStat({ status: 'idle' }, fd);
    await vi.advanceTimersByTimeAsync(1000);
    await p;

    expect(vi.mocked(internal.updateStatInternal).mock.calls[0][0]).toBe('');
  });

  it('collapses a missing id field to blank so the write is refused', async () => {
    vi.mocked(internal.updateStatInternal).mockResolvedValue({} as never);
    const fd = validEditForm();
    fd.delete('id');

    const p = updateStat({ status: 'idle' }, fd);
    await vi.advanceTimersByTimeAsync(1000);
    await p;

    expect(vi.mocked(internal.updateStatInternal).mock.calls[0][0]).toBe('');
  });
});
