import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * TS-04 (unit) — `lib/auth.ts::signOut` Server Action.
 *
 * Asserts the three contract dimensions auth-flow.md §2a fixes:
 *   1. Happy path  — clears the Supabase session, then redirects to /admin/login.
 *   2. Timing floor — pads the wall-clock duration to MIN_DURATION_MS = 750ms
 *                     regardless of how fast the underlying Supabase call returns.
 *                     Closes the same single-probe oracle F-12 closes for the
 *                     magic-link send.
 *   3. Error path — when supabase.auth.signOut rejects, the action still
 *                   redirects (channel-2 wire-shape uniformity), still pads,
 *                   and does NOT re-log (mirrors signInWithMagicLink — a
 *                   `console.error` on the catch path is itself a side-effect
 *                   with measurable cost and reopens the F-12 timing oracle).
 *
 * Mocking strategy mirrors `tests/auth.test.ts` (lines 1-46):
 *   - `vi.mock('@/lib/supabase')` — swap the SSR client factory for a stub.
 *   - `vi.mock('next/navigation')` — `redirect()` normally throws an
 *     internal Next exception; the mock turns it into a plain spy so the
 *     test can observe the call shape without a thrown control-flow signal
 *     leaking out of the action.
 *   - Fake timers with `toFake: ['setTimeout', 'performance']` — production
 *     code uses `performance.now()` for the elapsed-time math (mirrors
 *     signInWithMagicLink). Same shape as the F-12 timing assertion in
 *     `tests/auth.test.ts`.
 *   - `vi.spyOn(console, 'error')` to assert the silent-catch discipline
 *     (no log on either success or failure path).
 */

/** Mirrors lib/auth-constants.ts::MIN_DURATION_MS. Lock-step with production. */
const MIN_DURATION_MS = 750;

vi.mock('@/lib/supabase', () => ({
  createServerClient: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

const { createServerClient } = await import('@/lib/supabase');
const { redirect } = await import('next/navigation');
const { signOut } = await import('@/lib/auth');

/** Build a Supabase auth stub whose `signOut` resolves or rejects on demand. */
function makeAuthStub(opts: { throws?: unknown } = {}) {
  return {
    auth: {
      signOut: opts.throws
        ? vi.fn().mockRejectedValue(opts.throws)
        : vi.fn().mockResolvedValue({ error: null }),
    },
  };
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn> | undefined;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.resetAllMocks();
  consoleErrorSpy?.mockRestore();
});

describe('signOut — happy path', () => {
  it('calls supabase.auth.signOut() exactly once and then redirects to /admin/login', async () => {
    const stub = makeAuthStub();
    vi.mocked(createServerClient).mockResolvedValueOnce(
      stub as unknown as Awaited<ReturnType<typeof createServerClient>>,
    );

    await signOut();

    expect(stub.auth.signOut).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledWith('/admin/login');
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});

describe('signOut — timing floor (channel-3 uniformity)', () => {
  /**
   * Mirrors the F-12 timing test in `tests/auth.test.ts` (lines 185-231).
   * Faking `performance` because the production code reads `performance.now()`
   * for the elapsed-time math (mirrors signInWithMagicLink).
   */
  it('does not settle before MIN_DURATION_MS even when supabase.auth.signOut resolves instantly', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'performance'] });
    try {
      const stub = makeAuthStub();
      vi.mocked(createServerClient).mockResolvedValueOnce(
        stub as unknown as Awaited<ReturnType<typeof createServerClient>>,
      );

      let settled = false;
      const p = signOut().then(() => {
        settled = true;
      });

      // Advance up to 1ms before the bound — the action must still be pending.
      await vi.advanceTimersByTimeAsync(MIN_DURATION_MS - 1);
      expect(settled).toBe(false);

      // Cross the bound — the setTimeout fires and the action resolves.
      await vi.advanceTimersByTimeAsync(1);
      await p;
      expect(settled).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('signOut — error path (channel-2 wire-shape uniformity)', () => {
  it('redirects to /admin/login when supabase.auth.signOut rejects (does NOT propagate the throw)', async () => {
    const stub = makeAuthStub({ throws: new Error('network down') });
    vi.mocked(createServerClient).mockResolvedValueOnce(
      stub as unknown as Awaited<ReturnType<typeof createServerClient>>,
    );

    await expect(signOut()).resolves.toBeUndefined();

    expect(stub.auth.signOut).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledWith('/admin/login');
  });

  it('does NOT log on the failure path (mirrors signInWithMagicLink F-12 discipline)', async () => {
    const stub = makeAuthStub({ throws: new Error('network down') });
    vi.mocked(createServerClient).mockResolvedValueOnce(
      stub as unknown as Awaited<ReturnType<typeof createServerClient>>,
    );

    await signOut();

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('still pads to MIN_DURATION_MS when supabase.auth.signOut rejects', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'performance'] });
    try {
      const stub = makeAuthStub({ throws: new Error('boom') });
      vi.mocked(createServerClient).mockResolvedValueOnce(
        stub as unknown as Awaited<ReturnType<typeof createServerClient>>,
      );

      let settled = false;
      const p = signOut().then(() => {
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
