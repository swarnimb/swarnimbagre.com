import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ZodError, type ZodIssue } from 'zod';
import { GENERIC_FORM_ERROR } from '@/lib/auth-constants';
import { ServiceError } from '@/lib/errors';

/**
 * BLOCKING-01 closure — the `updateNote` and `deleteNote` Server Actions.
 *
 * TS-04 makes a test per data-write operation non-negotiable. Both actions
 * were previously unreached: `tests/admin-notes-mutations.test.ts` stubs the
 * internal helpers in its module mock but only calls `createNote`, and the
 * delete path had no coverage at either layer. This file calls the two
 * exported actions directly; the throwing-helper half lives alongside the
 * other internal-helper cases in `tests/admin-notes-mutations.test.ts`.
 *
 * TS-01 (these actions write user data) requires two error cases each:
 *   - `updateNote`: a generic internal throw mapping to the shared
 *     `GENERIC_FORM_ERROR`, and a `ZodError` mapping to `fieldErrors`.
 *   - `deleteNote`: a generic internal throw, and a `ZodError` — which the
 *     delete wrapper deliberately does NOT special-case, because it owns no
 *     form fields to hang a message on.
 *
 * The auth-guard rejection branch is covered separately and is not repeated
 * here.
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

// The wrappers call the real `assertAdminSession`, which resolves a
// request-scoped Supabase client via `next/headers` and throws outside a
// request context. Stubbing it keeps these cases about the envelope shape.
vi.mock('@/lib/session', async () => {
  const real = await vi.importActual<typeof import('@/lib/session')>(
    '@/lib/session',
  );
  return { ...real, assertAdminSession: vi.fn() };
});

const internal = await import('@/lib/admin-notes-mutations-internal');
const { assertAdminSession } = await import('@/lib/session');
const { updateNote, deleteNote } = await import('@/lib/admin-notes-mutations');

function buildFormData(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

/** A complete, valid edit submission. Individual cases override one key. */
function validEditForm(overrides: Record<string, string> = {}): FormData {
  return buildFormData({
    id: 'note-1',
    kicker: 'Currently',
    line: 'Rewriting the same paragraph for the fourth time.',
    sort_order: '3',
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
  // without consuming real wall time.
  vi.useFakeTimers({ toFake: ['setTimeout', 'performance'] });
  vi.mocked(assertAdminSession).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.resetAllMocks();
  vi.useRealTimers();
});

describe('updateNote — saving an edit', () => {
  it('reports success when the row is written', async () => {
    vi.mocked(internal.updateNoteInternal).mockResolvedValue({} as never);

    const p = updateNote({ status: 'idle' }, validEditForm());
    await vi.advanceTimersByTimeAsync(1000);

    await expect(p).resolves.toEqual({ status: 'ok' });
  });

  it('forwards the row id from the hidden field and the edited fields alongside it', async () => {
    vi.mocked(internal.updateNoteInternal).mockResolvedValue({} as never);

    const p = updateNote(
      { status: 'idle' },
      validEditForm({ id: 'note-42', kicker: 'Reading', line: 'Nothing.' }),
    );
    await vi.advanceTimersByTimeAsync(1000);
    await p;

    const [id, payload] = vi.mocked(internal.updateNoteInternal).mock.calls[0];
    expect(id).toBe('note-42');
    expect(payload).toEqual({
      kicker: 'Reading',
      line: 'Nothing.',
      sort_order: 3,
    });
  });

  it('leaves the rank out of the payload when the rank field is submitted blank', async () => {
    vi.mocked(internal.updateNoteInternal).mockResolvedValue({} as never);

    const p = updateNote({ status: 'idle' }, validEditForm({ sort_order: '' }));
    await vi.advanceTimersByTimeAsync(1000);
    await p;

    const payload = vi.mocked(internal.updateNoteInternal).mock
      .calls[0][1] as Record<string, unknown>;
    // Blank means "do not change the rank", which the helper expresses by
    // omitting the key from the write rather than resetting it to 0.
    expect(payload.sort_order).toBeUndefined();
  });

  it('reports the shared save failure message when the write fails, without naming the reason', async () => {
    vi.mocked(internal.updateNoteInternal).mockRejectedValue(
      new ServiceError('updateNote failed', {
        operation: 'updateNote',
        cause: new Error('permission denied for table notes'),
      }),
    );

    const p = updateNote({ status: 'idle' }, validEditForm());
    await vi.advanceTimersByTimeAsync(1000);
    const result = await p;

    expect(result).toEqual({ status: 'error', formError: GENERIC_FORM_ERROR });
    expect(result.formError).not.toContain('permission');
    expect(result.formError).not.toContain('notes');
  });

  it('reports a rejected field back against that field', async () => {
    vi.mocked(internal.updateNoteInternal).mockRejectedValue(
      makeZodError('kicker', 'kicker is required'),
    );

    const p = updateNote({ status: 'idle' }, validEditForm({ kicker: '' }));
    await vi.advanceTimersByTimeAsync(1000);
    const result = await p;

    expect(result).toEqual({
      status: 'error',
      fieldErrors: { kicker: 'kicker is required' },
    });
  });

  it('treats a missing row id as blank so the write is refused rather than aimed at another row', async () => {
    vi.mocked(internal.updateNoteInternal).mockResolvedValue({} as never);
    // A file part rather than a text field: `FormData.get` hands back a File,
    // and the wrapper's `typeof rawId === 'string'` check collapses it to ''.
    const fd = validEditForm();
    fd.set('id', new Blob(['not an id']));

    const p = updateNote({ status: 'idle' }, fd);
    await vi.advanceTimersByTimeAsync(1000);
    await p;

    expect(vi.mocked(internal.updateNoteInternal).mock.calls[0][0]).toBe('');
  });
});

describe('deleteNote — removing a note', () => {
  it('reports success when the row is removed', async () => {
    vi.mocked(internal.deleteNoteInternal).mockResolvedValue(undefined);

    const p = deleteNote('note-1');
    await vi.advanceTimersByTimeAsync(1000);

    await expect(p).resolves.toEqual({ status: 'ok' });
    expect(internal.deleteNoteInternal).toHaveBeenCalledWith('note-1');
  });

  it('reports the shared save failure message when the delete fails, without naming the reason', async () => {
    vi.mocked(internal.deleteNoteInternal).mockRejectedValue(
      new ServiceError('deleteNote failed', {
        operation: 'deleteNote',
        cause: new Error('permission denied for table notes'),
      }),
    );

    const p = deleteNote('note-1');
    await vi.advanceTimersByTimeAsync(1000);
    const result = await p;

    expect(result).toEqual({ status: 'error', formError: GENERIC_FORM_ERROR });
    expect(result.formError).not.toContain('permission');
  });

  it('reports the same message for a rejected id, since delete owns no form field to blame', async () => {
    vi.mocked(internal.deleteNoteInternal).mockRejectedValue(
      makeZodError('kicker', 'kicker is required'),
    );

    const p = deleteNote('');
    await vi.advanceTimersByTimeAsync(1000);
    const result = await p;

    // The delete wrapper has no ZodError branch on purpose: there is no form
    // behind it, so every failure collapses to the one generic message.
    expect(result).toEqual({ status: 'error', formError: GENERIC_FORM_ERROR });
  });
});
