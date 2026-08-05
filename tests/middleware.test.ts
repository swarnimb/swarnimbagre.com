// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Functional + security tests for `middleware.ts` — the admin session gate
 * (T18). The gate is now all the middleware does: T46 deleted the
 * device-variant branch and its `x-device-variant` header, and narrowed the
 * matcher to `/admin/:path*`. Runs in the `node` env so `Headers` / `Request`
 * / `Response` match Next's middleware internals (JSDOM polyfills fail the
 * `instanceof Headers` check inside `NextResponse.next({ request })`). Mocks
 * `@supabase/ssr::createServerClient` directly (the middleware imports the SSR
 * helper at the module boundary).
 *
 * The gate verifies the caller with `auth.getUser()`, NOT `auth.getSession()`
 * (F-40, audit 24) — a signature-verifying round trip rather than a local
 * `exp` decode. The stubs below therefore stub `getUser` and resolve its
 * `{ data: { user }, error }` shape; a stub of `getSession` would test nothing.
 *
 * Security focus: SEC-09 six-channel uniformity across the three redirect
 * outcomes (no-session B / error C / throw D) — S1 timing, S2 body, S3
 * status, S4 location, S5 cookies, S6 preserved-target rejection, plus L1
 * log-payload hygiene.
 */

const MIN_DURATION_MS = 750;
const ORIGIN = 'http://localhost:3000';

const supabaseCreateServerClient = vi.fn();
vi.mock('@supabase/ssr', () => ({
  createServerClient: (...args: unknown[]) => supabaseCreateServerClient(...args),
}));

const { middleware } = await import('@/middleware');

/**
 * Configure the mocked `@supabase/ssr::createServerClient` for the next call.
 * Stubs `auth.getUser` — the only auth call the gate makes since F-40 — and
 * resolves the `getUser` response shape `{ data: { user }, error }`.
 * 'present' = verified user, 'none' = null user + no error, 'error' =
 * AuthError, 'throw' = `getUser` rejects.
 *
 * Every fixture carries `should-never-leak-*` token-shaped sentinels. The
 * `getUser` response has no session and therefore no natural token field, so
 * they ride on whichever object the gate could plausibly serialize into a log
 * line: the user, the returned error, and the thrown cause. L1 asserts none of
 * them ever reaches `console.info` / `console.error`.
 */
function mockSupabaseUser(
  behavior: 'present' | 'none' | 'error' | 'throw',
) {
  const make = (): ReturnType<typeof vi.fn> => {
    if (behavior === 'present') {
      return vi.fn().mockResolvedValue({
        data: {
          user: {
            id: 'user-1',
            email: 'allowed@example.test',
            access_token: 'should-never-leak-access',
            refresh_token: 'should-never-leak-refresh',
          },
        },
        error: null,
      });
    }
    if (behavior === 'none') {
      return vi.fn().mockResolvedValue({ data: { user: null }, error: null });
    }
    if (behavior === 'error') {
      return vi.fn().mockResolvedValue({
        data: { user: null },
        error: {
          name: 'AuthApiError',
          message: 'jwt expired',
          access_token: 'should-never-leak-access',
          refresh_token: 'should-never-leak-refresh',
        },
      });
    }
    return vi.fn().mockRejectedValue(
      Object.assign(new Error('network failure to sb-auth-endpoint'), {
        name: 'FetchError',
        access_token: 'should-never-leak-access',
        refresh_token: 'should-never-leak-refresh',
      }),
    );
  };
  const stub = { auth: { getUser: make() } };
  supabaseCreateServerClient.mockImplementationOnce(() => stub);
  return stub;
}

/** Build a NextRequest for the given path with optional headers + cookies. */
function makeRequest(
  path: string,
  init?: { headers?: Record<string, string>; cookieHeader?: string },
): NextRequest {
  const headers = new Headers(init?.headers ?? {});
  if (init?.cookieHeader) headers.set('cookie', init.cookieHeader);
  return new NextRequest(new URL(path, ORIGIN), { headers });
}

let consoleInfoSpy: ReturnType<typeof vi.spyOn> | undefined;
let consoleErrorSpy: ReturnType<typeof vi.spyOn> | undefined;

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://stub.supabase.test';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'stub-anon-key';
  consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.resetAllMocks();
  consoleInfoSpy?.mockRestore();
  consoleErrorSpy?.mockRestore();
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
});

// --- Functional tests (T18 acceptance) -------------------------------------

describe('admin gate — functional (F1-F4)', () => {
  /** F1 — bare gate: no cookies → 307 to /admin/login, no query string. Outcome B. */
  it('F1: GET /admin with no cookies redirects to /admin/login (307, no query string)', async () => {
    mockSupabaseUser('none');
    const res = await middleware(makeRequest('/admin'));

    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).not.toBeNull();
    expect(location!.endsWith('/admin/login')).toBe(true);
    expect(location).not.toContain('?');
  });

  /** F2 — authenticated pass-through: NextResponse.next() with status 200, no Location. */
  it('F2: GET /admin with a valid session passes through (no redirect)', async () => {
    mockSupabaseUser('present');
    const res = await middleware(makeRequest('/admin'));

    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });

  /** F4 — expired-session outcome (C): redirect + structured info log with path tag. */
  it('F4: GET /admin/posts with an error from getUser redirects + logs "session expired"', async () => {
    mockSupabaseUser('error');
    const res = await middleware(makeRequest('/admin/posts'));

    expect(res.status).toBe(307);
    expect(res.headers.get('location')!.endsWith('/admin/login')).toBe(true);
    expect(await res.text()).toBe('');

    const expiredCalls = consoleInfoSpy!.mock.calls.filter(
      (c) => c[0] === '[auth] admin gate: session expired',
    );
    expect(expiredCalls.length).toBeGreaterThanOrEqual(1);
    expect(expiredCalls[0][1]).toEqual({ path: '/admin/posts' });
  }, 10_000);
});

// --- Public-route preservation (T10 contract — do not regress) -------------

describe('admin gate — public-route preservation (P1-P3)', () => {
  /**
   * P1 — public-route exemption: the marketing root never gets pulled into
   * the gate.
   *
   * T46 removed the device-variant branch and narrowed the matcher to
   * `/admin/*`, so in production this function is no longer invoked for `/`
   * at all. The test is kept as a defence-in-depth assertion: if the matcher
   * is ever widened again, a public path must still fall through untouched
   * rather than hitting the session gate.
   */
  it('P1: GET / does NOT redirect to /admin/login', async () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobi/15E148';
    const res = await middleware(
      makeRequest('/', { headers: { 'user-agent': ua } }),
    );

    expect(res.status).not.toBe(307);
    expect(res.headers.get('location')).toBeNull();
    expect(supabaseCreateServerClient).not.toHaveBeenCalled();
  });

  /** P2 — /admin/login is exempt (gating it would self-trap the login page). */
  it('P2: GET /admin/login does NOT construct the SSR client and does NOT redirect', async () => {
    const res = await middleware(makeRequest('/admin/login'));

    expect(res.status).not.toBe(307);
    expect(res.headers.get('location')).toBeNull();
    expect(supabaseCreateServerClient).not.toHaveBeenCalled();
  });

  /** P3 — callback is exempt (it mints the session, so it cannot require one). */
  it('P3: GET /admin/auth/callback?token_hash=foo&type=email passes through without invoking the gate', async () => {
    const res = await middleware(
      makeRequest('/admin/auth/callback?token_hash=foo&type=email'),
    );

    expect(res.status).not.toBe(307);
    expect(res.headers.get('location')).toBeNull();
    expect(supabaseCreateServerClient).not.toHaveBeenCalled();
  });

  /**
   * F-16 boundary — a request to a subpath BENEATH /admin/login (which itself
   * is exempt) IS gated. This protects against a future contributor adding a
   * route like `/admin/login/recover` and inadvertently shipping it
   * unauthenticated. Pairs with F-18 (audit pass 5).
   */
  it('gates /admin/login/extra (subpath beneath the exemption is NOT exempt)', async () => {
    mockSupabaseUser('none');
    const res = await middleware(makeRequest('/admin/login/extra'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')!.endsWith('/admin/login')).toBe(true);
  });

  /**
   * F-16 boundary (symmetry) — same tightening for the callback exemption: a
   * subpath beneath /admin/auth/callback IS gated. One test per exempted
   * prefix so the boundary is described in both directions. Pairs with F-18
   * (audit pass 5).
   */
  it('gates /admin/auth/callback/extra (subpath beneath the exemption is NOT exempt)', async () => {
    mockSupabaseUser('none');
    const res = await middleware(makeRequest('/admin/auth/callback/extra'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')!.endsWith('/admin/login')).toBe(true);
  });
});

// --- Security: six-channel uniformity (SEC-09) -----------------------------

describe('admin gate — security uniformity (SEC-09)', () => {
  /**
   * S1 — timing-channel close. Fake timers; for each B/C/D outcome assert the
   * middleware does not resolve before MIN_DURATION_MS. Pattern mirrors the
   * F-12 timing test in `tests/auth.test.ts`.
   */
  it('S1: timing — all three redirect outcomes pad to MIN_DURATION_MS', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'Date'] });
    try {
      for (const behavior of ['none', 'error', 'throw'] as const) {
        mockSupabaseUser(behavior);
        let settled = false;
        const p = middleware(makeRequest('/admin')).then(() => {
          settled = true;
        });
        await vi.advanceTimersByTimeAsync(MIN_DURATION_MS - 1);
        expect(settled, `outcome=${behavior}: settled before floor`).toBe(false);
        await vi.advanceTimersByTimeAsync(1);
        await p;
        expect(settled, `outcome=${behavior}: never settled`).toBe(true);
      }
    } finally {
      vi.useRealTimers();
    }
  });

  /** S2 — body parity. A JSON-only-on-error split would re-open F-13 at the gate. */
  it('S2: body uniformity — all three redirect outcomes have empty body and no JSON content-type', async () => {
    for (const behavior of ['none', 'error', 'throw'] as const) {
      mockSupabaseUser(behavior);
      const res = await middleware(makeRequest('/admin'));
      expect(await res.text(), `outcome=${behavior}`).toBe('');
      const ct = res.headers.get('content-type') ?? '';
      expect(ct.includes('application/json'), `outcome=${behavior}`).toBe(false);
    }
  }, 10_000);

  /** S3 — status parity. A 401/302/307 split would be a single-probe oracle. */
  it('S3: status uniformity — all three redirect outcomes return exactly 307', async () => {
    for (const behavior of ['none', 'error', 'throw'] as const) {
      mockSupabaseUser(behavior);
      const res = await middleware(makeRequest('/admin'));
      expect(res.status, `outcome=${behavior}`).toBe(307);
    }
  }, 10_000);

  /** S4 — location parity. No `?reason=...`, no fragment, no preserved path. */
  it('S4: location uniformity — all three redirect outcomes target exactly /admin/login', async () => {
    for (const behavior of ['none', 'error', 'throw'] as const) {
      mockSupabaseUser(behavior);
      const res = await middleware(makeRequest('/admin/posts'));
      const loc = res.headers.get('location');
      expect(loc, `outcome=${behavior}`).not.toBeNull();
      const u = new URL(loc!);
      expect(u.pathname + u.search + u.hash, `outcome=${behavior}`).toBe(
        '/admin/login',
      );
    }
  }, 10_000);

  /** S5 — cookie parity. Differential Set-Cookie would be a wire-level oracle. */
  it('S5: Set-Cookie uniformity — all three redirect outcomes carry an identical (empty) cookie set', async () => {
    const cookieSets: number[] = [];
    for (const behavior of ['none', 'error', 'throw'] as const) {
      mockSupabaseUser(behavior);
      const res = await middleware(makeRequest('/admin'));
      cookieSets.push(res.headers.getSetCookie().length);
    }
    expect(new Set(cookieSets).size, `cookie-set counts = ${cookieSets}`).toBe(1);
    expect(cookieSets[0]).toBe(0);
  }, 10_000);

  /** S6 — preserved-target rejection. ?next= / ?from= must not survive. Open-redirect close. */
  it('S6: ?next= / ?from= query params are NOT propagated into the redirect target', async () => {
    mockSupabaseUser('none');
    const res = await middleware(
      makeRequest('/admin/posts?from=/secret&next=/leaked'),
    );

    const loc = res.headers.get('location');
    expect(loc).not.toBeNull();
    expect(loc).not.toContain('from=');
    expect(loc).not.toContain('next=');
    expect(loc).not.toContain('/secret');
    expect(loc).not.toContain('/leaked');
    expect(loc!.endsWith('/admin/login')).toBe(true);
  });
});

// --- Security: log-payload hygiene -----------------------------------------

describe('admin gate — log-payload security (L1)', () => {
  /**
   * L1 — SEC-05 at the gate. Captures every log payload across all four
   * outcomes — the pass-through (A) included, because since F-40 the verified
   * user object is the only place token-shaped material can enter the gate —
   * and asserts the aggregate string contains no token-shaped substring
   * (access_token / refresh_token / sb- cookie prefix), none of the
   * `should-never-leak-*` sentinels the stubs plant on the user, the returned
   * error and the thrown cause, and no email-shaped string.
   */
  it('L1: no token-shaped strings appear in any console.info or console.error call across A/B/C/D', async () => {
    for (const behavior of ['present', 'none', 'error', 'throw'] as const) {
      mockSupabaseUser(behavior);
      await middleware(makeRequest('/admin/posts'));
    }

    const aggregate = JSON.stringify([
      ...consoleInfoSpy!.mock.calls,
      ...consoleErrorSpy!.mock.calls,
    ]);

    expect(aggregate).not.toContain('access_token');
    expect(aggregate).not.toContain('refresh_token');
    expect(aggregate).not.toContain('should-never-leak');
    expect(aggregate).not.toContain('sb-');
    expect(aggregate).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  }, 10_000);
});
