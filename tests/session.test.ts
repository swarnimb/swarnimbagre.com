import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ServiceError } from '@/lib/errors';

/**
 * Unit tests for `lib/session.ts::assertAdminSession` (F-39, audit 24).
 *
 * This replaces the old `getServerSession` suite wholesale. That function was
 * dead code and has been deleted; its "never throw, return null" contract does
 * NOT carry over. `assertAdminSession` is a guard: it returns void on success
 * and throws `ServiceError` on every failure mode, deliberately, so that a
 * forgotten `if` at a call site cannot silently degrade into a no-op.
 *
 * Covers the four branches (verified user / Supabase error / absent user /
 * network throw), EH-02 (operation-tagged structured logging), and SEC-05
 * (no token, email or raw error message in any log line) — the same no-leak
 * discipline as L1 in `tests/middleware.test.ts`.
 *
 * Mocking strategy: the injected-client DI seam (`assertAdminSession(client)`)
 * for every branch test — it is the seam the production signature exists to
 * provide, and it needs no module mock. `@/lib/supabase` is mocked only for
 * the one test that proves the default (no-argument) path actually builds a
 * request-scoped server client. Stub-builder idiom mirrors
 * `tests/admin-stats-mutations.test.ts`.
 */

vi.mock('@/lib/supabase', () => ({
  createServerClient: vi.fn(),
}));

const { createServerClient } = await import('@/lib/supabase');
const { assertAdminSession } = await import('@/lib/session');

/**
 * Build a stub Supabase client whose `auth.getUser()` resolves with the given
 * `{ data: { user }, error }` shape, or rejects with `throws`.
 *
 * Fixtures carry `leak-canary-*` token-shaped fields on the user and on the
 * error/cause. `getUser()` returns no session, so there is no natural token
 * field to plant them in; the objects the production code could plausibly
 * serialize are the next best thing. Every no-leak assertion below is checking
 * that none of them survived into a log payload.
 */
function makeAuthStub(opts: {
  result?: { data: { user: unknown }; error: unknown };
  throws?: unknown;
}): { client: SupabaseClient; getUser: ReturnType<typeof vi.fn> } {
  const getUser = opts.throws
    ? vi.fn().mockRejectedValue(opts.throws)
    : vi.fn().mockResolvedValue(opts.result);
  return {
    client: { auth: { getUser } } as unknown as SupabaseClient,
    getUser,
  };
}

/** A verified-user response, with token-shaped canaries riding along. */
function verifiedUserResult() {
  return {
    data: {
      user: {
        id: 'user-1',
        email: 'admin@example.test',
        access_token: 'leak-canary-access',
        refresh_token: 'leak-canary-refresh',
      },
    },
    error: null,
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

describe('assertAdminSession — happy path', () => {
  it('resolves (void) and logs nothing when getUser returns a verified user', async () => {
    /**
     * The whole success contract: no return value to inspect, no log line to
     * emit. If this ever starts throwing, every admin Server Action breaks
     * closed — which is the correct direction to fail, but still a regression.
     */
    const { client, getUser } = makeAuthStub({ result: verifiedUserResult() });

    await expect(assertAdminSession(client)).resolves.toBeUndefined();

    expect(getUser).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('uses the injected client and never constructs a request-scoped one', async () => {
    /**
     * Proves the DI seam is a real seam rather than a decorative parameter:
     * when a client is passed, `createServerClient` is not called at all.
     */
    const { client } = makeAuthStub({ result: verifiedUserResult() });

    await assertAdminSession(client);

    expect(vi.mocked(createServerClient)).not.toHaveBeenCalled();
  });

  it('falls back to the request-scoped server client when no client is injected', async () => {
    /**
     * The production call path. Server Actions call `assertAdminSession()` with
     * no argument, so the default must resolve a client that reads the SSR auth
     * cookie — otherwise the guard would only ever work in tests.
     */
    const { client, getUser } = makeAuthStub({ result: verifiedUserResult() });
    vi.mocked(createServerClient).mockResolvedValueOnce(
      client as unknown as Awaited<ReturnType<typeof createServerClient>>,
    );

    await expect(assertAdminSession()).resolves.toBeUndefined();

    expect(vi.mocked(createServerClient)).toHaveBeenCalledTimes(1);
    expect(getUser).toHaveBeenCalledTimes(1);
  });
});

describe('assertAdminSession — Supabase returns an error', () => {
  it('throws ServiceError and logs the rejected branch with errorName only (EH-02 + SEC-05)', async () => {
    /**
     * An `AuthApiError` result means the token was presented and refused —
     * forged signature, expired JWT, revoked user. The guard must throw, and
     * the log line must carry the operation tag and the error *kind* only:
     * never the raw message (which can echo submitted input) and never token
     * material.
     */
    const { client } = makeAuthStub({
      result: {
        data: { user: null },
        error: {
          name: 'AuthApiError',
          message: 'jwt expired',
          access_token: 'leak-canary-access',
          refresh_token: 'leak-canary-refresh',
        },
      },
    });

    await expect(assertAdminSession(client)).rejects.toBeInstanceOf(
      ServiceError,
    );

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const call = consoleErrorSpy!.mock.calls[0];
    expect(call[0]).toBe('[auth] assertAdminSession rejected');
    const payloadString = JSON.stringify(call[1]);
    expect(payloadString).toContain('"operation":"assertAdminSession"');
    expect(payloadString).toContain('AuthApiError');
    expect(payloadString).not.toContain('access_token');
    expect(payloadString).not.toContain('refresh_token');
    expect(payloadString).not.toContain('leak-canary');
    expect(payloadString).not.toContain('jwt expired');
  });

  it('tags the thrown ServiceError with the assertAdminSession operation', async () => {
    /**
     * The wrappers catch everything non-Zod and convert it to the uniform
     * GENERIC_FORM_ERROR envelope, so the `operation` tag is the only thing
     * that makes an auth rejection distinguishable in the server log.
     */
    const { client } = makeAuthStub({
      result: {
        data: { user: null },
        error: { name: 'AuthApiError', message: 'bad cookie' },
      },
    });

    await expect(assertAdminSession(client)).rejects.toMatchObject({
      name: 'ServiceError',
      operation: 'assertAdminSession',
    });
  });
});

describe('assertAdminSession — no user present (unauthenticated caller)', () => {
  it('throws ServiceError and logs the absent branch (EH-02)', async () => {
    /**
     * The load-bearing case for F-39: an anonymous POST to a lifted Server
     * Action ID. `getUser()` returns `{ user: null }` with no error, and the
     * old code would have treated a falsy return as "carry on". It must throw.
     *
     * Unlike the retired `getServerSession`, this branch DOES log: it is not
     * ambient anonymous traffic, it is an unauthenticated caller reaching an
     * admin mutation, which is worth a line.
     */
    const { client } = makeAuthStub({
      result: { data: { user: null }, error: null },
    });

    await expect(assertAdminSession(client)).rejects.toBeInstanceOf(
      ServiceError,
    );

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const call = consoleErrorSpy!.mock.calls[0];
    expect(call[0]).toBe('[auth] assertAdminSession absent');
    expect(JSON.stringify(call[1])).toContain(
      '"operation":"assertAdminSession"',
    );
  });

  it('throws when the user object is present but carries no id', async () => {
    /**
     * The guard keys off `data.user?.id`, not `data.user`. A malformed
     * response that yields an id-less object must not read as authenticated.
     */
    const { client } = makeAuthStub({
      result: { data: { user: { email: 'admin@example.test' } }, error: null },
    });

    await expect(assertAdminSession(client)).rejects.toBeInstanceOf(
      ServiceError,
    );
  });
});

describe('assertAdminSession — getUser rejects (network failure)', () => {
  it('throws ServiceError — not the raw cause — and logs the threw branch (EH-02 + SEC-05)', async () => {
    /**
     * A transport failure must not surface as a `FetchError` to the caller:
     * the wrappers key on ServiceError, and a leaked raw rejection would carry
     * its message (and anything attached to it) straight into the response
     * path. Fail closed, in the project's own error type.
     */
    const cause = Object.assign(new Error('network down'), {
      name: 'FetchError',
      access_token: 'leak-canary-access',
      refresh_token: 'leak-canary-refresh',
    });
    const { client } = makeAuthStub({ throws: cause });

    const rejection = await assertAdminSession(client).catch((e: unknown) => e);

    expect(rejection).toBeInstanceOf(ServiceError);
    expect(rejection).not.toBe(cause);

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const call = consoleErrorSpy!.mock.calls[0];
    expect(call[0]).toBe('[auth] assertAdminSession threw');
    const payloadString = JSON.stringify(call[1]);
    expect(payloadString).toContain('"operation":"assertAdminSession"');
    expect(payloadString).toContain('FetchError');
    expect(payloadString).not.toContain('access_token');
    expect(payloadString).not.toContain('refresh_token');
    expect(payloadString).not.toContain('leak-canary');
    expect(payloadString).not.toContain('network down');
  });

  it('logs "unknown" errorName when the rejection is not an Error instance', async () => {
    /**
     * Proves the `cause instanceof Error` fallback. A non-Error rejection
     * (a string thrown from a misbehaving lib) must yield
     * `errorName: 'unknown'` rather than throwing on property access inside
     * the handler — which would replace a clean ServiceError with a TypeError.
     */
    const { client } = makeAuthStub({ throws: 'string-rejection' });

    await expect(assertAdminSession(client)).rejects.toBeInstanceOf(
      ServiceError,
    );

    const payloadString = JSON.stringify(
      consoleErrorSpy!.mock.calls[0]?.[1] ?? {},
    );
    expect(payloadString).toContain('"errorName":"unknown"');
  });

  it('does not double-log or re-wrap the ServiceError raised by the error branch', async () => {
    /**
     * The error branch throws from inside the same `try` the catch guards, so
     * without the `cause instanceof ServiceError` re-throw the failure would be
     * logged twice and wrapped twice. One rejection, one log line.
     */
    const { client } = makeAuthStub({
      result: {
        data: { user: null },
        error: { name: 'AuthApiError', message: 'jwt expired' },
      },
    });

    await expect(assertAdminSession(client)).rejects.toBeInstanceOf(
      ServiceError,
    );

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy!.mock.calls[0][0]).toBe(
      '[auth] assertAdminSession rejected',
    );
  });
});

describe('assertAdminSession — SEC-05 aggregate no-leak', () => {
  it('emits no token, email or raw error message across every failure mode', async () => {
    /**
     * Mirrors L1 in `tests/middleware.test.ts`: run every branch, aggregate
     * every `console.error` payload this module produced, and assert against
     * the whole string at once. A future contributor who adds a `cause` or a
     * spread `...error` to any log line fails here rather than in production.
     */
    const stubs = [
      makeAuthStub({
        result: {
          data: { user: null },
          error: {
            name: 'AuthApiError',
            message: 'jwt expired for admin@example.test',
            access_token: 'leak-canary-access',
            refresh_token: 'leak-canary-refresh',
          },
        },
      }),
      makeAuthStub({ result: { data: { user: null }, error: null } }),
      makeAuthStub({
        throws: Object.assign(
          new Error('network down reaching sb-auth-endpoint'),
          {
            name: 'FetchError',
            access_token: 'leak-canary-access',
            refresh_token: 'leak-canary-refresh',
          },
        ),
      }),
    ];

    for (const { client } of stubs) {
      await expect(assertAdminSession(client)).rejects.toBeInstanceOf(
        ServiceError,
      );
    }

    const aggregate = JSON.stringify(consoleErrorSpy!.mock.calls);

    expect(aggregate).not.toContain('access_token');
    expect(aggregate).not.toContain('refresh_token');
    expect(aggregate).not.toContain('leak-canary');
    expect(aggregate).not.toContain('sb-');
    expect(aggregate).not.toContain('jwt expired');
    expect(aggregate).not.toContain('network down');
    expect(aggregate).not.toMatch(
      /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/,
    );
  });
});
