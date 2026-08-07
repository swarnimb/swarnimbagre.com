// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Gate tests for `app/api/test/sign-in/route.ts` — the T19.2 fixture route
 * that mints a REAL Supabase session with the service-role key so Playwright
 * specs can land on `/admin` already authenticated.
 *
 * The route ships in the production route table, so its three independent
 * gates are the only thing standing between a deployed build and a
 * session-minting endpoint. Every gate here is asserted to return a bare 404 —
 * the shape of a route that does not exist — rather than any status that would
 * confirm the path is real.
 *
 * Runs in the `node` env because the route builds `Response` objects and uses
 * `node:crypto`'s `timingSafeEqual` over `Buffer`s.
 *
 * `@supabase/supabase-js` and `@/lib/supabase` are both mocked: a gate test
 * that reached a real Supabase would be testing the network, and the happy
 * path must be able to assert a 204 without minting anything.
 */

const FIXTURE_SECRET_HEADER = 'x-fixture-secret';
/** Obvious fake. The real value lives only in `.env.local` and CI secrets. */
const FIXTURE_SECRET = 'fake-fixture-secret-value';
const FIXTURE_EMAIL = 'fixture@example.test';
const HASHED_TOKEN = 'fake-hashed-token';
/** Structured-log identifiers the route emits on every failure path (EH-02). */
const ROUTE_OPERATION = 'apiTestSignIn';
const FAILURE_LOG_TAG = `[auth] ${ROUTE_OPERATION} failed`;

const generateLink = vi.fn();
const verifyOtp = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: { admin: { generateLink: (...args: unknown[]) => generateLink(...args) } },
  })),
}));

vi.mock('@/lib/supabase', () => ({
  createServerClient: vi.fn(async () => ({
    auth: { verifyOtp: (...args: unknown[]) => verifyOtp(...args) },
  })),
}));

const { POST } = await import('@/app/api/test/sign-in/route');
const { createClient } = await import('@supabase/supabase-js');

/**
 * Env keys this suite writes. Saved and restored around every test (TS-05) so
 * a NODE_ENV left at 'production' cannot leak into another file's run.
 */
const MANAGED_ENV_KEYS = [
  'NODE_ENV',
  'VERCEL',
  'TEST_FIXTURE_SECRET',
  'TEST_FIXTURE_EMAIL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

/** Env is typed narrowly for NODE_ENV; widen once here rather than at each write. */
const mutableEnv = process.env as Record<string, string | undefined>;

let savedEnv: Record<string, string | undefined> = {};

/** Build a POST request, with the fixture secret header unless told otherwise. */
function makeRequest(secret?: string | null): Request {
  const headers = new Headers();
  if (secret !== null && secret !== undefined) {
    headers.set(FIXTURE_SECRET_HEADER, secret);
  }
  return new Request('http://localhost:3000/api/test/sign-in', {
    method: 'POST',
    headers,
  });
}

/** A request carrying the correct secret — used by every non-secret gate test. */
function makeAuthorizedRequest(): Request {
  return makeRequest(FIXTURE_SECRET);
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn> | undefined;

beforeEach(() => {
  savedEnv = {};
  for (const key of MANAGED_ENV_KEYS) savedEnv[key] = mutableEnv[key];

  // The fully-open configuration. Each gate test then closes exactly one gate,
  // so a failure names the gate that let the request through.
  mutableEnv.NODE_ENV = 'test';
  delete mutableEnv.VERCEL;
  mutableEnv.TEST_FIXTURE_SECRET = FIXTURE_SECRET;
  mutableEnv.TEST_FIXTURE_EMAIL = FIXTURE_EMAIL;
  mutableEnv.NEXT_PUBLIC_SUPABASE_URL = 'https://stub.supabase.test';
  mutableEnv.SUPABASE_SERVICE_ROLE_KEY = 'fake-service-role-key';

  generateLink.mockResolvedValue({
    data: { properties: { hashed_token: HASHED_TOKEN } },
    error: null,
  });
  verifyOtp.mockResolvedValue({ error: null });
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  for (const key of MANAGED_ENV_KEYS) {
    if (savedEnv[key] === undefined) delete mutableEnv[key];
    else mutableEnv[key] = savedEnv[key];
  }
  vi.clearAllMocks();
  consoleErrorSpy?.mockRestore();
});

describe('test sign-in fixture route — environment gate', () => {
  it.each(['production', 'development'])(
    'returns 404 when NODE_ENV is %s',
    async (nodeEnv) => {
      mutableEnv.NODE_ENV = nodeEnv;

      const response = await POST(makeAuthorizedRequest());

      expect(response.status).toBe(404);
      expect(await response.text()).toBe('');
    },
  );

  it('returns 404 when NODE_ENV is unset entirely', async () => {
    delete mutableEnv.NODE_ENV;

    const response = await POST(makeAuthorizedRequest());

    expect(response.status).toBe(404);
  });

  it('returns 404 when running on Vercel, even with NODE_ENV forced to test', async () => {
    mutableEnv.VERCEL = '1';

    const response = await POST(makeAuthorizedRequest());

    expect(response.status).toBe(404);
    expect(await response.text()).toBe('');
  });

  /**
   * The gates run before the service-role key is read, so a refused request
   * never constructs an admin client. If this ever inverted, a deployed build
   * would be instantiating a privileged client on unauthenticated input.
   */
  it('never constructs a Supabase admin client when the environment gate refuses', async () => {
    mutableEnv.NODE_ENV = 'production';

    await POST(makeAuthorizedRequest());

    expect(createClient).not.toHaveBeenCalled();
    expect(generateLink).not.toHaveBeenCalled();
    expect(verifyOtp).not.toHaveBeenCalled();
  });
});

describe('test sign-in fixture route — secret gate', () => {
  it('returns 404 when the x-fixture-secret header is absent', async () => {
    const response = await POST(makeRequest(null));

    expect(response.status).toBe(404);
    expect(await response.text()).toBe('');
  });

  it('returns 404 when the header is present but empty', async () => {
    const response = await POST(makeRequest(''));

    expect(response.status).toBe(404);
  });

  /**
   * `timingSafeEqual` throws on unequal-length buffers, which is why the route
   * length-checks first. A regression that dropped the pre-check would surface
   * here as a rejected promise or a 500, not a 404.
   */
  it.each([
    ['shorter', FIXTURE_SECRET.slice(0, -1)],
    ['longer', `${FIXTURE_SECRET}x`],
  ])(
    'returns 404 for a %s secret without letting timingSafeEqual throw',
    async (_label, secret) => {
      const response = await POST(makeRequest(secret));

      expect(response.status).toBe(404);
    },
  );

  it('returns 404 for a wrong secret that is exactly the right length', async () => {
    const wrongSecret = 'x'.repeat(FIXTURE_SECRET.length);
    expect(wrongSecret.length).toBe(FIXTURE_SECRET.length);

    const response = await POST(makeRequest(wrongSecret));

    expect(response.status).toBe(404);
    expect(await response.text()).toBe('');
  });

  it('returns 404 when TEST_FIXTURE_SECRET is not configured at all', async () => {
    delete mutableEnv.TEST_FIXTURE_SECRET;

    const response = await POST(makeRequest(''));

    expect(response.status).toBe(404);
  });

  it('never constructs a Supabase admin client when the secret gate refuses', async () => {
    await POST(makeRequest('wrong'));

    expect(createClient).not.toHaveBeenCalled();
    expect(generateLink).not.toHaveBeenCalled();
  });
});

describe('test sign-in fixture route — build-time inlining guard (CONSTRAINT-19)', () => {
  /**
   * Next 15 folds both `process.env.NODE_ENV` and `process.env['NODE_ENV']`
   * into a build-time literal, which would pin the environment gate to
   * `'production' !== 'test'` and silently defeat it. Only a computed read
   * whose key is a variable survives. No runtime assertion can observe that —
   * the inlining happens in the bundler — so this reads the source instead.
   * It is the one form this regression is catchable in.
   *
   * Comments are stripped first: the route documents both inlinable forms in
   * prose to explain why it avoids them, and matching that prose would fail
   * the test for the wrong reason.
   */
  it('reads NODE_ENV only through a variable key, never a form the bundler can inline', () => {
    const routePath = path.resolve(
      __dirname,
      '..',
      'app/api/test/sign-in/route.ts',
    );
    const code = readFileSync(routePath, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

    expect(code).not.toMatch(/process\.env\.NODE_ENV/);
    expect(code).not.toMatch(/process\.env\[\s*['"`]NODE_ENV['"`]\s*\]/);
    expect(code).toContain('process.env[NODE_ENV_KEY]');
  });
});

describe('test sign-in fixture route — fully gated happy path', () => {
  it('returns 204 and mints a session when all three gates pass', async () => {
    const response = await POST(makeAuthorizedRequest());

    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
  });

  it('takes the fixture identity from the env, not from the request', async () => {
    await POST(makeAuthorizedRequest());

    expect(generateLink).toHaveBeenCalledTimes(1);
    expect(generateLink).toHaveBeenCalledWith({
      type: 'magiclink',
      email: FIXTURE_EMAIL,
    });
  });

  /**
   * The redemption has to match the production callback's shape, or the
   * fixture would be exercising a code path real magic links never take.
   */
  it('redeems the generated token through the SSR client the same way the callback does', async () => {
    await POST(makeAuthorizedRequest());

    expect(verifyOtp).toHaveBeenCalledTimes(1);
    expect(verifyOtp).toHaveBeenCalledWith({
      token_hash: HASHED_TOKEN,
      type: 'email',
    });
  });
});

describe('test sign-in fixture route — Supabase failure paths', () => {
  it('returns 500 without calling Supabase when TEST_FIXTURE_EMAIL is unset', async () => {
    delete mutableEnv.TEST_FIXTURE_EMAIL;

    const response = await POST(makeAuthorizedRequest());

    expect(response.status).toBe(500);
    expect(createClient).not.toHaveBeenCalled();
  });

  it('returns 500 when the service-role key is missing', async () => {
    delete mutableEnv.SUPABASE_SERVICE_ROLE_KEY;

    const response = await POST(makeAuthorizedRequest());

    expect(response.status).toBe(500);
    expect(createClient).not.toHaveBeenCalled();
  });

  it('returns 500 without attempting redemption when generateLink fails', async () => {
    generateLink.mockResolvedValue({
      data: null,
      error: { name: 'AuthApiError', message: 'user not found' },
    });

    const response = await POST(makeAuthorizedRequest());

    expect(response.status).toBe(500);
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it('returns 500 when generateLink succeeds but returns no hashed token', async () => {
    generateLink.mockResolvedValue({ data: { properties: {} }, error: null });

    const response = await POST(makeAuthorizedRequest());

    expect(response.status).toBe(500);
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it('returns 500 when redeeming the token fails', async () => {
    verifyOtp.mockResolvedValue({
      error: { name: 'AuthApiError', message: 'token expired' },
    });

    const response = await POST(makeAuthorizedRequest());

    expect(response.status).toBe(500);
  });

  /**
   * The LOUD-failure rule (`~/.claude/CLAUDE.md`: "Fail LOUD — errors must be
   * obvious, never silent or swallowed", "Log all failures with stack traces")
   * applied at this route, and the positive twin of the SEC-05 no-leak case
   * below. Every branch that answers 500 must also emit a structured line
   * naming the operation and the reason it refused — a silent 500 here is a
   * fixture that fails without telling anyone why.
   *
   * This is what makes the no-leak assertions non-vacuous: with no positive
   * assertion, deleting every log statement from the route leaves an empty
   * call list, and every `not.toContain` passes trivially against `"[]"`.
   * Mirrors the F4 idiom in `tests/middleware.test.ts`.
   */
  it.each([
    [
      'missing TEST_FIXTURE_EMAIL env',
      () => {
        delete mutableEnv.TEST_FIXTURE_EMAIL;
      },
    ],
    [
      'missing supabase config env vars',
      () => {
        delete mutableEnv.SUPABASE_SERVICE_ROLE_KEY;
      },
    ],
    [
      'generateLink returned no hashed_token',
      () => {
        generateLink.mockResolvedValue({
          data: null,
          error: { name: 'AuthApiError', message: 'user not found' },
        });
      },
    ],
    [
      'verifyOtp returned error',
      () => {
        verifyOtp.mockResolvedValue({
          error: { name: 'AuthApiError', message: 'token expired' },
        });
      },
    ],
  ])('logs a structured failure line with reason "%s"', async (reason, arrange) => {
    arrange();

    const response = await POST(makeAuthorizedRequest());

    expect(response.status).toBe(500);
    const failureCalls = consoleErrorSpy!.mock.calls.filter(
      (call) => call[0] === FAILURE_LOG_TAG,
    );
    expect(failureCalls).toHaveLength(1);
    expect(failureCalls[0][1]).toMatchObject({
      operation: ROUTE_OPERATION,
      reason,
    });
  });

  /**
   * SEC-05 at the fixture route. The failure logs carry the reason and the
   * environment, and must never carry the secret header value or the token
   * that would let a log reader mint a session.
   *
   * Drives all four logged branches in sequence, and asserts the count of
   * emitted lines BEFORE inspecting them — so these `not.toContain` checks can
   * only pass against a call list that genuinely holds four failure logs.
   */
  it('logs no secret or token material on any failure path', async () => {
    delete mutableEnv.TEST_FIXTURE_EMAIL;
    await POST(makeAuthorizedRequest());
    mutableEnv.TEST_FIXTURE_EMAIL = FIXTURE_EMAIL;

    delete mutableEnv.SUPABASE_SERVICE_ROLE_KEY;
    await POST(makeAuthorizedRequest());
    mutableEnv.SUPABASE_SERVICE_ROLE_KEY = 'fake-service-role-key';

    generateLink.mockResolvedValue({
      data: null,
      error: { name: 'AuthApiError', message: 'user not found' },
    });
    await POST(makeAuthorizedRequest());
    generateLink.mockResolvedValue({
      data: { properties: { hashed_token: HASHED_TOKEN } },
      error: null,
    });

    verifyOtp.mockResolvedValue({
      error: { name: 'AuthApiError', message: 'token expired' },
    });
    await POST(makeAuthorizedRequest());

    const failureCalls = consoleErrorSpy!.mock.calls.filter(
      (call) => call[0] === FAILURE_LOG_TAG,
    );
    expect(failureCalls).toHaveLength(4);

    const aggregate = JSON.stringify(consoleErrorSpy!.mock.calls);
    expect(aggregate).not.toContain(FIXTURE_SECRET);
    expect(aggregate).not.toContain(HASHED_TOKEN);
    expect(aggregate).not.toContain('fake-service-role-key');
  });
});
