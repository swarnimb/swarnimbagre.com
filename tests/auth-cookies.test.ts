import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * F-15 regression — the Supabase SSR client must be constructed with
 * `flowType: 'implicit'` so `signInWithOtp` does not write a
 * `*-code-verifier` PKCE cookie on the call-Supabase branch of
 * `signInWithMagicLink`. With the default PKCE flow, the verifier cookie's
 * presence distinguishes the allowlisted path (Supabase called, cookie set)
 * from the throw-and-skip path (Supabase never reached, no cookie) at the
 * HTTP-header level — a single-probe enumeration oracle orthogonal to F-12
 * (timing) and F-13 (body shape). See `docs/security-report.md` audit 3.
 *
 * The test mocks `@supabase/ssr` directly (not `@/lib/supabase`) so the real
 * `createServerClient` factory in `lib/supabase.ts` runs end-to-end — that is
 * the code path whose `auth.flowType` setting we are asserting on. It also
 * captures every cookie operation routed through `next/headers` cookies()
 * adapter the factory wires up, so we can assert that the SSR client never
 * asks the wrapper to write a `code-verifier` cookie on any code path.
 *
 * The second describe block covers the cookie adapter itself (TS-04 token
 * refresh): `lib/supabase.ts:43-54` is the hop that carries refreshed session
 * cookies from Supabase into the request's cookie store, and its `setAll` is
 * only reached when something drives it.
 */

const SITE_URL = 'https://example.test';
const ALLOWED_EMAIL = 'allowed@example.test';

/** Cookie name Supabase writes under the PKCE flow that F-15 replaced. */
const VERIFIER_COOKIE = 'sb-stub-auth-token-code-verifier';

/** One cookie as `@supabase/ssr` hands it to the adapter's `setAll`. */
type CookieToSet = {
  name: string;
  value: string;
  options?: Record<string, unknown>;
};

/** The subset of the SSR client options the factory builds that we read here. */
type SSRClientOptions = {
  auth?: { flowType?: string };
  cookies?: {
    getAll: () => Array<{ name: string; value: string }>;
    setAll: (cookiesToSet: CookieToSet[]) => void;
  };
};

/** Records every cookie set on the request-scoped cookie store. */
const cookieSetCalls: Array<{
  name: string;
  value: string;
  options?: unknown;
}> = [];

/** Cookies the mocked store reports from `getAll()`. Seeded per test. */
const cookieStoreSeed: Array<{ name: string; value: string }> = [];

/**
 * When true the mocked store's `set` throws, standing in for the read-only
 * cookie store a Server Component gets. `lib/supabase.ts` swallows that.
 */
const cookieStoreState = { readOnly: false };

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    getAll: () => cookieStoreSeed.map((cookie) => ({ ...cookie })),
    set: (name: string, value: string, options?: unknown) => {
      if (cookieStoreState.readOnly) {
        throw new Error(
          'Cookies can only be modified in a Server Action or Route Handler',
        );
      }
      cookieSetCalls.push({ name, value, options });
    },
  })),
}));

/**
 * Mock `@supabase/ssr` so the SSR helper's construction options are
 * observable and the auth API is a stub. The mocked `createServerClient`
 * stashes the options object so the test can assert `auth.flowType`.
 *
 * The mocked `signInWithOtp` reproduces the wire behaviour F-15 is about: it
 * routes a `*-code-verifier` cookie through the adapter it was handed unless
 * the client was built with `flowType: 'implicit'`. That is what real
 * `@supabase/ssr` does — PKCE persists a verifier on the call-Supabase branch,
 * implicit has none to persist.
 *
 * This behaviour is load-bearing. An earlier version of this stub never
 * touched the adapter at all, so the "no verifier cookie" assertions below
 * were filtering an array nothing could ever fill — they held for any
 * `flowType`, including the PKCE regression they exist to catch. Only the
 * call-Supabase path can produce the cookie, so that is the assertion the stub
 * arms; the two skip-Supabase paths never reach `signInWithOtp` at all, and
 * the difference between the two is what the head-to-head test asserts.
 */
const capturedOptions: { value: unknown } = { value: null };

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn((_url: string, _key: string, options: unknown) => {
    capturedOptions.value = options;
    const opts = options as SSRClientOptions;
    return {
      auth: {
        signInWithOtp: vi.fn(async () => {
          if (opts?.auth?.flowType !== 'implicit') {
            opts?.cookies?.setAll([
              {
                name: VERIFIER_COOKIE,
                value: 'fake-pkce-verifier',
                options: { path: '/', httpOnly: true },
              },
            ]);
          }
          return { error: null };
        }),
      },
    };
  }),
  createBrowserClient: vi.fn(),
}));

const { signInWithMagicLink } = await import('@/lib/auth');
const { createServerClient } = await import('@/lib/supabase');

/**
 * Run the production factory and hand back the cookie adapter it wired up, so
 * a test can drive `getAll` / `setAll` directly.
 */
async function buildCookieAdapter() {
  await createServerClient();
  const options = capturedOptions.value as SSRClientOptions | null;
  if (!options?.cookies) {
    throw new Error('createServerClient was built without a cookies adapter');
  }
  return options.cookies;
}

/**
 * Drive one sign-in attempt from a clean recorder and report the names of any
 * `*-code-verifier` cookies it caused to be written.
 */
async function verifierCookiesFor(email: string): Promise<string[]> {
  cookieSetCalls.length = 0;
  await signInWithMagicLink(email);
  return cookieSetCalls
    .filter((c) => c.name.includes('code-verifier'))
    .map((c) => c.name);
}

beforeEach(() => {
  cookieSetCalls.length = 0;
  cookieStoreSeed.length = 0;
  cookieStoreState.readOnly = false;
  capturedOptions.value = null;
  process.env.NEXT_PUBLIC_SITE_URL = SITE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://stub.supabase.test';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'stub-anon-key';
  process.env.ADMIN_ALLOWED_EMAIL = ALLOWED_EMAIL;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  delete process.env.ADMIN_ALLOWED_EMAIL;
});

describe('Supabase SSR client construction — F-15 cookie-channel close', () => {
  it('constructs the SSR client with auth.flowType set to "implicit"', async () => {
    // Trigger a real call through the production createServerClient factory.
    await signInWithMagicLink(ALLOWED_EMAIL);

    const options = capturedOptions.value as
      | { auth?: { flowType?: string } }
      | null;
    expect(options).not.toBeNull();
    expect(options?.auth?.flowType).toBe('implicit');
  });

  /**
   * The load-bearing one: this is the only path that reaches Supabase, so it
   * is the only path where PKCE would emit a verifier cookie. The stub routes
   * one through the real adapter whenever `flowType` is anything but
   * 'implicit', so reverting the F-15 mitigation fails here.
   */
  it('writes no *-code-verifier cookie on the allowlisted (call-Supabase) path', async () => {
    await signInWithMagicLink(ALLOWED_EMAIL);

    const verifierCookies = cookieSetCalls.filter((c) =>
      c.name.includes('code-verifier'),
    );
    expect(verifierCookies).toEqual([]);
  });

  it('writes no *-code-verifier cookie on the not-allowlisted (skip-Supabase) path', async () => {
    await signInWithMagicLink('attacker@evil.example');

    const verifierCookies = cookieSetCalls.filter((c) =>
      c.name.includes('code-verifier'),
    );
    expect(verifierCookies).toEqual([]);
  });

  it('writes no *-code-verifier cookie on the malformed-email (skip-Supabase) path', async () => {
    await signInWithMagicLink('not-an-email');

    const verifierCookies = cookieSetCalls.filter((c) =>
      c.name.includes('code-verifier'),
    );
    expect(verifierCookies).toEqual([]);
  });

  /**
   * The enumeration oracle itself, stated directly. The three tests above each
   * check one path in isolation; F-15 is about the DIFFERENCE between them —
   * under PKCE the allowlisted path writes a verifier cookie and the two
   * skipped paths write nothing, so one probe with one email tells an attacker
   * whether that address is the admin. This asserts the three paths are
   * indistinguishable at the Set-Cookie layer, which is the property the
   * mitigation actually buys.
   */
  it('writes an identical set of verifier cookies whether the email is allowlisted, rejected, or malformed', async () => {
    const allowlisted = await verifierCookiesFor(ALLOWED_EMAIL);
    const notAllowlisted = await verifierCookiesFor('attacker@evil.example');
    const malformed = await verifierCookiesFor('not-an-email');

    expect(allowlisted).toEqual(notAllowlisted);
    expect(allowlisted).toEqual(malformed);
  }, 10_000);

  /**
   * Proof that the assertions above can fail. Takes the cookie adapter
   * the production factory actually built, rebuilds a client on it with the
   * PKCE flow that F-15 replaced, and shows the same recorder those tests read
   * does capture the verifier cookie. Without this, a stub that quietly stopped
   * driving the adapter would turn all three green forever.
   */
  it('records a *-code-verifier cookie when the same adapter is driven under the PKCE flow', async () => {
    const adapter = await buildCookieAdapter();
    const { createServerClient: ssrCreateServerClient } = await import(
      '@supabase/ssr'
    );
    const buildClient = ssrCreateServerClient as unknown as (
      url: string,
      key: string,
      options: SSRClientOptions,
    ) => { auth: { signInWithOtp: () => Promise<{ error: null }> } };

    const pkceClient = buildClient(
      'https://stub.supabase.test',
      'stub-anon-key',
      { auth: { flowType: 'pkce' }, cookies: adapter },
    );
    await pkceClient.auth.signInWithOtp();

    const verifierCookies = cookieSetCalls.filter((c) =>
      c.name.includes('code-verifier'),
    );
    expect(verifierCookies.map((c) => c.name)).toEqual([VERIFIER_COOKIE]);
  });
});

/**
 * TS-04 token refresh. `lib/supabase.ts:43-54` is the adapter that carries a
 * refreshed Supabase session into the request's cookie store. Supabase invokes
 * `setAll` from inside `getUser` / `verifyOtp` when it rotates an expiring
 * token, so nothing in a normal test run touches it unless a test drives it
 * on purpose — which is what these do.
 */
describe('server-client cookie adapter — token refresh (lib/supabase.ts)', () => {
  it('forwards every refreshed cookie to the request cookie store', async () => {
    const adapter = await buildCookieAdapter();

    adapter.setAll([
      { name: 'sb-stub-auth-token.0', value: 'fake-refreshed-chunk-0' },
      { name: 'sb-stub-auth-token.1', value: 'fake-refreshed-chunk-1' },
    ]);

    expect(cookieSetCalls.map((c) => [c.name, c.value])).toEqual([
      ['sb-stub-auth-token.0', 'fake-refreshed-chunk-0'],
      ['sb-stub-auth-token.1', 'fake-refreshed-chunk-1'],
    ]);
  });

  it('passes the cookie attributes through to the store, not just name and value', async () => {
    const adapter = await buildCookieAdapter();

    adapter.setAll([
      {
        name: 'sb-stub-auth-token.0',
        value: 'fake-refreshed-chunk-0',
        options: { path: '/', httpOnly: true, sameSite: 'lax' },
      },
    ]);

    expect(cookieSetCalls[0].options).toEqual({
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
    });
  });

  it('reads the cookies already on the request back through getAll', async () => {
    cookieStoreSeed.push({
      name: 'sb-stub-auth-token.0',
      value: 'fake-existing-chunk-0',
    });
    const adapter = await buildCookieAdapter();

    expect(adapter.getAll()).toEqual([
      { name: 'sb-stub-auth-token.0', value: 'fake-existing-chunk-0' },
    ]);
  });

  /**
   * A Server Component's cookie store is read-only, so `set` throws there.
   * The adapter swallows it deliberately: middleware has already refreshed the
   * session on the same request, so the write is redundant rather than lost.
   * If this ever propagated, every rendered admin page would 500 on the first
   * request after a token rotation.
   */
  it('swallows the write when the cookie store is read-only, as it is in a Server Component', async () => {
    const adapter = await buildCookieAdapter();
    cookieStoreState.readOnly = true;

    expect(() =>
      adapter.setAll([
        { name: 'sb-stub-auth-token.0', value: 'fake-refreshed-chunk-0' },
      ]),
    ).not.toThrow();
    expect(cookieSetCalls).toEqual([]);
  });
});
