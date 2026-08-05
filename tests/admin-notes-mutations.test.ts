import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GENERIC_FORM_ERROR } from '@/lib/auth-constants';
import { ServiceError } from '@/lib/errors';

/**
 * F-39 acceptance — the admin session guard on the NOTE mutation Server
 * Actions.
 *
 * `assertAdminSession` runs as the first statement inside each wrapper's
 * `try`, so a caller with no verified admin user gets the same
 * `{ status, fieldErrors?, formError? }` envelope as any other failure and
 * the throwing helper is never reached. The wrapper's broader six-channel
 * uniformity is structurally identical to the projects wrapper, already
 * covered in `tests/admin-projects-mutations.uniformity.test.ts`; this file
 * covers the guard branch that is specific to the notes surface.
 */

vi.mock('@/lib/admin-notes-mutations-internal', async () => {
  const real = await vi.importActual<
    typeof import('@/lib/admin-notes-mutations-internal')
  >('@/lib/admin-notes-mutations-internal');
  return {
    ...real,
    createNoteInternal: vi.fn(),
    updateNoteInternal: vi.fn(),
    deleteNoteInternal: vi.fn(),
  };
});

vi.mock('@/lib/session', async () => {
  const real = await vi.importActual<typeof import('@/lib/session')>(
    '@/lib/session',
  );
  return { ...real, assertAdminSession: vi.fn() };
});

const internal = await import('@/lib/admin-notes-mutations-internal');
const { assertAdminSession } = await import('@/lib/session');
const { createNote } = await import('@/lib/admin-notes-mutations');

function buildFormData(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  // Fake timers so each case fast-forwards past the MIN_DURATION_MS floor
  // without consuming real wall time.
  vi.useFakeTimers({ toFake: ['setTimeout', 'performance'] });
  vi.mocked(assertAdminSession).mockResolvedValue(undefined);
  vi.mocked(internal.createNoteInternal).mockResolvedValue({} as never);
});

afterEach(() => {
  vi.resetAllMocks();
  vi.useRealTimers();
});

describe('F-39 — admin session guard on the NOTE wrappers', () => {
  it('resolves with the uniform error envelope and never reaches the internal helper', async () => {
    vi.mocked(assertAdminSession).mockRejectedValue(
      new ServiceError('no admin session', {
        operation: 'assertAdminSession',
      }),
    );
    const p = createNote(
      { status: 'idle' },
      buildFormData({ kicker: 'K', line: 'L', sort_order: '0' }),
    );
    await vi.advanceTimersByTimeAsync(1000);
    const result = await p;
    expect(result).toEqual({ status: 'error', formError: GENERIC_FORM_ERROR });
    expect(internal.createNoteInternal).not.toHaveBeenCalled();
  });

  it('reaches the internal helper when the guard resolves', async () => {
    const p = createNote(
      { status: 'idle' },
      buildFormData({ kicker: 'K', line: 'L', sort_order: '0' }),
    );
    await vi.advanceTimersByTimeAsync(1000);
    await expect(p).resolves.toEqual({ status: 'ok' });
    expect(internal.createNoteInternal).toHaveBeenCalledTimes(1);
  });
});
