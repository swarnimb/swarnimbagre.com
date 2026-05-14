import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ZodError, type ZodIssue } from 'zod';

/**
 * T21 acceptance — Channel 2 (response body shape) uniformity for the
 * PROJECT mutation Server Actions. The wrapper resolves with the same
 * `{ status, fieldErrors?, formError? }` envelope across every outcome —
 * success, validation failure, and internal throw — so an attacker probing
 * the endpoint cannot distinguish outcomes from the wire-level response
 * shape alone. The content varies (zod-field errors are reachable by any
 * caller, including legitimate users, so they are not themselves an
 * enumeration channel).
 *
 * Mirrors the F-13 wire-shape tests in `tests/auth.test.ts` (lines 158-183).
 */

vi.mock('@/lib/admin-projects-mutations-internal', async () => {
  const real = await vi.importActual<
    typeof import('@/lib/admin-projects-mutations-internal')
  >('@/lib/admin-projects-mutations-internal');
  return {
    ...real,
    createProjectInternal: vi.fn(),
    updateProjectInternal: vi.fn(),
    deleteProjectInternal: vi.fn(),
  };
});

const internal = await import('@/lib/admin-projects-mutations-internal');
const { createProject, updateProject, deleteProject } = await import(
  '@/lib/admin-projects-mutations'
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
  // `tests/admin-projects-mutations.timing.test.ts`).
  vi.useFakeTimers({ toFake: ['setTimeout', 'performance'] });
});

afterEach(() => {
  vi.resetAllMocks();
  vi.useRealTimers();
});

describe('createProject — Channel 2 (response body shape)', () => {
  it('resolves with status:"ok" (never throws) on internal success', async () => {
    vi.mocked(internal.createProjectInternal).mockResolvedValue({} as never);
    const p = createProject(
      { status: 'idle' },
      buildFormData({ title: 'T', description: 'D', status: 'draft' }),
    );
    await vi.advanceTimersByTimeAsync(1000);
    await expect(p).resolves.toEqual({ status: 'ok' });
  });

  it('resolves with status:"error" + fieldErrors on a ZodError throw', async () => {
    vi.mocked(internal.createProjectInternal).mockRejectedValue(
      makeZodError('title', 'title is required'),
    );
    const p = createProject(
      { status: 'idle' },
      buildFormData({ title: '', description: 'D', status: 'draft' }),
    );
    await vi.advanceTimersByTimeAsync(1000);
    const result = await p;
    expect(result.status).toBe('error');
    expect(result.fieldErrors).toEqual({ title: 'title is required' });
    expect(result.formError).toBeUndefined();
  });

  it('resolves with status:"error" + formError on any non-zod throw', async () => {
    vi.mocked(internal.createProjectInternal).mockRejectedValue(new Error('db boom'));
    const p = createProject(
      { status: 'idle' },
      buildFormData({ title: 'T', description: 'D', status: 'draft' }),
    );
    await vi.advanceTimersByTimeAsync(1000);
    const result = await p;
    expect(result.status).toBe('error');
    expect(result.formError).toBeDefined();
    expect(result.fieldErrors).toBeUndefined();
  });
});

describe('updateProject — Channel 2 (response body shape)', () => {
  it('resolves with status:"ok" (never throws) on internal success', async () => {
    vi.mocked(internal.updateProjectInternal).mockResolvedValue({} as never);
    const p = updateProject(
      { status: 'idle' },
      buildFormData({ id: 'p-1', title: 'T', description: 'D', status: 'draft' }),
    );
    await vi.advanceTimersByTimeAsync(1000);
    await expect(p).resolves.toEqual({ status: 'ok' });
  });

  it('resolves with status:"error" + formError on any non-zod throw (e.g., trigger raise)', async () => {
    vi.mocked(internal.updateProjectInternal).mockRejectedValue(
      new Error('slug is locked on published rows'),
    );
    const p = updateProject(
      { status: 'idle' },
      buildFormData({ id: 'p-pub', title: 'T', description: 'D', status: 'published' }),
    );
    await vi.advanceTimersByTimeAsync(1000);
    const result = await p;
    expect(result.status).toBe('error');
    expect(result.formError).toBeDefined();
    // The generic form error must not leak the underlying reason (CONSTRAINT-13).
    expect(result.formError).not.toContain('slug');
  });
});

describe('deleteProject — Channel 2 (response body shape)', () => {
  it('resolves with status:"ok" (never throws) on internal success', async () => {
    vi.mocked(internal.deleteProjectInternal).mockResolvedValue(undefined);
    const p = deleteProject('p-1');
    await vi.advanceTimersByTimeAsync(1000);
    await expect(p).resolves.toEqual({ status: 'ok' });
  });

  it('resolves with uniform error envelope on internal throw', async () => {
    vi.mocked(internal.deleteProjectInternal).mockRejectedValue(
      new Error('permission denied'),
    );
    const p = deleteProject('p-1');
    await vi.advanceTimersByTimeAsync(1000);
    const result = await p;
    expect(result.status).toBe('error');
    expect(result.formError).toBeDefined();
    // The generic form error must not leak the underlying reason (CONSTRAINT-13).
    expect(result.formError).not.toContain('permission');
    expect(result.fieldErrors).toBeUndefined();
  });
});
