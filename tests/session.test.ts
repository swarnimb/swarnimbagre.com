import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Unit tests for `lib/session.ts::getServerSession`.
 *
 * Covers SEC-09 (never-throw security invariant), EH-02 (operation-tagged
 * structured logging), and SEC-05 (no-token-leak in logs). The production
 * function MUST return null for every failure mode and MUST NOT leak token
 * material into stdout/stderr.
 *
 * Mocking strategy: stub `@/lib/supabase::createServerClient` so the
 * `auth.getSession()` shape is configurable per test. This is the same module
 * path the existing `tests/auth.test.ts` mocks, keeping import-path style
 * consistent across the suite.
 */

vi.mock('@/lib/supabase', () => ({
  createServerClient: vi.fn(),
}));

const { createServerClient } = await import('@/lib/supabase');
const { getServerSession } = await import('@/lib/session');

/**
 * Build a Supabase client stub whose `auth.getSession` resolves with the given
 * shape (or rejects with the given cause when `throws` is provided).
 */
function makeAuthStub(opts: {
  result?: { data: { session: unknown }; error: unknown };
  throws?: unknown;
}) {
  return {
    auth: {
      getSession: opts.throws
        ? vi.fn().mockRejectedValue(opts.throws)
        : vi.fn().mockResolvedValue(opts.result),
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

describe('getServerSession — happy path', () => {
  it('returns the session object when Supabase resolves with a non-null session', async () => {
    /**
     * Proves the trivial pass-through case. If the cookie store contains a
     * valid session, the caller receives the same `Session` object Supabase
     * decoded — no wrapping, no transformation.
     */
    const session = {
      access_token: 'redacted-for-test',
      refresh_token: 'redacted-for-test',
      user: { id: 'user-1' },
    };
    const stub = makeAuthStub({ result: { data: { session }, error: null } });
    vi.mocked(createServerClient).mockResolvedValueOnce(
      stub as unknown as Awaited<ReturnType<typeof createServerClient>>,
    );

    const result = await getServerSession();

    expect(result).toBe(session);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});

describe('getServerSession — Supabase returns an error', () => {
  it('returns null AND logs the operation-tagged failure (EH-02 + SEC-05)', async () => {
    /**
     * Proves the error-result branch: when Supabase returns an `AuthError`
     * shape, the function logs `[auth] getServerSession failed` with the
     * `errorName` tag only — never the raw error object, the session, or
     * any token material. Covers EH-02 (structured logging) + SEC-05
     * (no-token-leak).
     */
    const supabaseError = {
      name: 'AuthApiError',
      message: 'jwt expired',
      // Token-shaped fields the production code MUST NOT forward to logs:
      access_token: 'leak-canary-access',
      refresh_token: 'leak-canary-refresh',
    };
    const stub = makeAuthStub({
      result: { data: { session: null }, error: supabaseError },
    });
    vi.mocked(createServerClient).mockResolvedValueOnce(
      stub as unknown as Awaited<ReturnType<typeof createServerClient>>,
    );

    const result = await getServerSession();

    expect(result).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);

    const call = consoleErrorSpy!.mock.calls[0];
    expect(call[0]).toBe('[auth] getServerSession failed');
    const payloadString = JSON.stringify(call[1]);
    expect(payloadString).toContain('"errorName"');
    expect(payloadString).toContain('AuthApiError');
    // Token-leak guard (SEC-05): no raw error, no session, no token fields.
    expect(payloadString).not.toContain('access_token');
    expect(payloadString).not.toContain('refresh_token');
    expect(payloadString).not.toContain('leak-canary');
    expect(payloadString).not.toContain('jwt expired');
  });

  it('does not throw when Supabase returns an error (SEC-09 never-throw invariant)', async () => {
    /**
     * Proves the SEC-09 contract: callers (route handlers, server components)
     * MUST be able to treat `getServerSession` as a total function that always
     * resolves. A throw here would force every caller into try/catch with the
     * same "treat as logged-out" fallback.
     */
    const stub = makeAuthStub({
      result: {
        data: { session: null },
        error: { name: 'AuthApiError', message: 'bad cookie' },
      },
    });
    vi.mocked(createServerClient).mockResolvedValueOnce(
      stub as unknown as Awaited<ReturnType<typeof createServerClient>>,
    );

    await expect(getServerSession()).resolves.not.toThrow();
  });
});

describe('getServerSession — Supabase throws (network failure)', () => {
  it('returns null AND logs the threw-tagged failure (EH-02 + SEC-05)', async () => {
    /**
     * Proves the catch branch: when `auth.getSession()` rejects (a network
     * exception, a transport-level failure, etc.), the function logs
     * `[auth] getServerSession threw` with `errorName` only. Same no-leak
     * guarantee as the error-result branch.
     */
    const cause = Object.assign(new Error('network down'), {
      name: 'FetchError',
      // Token-shaped fields the production code MUST NOT forward to logs:
      access_token: 'leak-canary-access',
      refresh_token: 'leak-canary-refresh',
    });
    const stub = makeAuthStub({ throws: cause });
    vi.mocked(createServerClient).mockResolvedValueOnce(
      stub as unknown as Awaited<ReturnType<typeof createServerClient>>,
    );

    const result = await getServerSession();

    expect(result).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);

    const call = consoleErrorSpy!.mock.calls[0];
    expect(call[0]).toBe('[auth] getServerSession threw');
    const payloadString = JSON.stringify(call[1]);
    expect(payloadString).toContain('"errorName"');
    expect(payloadString).toContain('FetchError');
    // Token-leak guard (SEC-05): no raw cause, no token fields, no message.
    expect(payloadString).not.toContain('access_token');
    expect(payloadString).not.toContain('refresh_token');
    expect(payloadString).not.toContain('leak-canary');
    expect(payloadString).not.toContain('network down');
  });

  it('does not throw when Supabase rejects (SEC-09 never-throw invariant)', async () => {
    /**
     * Proves SEC-09 for the catch branch — symmetric to the error-result test.
     */
    const stub = makeAuthStub({ throws: new Error('boom') });
    vi.mocked(createServerClient).mockResolvedValueOnce(
      stub as unknown as Awaited<ReturnType<typeof createServerClient>>,
    );

    await expect(getServerSession()).resolves.not.toThrow();
  });

  it('logs "unknown" errorName when the rejection is not an Error instance', async () => {
    /**
     * Proves the `cause instanceof Error` fallback. A non-Error rejection
     * (e.g. a string thrown from a misbehaving lib) yields `errorName:
     * 'unknown'` rather than throwing on property access.
     */
    const stub = makeAuthStub({ throws: 'string-rejection' });
    vi.mocked(createServerClient).mockResolvedValueOnce(
      stub as unknown as Awaited<ReturnType<typeof createServerClient>>,
    );

    const result = await getServerSession();

    expect(result).toBeNull();
    const payloadString = JSON.stringify(
      consoleErrorSpy!.mock.calls[0]?.[1] ?? {},
    );
    expect(payloadString).toContain('"errorName":"unknown"');
  });
});

describe('getServerSession — no session present (normal logged-out)', () => {
  it('returns null and writes NO log line (logging would be noise)', async () => {
    /**
     * Proves that the normal "no cookie, no session" case is silent. Logging
     * here would flood the log stream on every anonymous public-route hit
     * that touches `getServerSession`. Only error and throw branches log.
     */
    const stub = makeAuthStub({
      result: { data: { session: null }, error: null },
    });
    vi.mocked(createServerClient).mockResolvedValueOnce(
      stub as unknown as Awaited<ReturnType<typeof createServerClient>>,
    );

    const result = await getServerSession();

    expect(result).toBeNull();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
