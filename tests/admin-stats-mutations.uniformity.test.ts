import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ZodError, type ZodIssue } from 'zod';
import { GENERIC_FORM_ERROR } from '@/lib/auth-constants';
import { ServiceError } from '@/lib/errors';

/**
 * T24 acceptance — Channel 2 (response body shape) uniformity for the
 * STAT mutation Server Actions. The wrapper resolves with the same
 * `{ status, fieldErrors?, formError? }` envelope across every outcome —
 * success, validation failure, and internal throw — so an attacker probing
 * the endpoint cannot distinguish outcomes from the wire-level response
 * shape alone.
 *
 * Mirrors the F-13 wire-shape tests in `tests/auth.test.ts` and the project
 * equivalents in `tests/admin-projects-mutations.uniformity.test.ts`.
 */

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

// F-39: the wrappers now call the real `assertAdminSession`, which resolves a
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
const { insertStat, deleteStat } = await import(
  '@/lib/admin-stats-mutations'
);

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
  // `tests/admin-stats-mutations.timing.test.ts`).
  vi.useFakeTimers({ toFake: ['setTimeout', 'performance'] });
  // Default: the caller holds an admin session. Overridden in the F-39 case.
  vi.mocked(assertAdminSession).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.resetAllMocks();
  vi.useRealTimers();
});

describe('insertStat — Channel 2 (response body shape)', () => {
  it('resolves with status:"ok" (never throws) on internal success', async () => {
    vi.mocked(internal.insertStatInternal).mockResolvedValue({} as never);
    const p = insertStat(
      { status: 'idle' },
      buildFormData({ category: 'C', label: 'L', value: 'V' }),
    );
    await vi.advanceTimersByTimeAsync(1000);
    await expect(p).resolves.toEqual({ status: 'ok' });
  });

  it('resolves with status:"error" + fieldErrors on a ZodError throw', async () => {
    vi.mocked(internal.insertStatInternal).mockRejectedValue(
      makeZodError('category', 'category is required'),
    );
    const p = insertStat(
      { status: 'idle' },
      buildFormData({ category: '', label: 'L', value: 'V' }),
    );
    await vi.advanceTimersByTimeAsync(1000);
    const result = await p;
    expect(result.status).toBe('error');
    expect(result.fieldErrors).toEqual({ category: 'category is required' });
    expect(result.formError).toBeUndefined();
  });

  it('resolves with status:"error" + formError on any non-zod throw', async () => {
    vi.mocked(internal.insertStatInternal).mockRejectedValue(
      new Error('db boom'),
    );
    const p = insertStat(
      { status: 'idle' },
      buildFormData({ category: 'C', label: 'L', value: 'V' }),
    );
    await vi.advanceTimersByTimeAsync(1000);
    const result = await p;
    expect(result.status).toBe('error');
    expect(result.formError).toBeDefined();
    expect(result.fieldErrors).toBeUndefined();
  });
});

describe('deleteStat — Channel 2 (response body shape)', () => {
  it('resolves with status:"ok" (never throws) on internal success', async () => {
    vi.mocked(internal.deleteStatInternal).mockResolvedValue(undefined);
    const p = deleteStat('s-1');
    await vi.advanceTimersByTimeAsync(1000);
    await expect(p).resolves.toEqual({ status: 'ok' });
  });

  it('resolves with uniform error envelope on internal throw', async () => {
    vi.mocked(internal.deleteStatInternal).mockRejectedValue(
      new Error('permission denied'),
    );
    const p = deleteStat('s-1');
    await vi.advanceTimersByTimeAsync(1000);
    const result = await p;
    expect(result.status).toBe('error');
    expect(result.formError).toBeDefined();
    expect(result.formError).not.toContain('permission');
    expect(result.fieldErrors).toBeUndefined();
  });
});

describe('F-39 — admin session guard on the STAT wrappers', () => {
  it('resolves with the uniform error envelope and never reaches the internal helper', async () => {
    vi.mocked(assertAdminSession).mockRejectedValue(
      new ServiceError('no admin session', {
        operation: 'assertAdminSession',
      }),
    );
    const p = insertStat(
      { status: 'idle' },
      buildFormData({ category: 'C', label: 'L', value: 'V' }),
    );
    await vi.advanceTimersByTimeAsync(1000);
    const result = await p;
    expect(result).toEqual({ status: 'error', formError: GENERIC_FORM_ERROR });
    expect(internal.insertStatInternal).not.toHaveBeenCalled();
  });
});
