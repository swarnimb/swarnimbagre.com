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
 */

const SITE_URL = 'https://example.test';
const ALLOWED_EMAIL = 'allowed@example.test';

/** Records every cookie set on the request-scoped cookie store. */
const cookieSetCalls: Array<{ name: string; value: string }> = [];

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    getAll: () => [],
    set: (name: string, value: string) => {
      cookieSetCalls.push({ name, value });
    },
  })),
}));

/**
 * Mock `@supabase/ssr` so the SSR helper's construction options are
 * observable and the auth API is a stub. The mocked `createServerClient`
 * stashes the options object so the test can assert `auth.flowType`. The
 * mocked `signInWithOtp` resolves cleanly and intentionally does NOT call
 * the cookie adapter — implicit flow has no verifier to persist, which is
 * exactly the wire-level property F-15 demands.
 */
const capturedOptions: { value: unknown } = { value: null };

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn((_url: string, _key: string, options: unknown) => {
    capturedOptions.value = options;
    return {
      auth: {
        signInWithOtp: vi.fn().mockResolvedValue({ error: null }),
      },
    };
  }),
  createBrowserClient: vi.fn(),
}));

const { signInWithMagicLink } = await import('@/lib/auth');

beforeEach(() => {
  cookieSetCalls.length = 0;
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
});
