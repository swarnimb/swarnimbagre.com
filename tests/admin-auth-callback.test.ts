import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { NextRequest } from 'next/server';

vi.mock('@/lib/supabase', () => ({
  createServerClient: vi.fn(),
}));

const { createServerClient } = await import('@/lib/supabase');
const { GET } = await import('@/app/(admin)/admin/auth/callback/route');

const ALLOWED_EMAIL = 'allowed@example.test';
const CALLBACK_ORIGIN = 'https://example.test';
/** The single generic failure destination every rejection path shares (SEC-05). */
const FAILURE_LOCATION = '/admin/login?error=callback_failed';

/**
 * Build a stub Supabase client. Each auth method is a vi.fn so the test can
 * assert call shapes and order. `getUser` and `signOut` are wired through the
 * defaults the production code path depends on.
 */
function makeSupabaseStub(opts: {
  verifyOtpError?: unknown;
  exchangeError?: unknown;
  getUserResult?: { data: { user: { email: string } | null } | null; error: unknown };
}) {
  return {
    auth: {
      verifyOtp: vi.fn().mockResolvedValue({ error: opts.verifyOtpError ?? null }),
      exchangeCodeForSession: vi
        .fn()
        .mockResolvedValue({ error: opts.exchangeError ?? null }),
      getUser: vi.fn().mockResolvedValue(
        opts.getUserResult ?? { data: { user: null }, error: null },
      ),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  };
}

/** Build a minimal NextRequest-shaped object the route handler accepts. */
function makeRequest(path: string): NextRequest {
  return new Request(`${CALLBACK_ORIGIN}${path}`) as unknown as NextRequest;
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn> | undefined;

beforeEach(() => {
  process.env.ADMIN_ALLOWED_EMAIL = ALLOWED_EMAIL;
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.resetAllMocks();
  consoleErrorSpy?.mockRestore();
  delete process.env.ADMIN_ALLOWED_EMAIL;
});

describe('admin auth callback route — defense-in-depth allowlist (F-1)', () => {
  it('redirects to /admin when verifyOtp succeeds AND the authenticated user is allowlisted', async () => {
    const stub = makeSupabaseStub({
      getUserResult: { data: { user: { email: ALLOWED_EMAIL } }, error: null },
    });
    vi.mocked(createServerClient).mockResolvedValueOnce(
      stub as unknown as Awaited<ReturnType<typeof createServerClient>>,
    );

    const response = await GET(makeRequest('/admin/auth/callback?token_hash=t&type=email'));

    expect(stub.auth.verifyOtp).toHaveBeenCalledTimes(1);
    expect(stub.auth.getUser).toHaveBeenCalledTimes(1);
    expect(stub.auth.signOut).not.toHaveBeenCalled();
    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(response.status).toBeLessThan(400);
    expect(response.headers.get('location')).toContain('/admin');
    expect(response.headers.get('location')).not.toContain('error=callback_failed');
  });

  it('signs out and redirects to error when authenticated user is NOT allowlisted (defense in depth)', async () => {
    const stub = makeSupabaseStub({
      getUserResult: {
        data: { user: { email: 'attacker@evil.example' } },
        error: null,
      },
    });
    vi.mocked(createServerClient).mockResolvedValueOnce(
      stub as unknown as Awaited<ReturnType<typeof createServerClient>>,
    );

    const response = await GET(makeRequest('/admin/auth/callback?token_hash=t&type=email'));

    expect(stub.auth.verifyOtp).toHaveBeenCalledTimes(1);
    expect(stub.auth.getUser).toHaveBeenCalledTimes(1);
    expect(stub.auth.signOut).toHaveBeenCalledTimes(1);
    expect(response.headers.get('location')).toContain('/admin/login');
    expect(response.headers.get('location')).toContain('error=callback_failed');

    // Log carries presence and reason only — not the rejected email (SEC-05).
    const allCallsString = JSON.stringify(consoleErrorSpy?.mock.calls ?? []);
    expect(allCallsString).toContain('not_allowlisted');
    expect(allCallsString).not.toContain('attacker@evil.example');
  });

  it('signs out and redirects to error when getUser returns no user after verifyOtp success', async () => {
    const stub = makeSupabaseStub({
      getUserResult: { data: { user: null }, error: null },
    });
    vi.mocked(createServerClient).mockResolvedValueOnce(
      stub as unknown as Awaited<ReturnType<typeof createServerClient>>,
    );

    const response = await GET(makeRequest('/admin/auth/callback?token_hash=t&type=email'));

    expect(stub.auth.signOut).toHaveBeenCalledTimes(1);
    expect(response.headers.get('location')).toContain('error=callback_failed');
  });

  it('redirects to error without invoking getUser when verifyOtp itself fails', async () => {
    const stub = makeSupabaseStub({
      verifyOtpError: { name: 'AuthApiError', message: 'invalid token' },
    });
    vi.mocked(createServerClient).mockResolvedValueOnce(
      stub as unknown as Awaited<ReturnType<typeof createServerClient>>,
    );

    const response = await GET(makeRequest('/admin/auth/callback?token_hash=t&type=email'));

    expect(stub.auth.verifyOtp).toHaveBeenCalledTimes(1);
    expect(stub.auth.getUser).not.toHaveBeenCalled();
    expect(stub.auth.signOut).not.toHaveBeenCalled();
    expect(response.headers.get('location')).toContain('error=callback_failed');
  });

  it('applies the defense-in-depth check after the PKCE exchangeCodeForSession path too', async () => {
    const stub = makeSupabaseStub({
      getUserResult: {
        data: { user: { email: 'attacker@evil.example' } },
        error: null,
      },
    });
    vi.mocked(createServerClient).mockResolvedValueOnce(
      stub as unknown as Awaited<ReturnType<typeof createServerClient>>,
    );

    const response = await GET(makeRequest('/admin/auth/callback?code=xyz'));

    expect(stub.auth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
    expect(stub.auth.signOut).toHaveBeenCalledTimes(1);
    expect(response.headers.get('location')).toContain('error=callback_failed');
  });

  it('accepts type=magiclink and proceeds to verifyOtp', async () => {
    const stub = makeSupabaseStub({
      getUserResult: { data: { user: { email: ALLOWED_EMAIL } }, error: null },
    });
    vi.mocked(createServerClient).mockResolvedValueOnce(
      stub as unknown as Awaited<ReturnType<typeof createServerClient>>,
    );

    const response = await GET(
      makeRequest('/admin/auth/callback?token_hash=t&type=magiclink'),
    );

    expect(stub.auth.verifyOtp).toHaveBeenCalledWith({
      token_hash: 't',
      type: 'magiclink',
    });
    expect(response.headers.get('location')).toContain('/admin');
    expect(response.headers.get('location')).not.toContain('error=callback_failed');
  });

  it('compares the user email case-insensitively after trim', async () => {
    const stub = makeSupabaseStub({
      getUserResult: {
        data: { user: { email: '  ALLOWED@example.TEST  ' } },
        error: null,
      },
    });
    vi.mocked(createServerClient).mockResolvedValueOnce(
      stub as unknown as Awaited<ReturnType<typeof createServerClient>>,
    );

    const response = await GET(makeRequest('/admin/auth/callback?token_hash=t&type=email'));

    expect(stub.auth.signOut).not.toHaveBeenCalled();
    expect(response.headers.get('location')).toContain('/admin');
    expect(response.headers.get('location')).not.toContain('error=callback_failed');
  });
});

describe('admin auth callback route — narrowed OTP type set (F-4)', () => {
  /**
   * Drive the handler with one `type` value and return both the response and
   * the stub, so each case can assert that verification never started.
   */
  async function callWithType(type: string) {
    const stub = makeSupabaseStub({
      getUserResult: { data: { user: { email: ALLOWED_EMAIL } }, error: null },
    });
    vi.mocked(createServerClient).mockResolvedValueOnce(
      stub as unknown as Awaited<ReturnType<typeof createServerClient>>,
    );
    const response = await GET(
      makeRequest(`/admin/auth/callback?token_hash=t&type=${type}`),
    );
    return { stub, response };
  }

  // The project is magic-link only, no passwords (CONSTRAINT-09), so a
  // recovery token must never be exchangeable for an admin session.
  it.each(['recovery', 'email_change', 'invite', 'signup', 'not-a-real-type'])(
    'rejects type=%s without calling verifyOtp',
    async (type) => {
      const { stub, response } = await callWithType(type);

      expect(stub.auth.verifyOtp).not.toHaveBeenCalled();
      expect(stub.auth.exchangeCodeForSession).not.toHaveBeenCalled();
      expect(stub.auth.getUser).not.toHaveBeenCalled();
      expect(response.headers.get('location')).toContain('/admin/login');
      expect(response.headers.get('location')).toContain('error=callback_failed');
    },
  );

  // SEC-05: the redirect must not say WHICH check failed. A rejected type and
  // a failed verifyOtp have to be indistinguishable from outside.
  it('produces a byte-identical redirect for every rejected type and for a verifyOtp failure', async () => {
    const locations: (string | null)[] = [];

    for (const type of ['recovery', 'email_change', 'not-a-real-type']) {
      const { response } = await callWithType(type);
      locations.push(response.headers.get('location'));
    }

    const failingStub = makeSupabaseStub({
      verifyOtpError: { name: 'AuthApiError', message: 'invalid token' },
    });
    vi.mocked(createServerClient).mockResolvedValueOnce(
      failingStub as unknown as Awaited<ReturnType<typeof createServerClient>>,
    );
    const failed = await GET(makeRequest('/admin/auth/callback?token_hash=t&type=email'));
    locations.push(failed.headers.get('location'));

    expect(locations[0]).toBe(`${CALLBACK_ORIGIN}${FAILURE_LOCATION}`);
    expect(new Set(locations).size).toBe(1);
  });

  it('does not leak the rejected type value into the redirect URL', async () => {
    const { response } = await callWithType('recovery');

    expect(response.headers.get('location')).not.toContain('recovery');
  });
});
