import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { NextRequest } from 'next/server';

vi.mock('@/lib/supabase', () => ({
  createServerClient: vi.fn(),
}));

const { createServerClient } = await import('@/lib/supabase');
const { GET } = await import('@/app/(admin)/admin/auth/callback/route');

const ALLOWED_EMAIL = 'allowed@example.test';
const CALLBACK_ORIGIN = 'https://example.test';

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
