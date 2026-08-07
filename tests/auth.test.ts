import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ServiceError, ValidationError } from '@/lib/errors';

vi.mock('@/lib/supabase', () => ({
  createServerClient: vi.fn(),
}));

const { createServerClient } = await import('@/lib/supabase');
const { attemptMagicLink, EMAIL_SCHEMA } = await import('@/lib/auth-internal');
const { signInWithMagicLink } = await import('@/lib/auth');

/** Fixed env values installed for every test so URL + allowlist are deterministic. */
const SITE_URL = 'https://example.test';
const ALLOWED_EMAIL = 'allowed@example.test';

/**
 * Floor (ms) the Server Action enforces before resolving — F-12 mitigation.
 * Mirrors the `MIN_DURATION_MS` constant in `lib/auth.ts`. The timing test
 * advances fake timers by exactly this much; if the source constant ever
 * changes, this test must change in lock-step.
 */
const MIN_DURATION_MS = 750;

/** Build a Supabase auth stub whose `signInWithOtp` resolves with the given shape. */
function makeAuthStub(otpResult: { error: unknown }) {
  return {
    auth: {
      signInWithOtp: vi.fn().mockResolvedValue(otpResult),
    },
  };
}

/** Domain suffix used to build length-boundary addresses for the F-3 tests. */
const BOUNDARY_DOMAIN = '@example.com';

/**
 * Build a syntactically valid address of exactly `total` characters by padding
 * the local part in front of `BOUNDARY_DOMAIN`. Used to sit either side of the
 * RFC 5321 254-character bound without hard-coding a wall of literal text.
 */
function emailOfLength(total: number): string {
  return 'a'.repeat(total - BOUNDARY_DOMAIN.length) + BOUNDARY_DOMAIN;
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn> | undefined;

beforeEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = SITE_URL;
  process.env.ADMIN_ALLOWED_EMAIL = ALLOWED_EMAIL;
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.resetAllMocks();
  consoleErrorSpy?.mockRestore();
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.ADMIN_ALLOWED_EMAIL;
});

describe('EMAIL_SCHEMA (length bounds — F-3)', () => {
  it('accepts a normal valid address', () => {
    expect(EMAIL_SCHEMA.safeParse(ALLOWED_EMAIL).success).toBe(true);
  });

  it('accepts an address of exactly 254 characters (RFC 5321 upper bound)', () => {
    const atBound = emailOfLength(254);
    expect(atBound).toHaveLength(254);
    expect(EMAIL_SCHEMA.safeParse(atBound).success).toBe(true);
  });

  it('rejects an address of exactly 255 characters (one over the bound)', () => {
    const overBound = emailOfLength(255);
    expect(overBound).toHaveLength(255);
    expect(EMAIL_SCHEMA.safeParse(overBound).success).toBe(false);
  });

  it('rejects a 2-character string (below the min bound)', () => {
    expect(EMAIL_SCHEMA.safeParse('ab').success).toBe(false);
  });

  it('rejects `a@b` — 3 chars clears .min(3) but zod .email() requires a dotted domain', () => {
    // The RFC-theoretical shortest address is 3 characters (`a@b`), but zod's
    // email pattern requires a domain label plus a 2+ character TLD, so the
    // shortest string this schema actually accepts is 6 (`a@b.co`). Asserted
    // against real behaviour rather than the theoretical minimum.
    expect(EMAIL_SCHEMA.safeParse('a@b').success).toBe(false);
    expect(EMAIL_SCHEMA.safeParse('a@b.co').success).toBe(true);
  });
});

describe('attemptMagicLink (internal throwing helper)', () => {
  it('throws ValidationError when the email is not a valid shape', async () => {
    await expect(attemptMagicLink('not-an-email')).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(attemptMagicLink('')).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError and does NOT call Supabase for an over-length email (F-3)', async () => {
    const stub = makeAuthStub({ error: null });
    vi.mocked(createServerClient).mockResolvedValue(
      stub as unknown as Awaited<ReturnType<typeof createServerClient>>,
    );

    const overBound = emailOfLength(255);
    expect(overBound).toHaveLength(255);
    await expect(attemptMagicLink(overBound)).rejects.toBeInstanceOf(
      ValidationError,
    );

    expect(stub.auth.signInWithOtp).not.toHaveBeenCalled();
  });

  it('calls supabase.auth.signInWithOtp with shouldCreateUser:false on allowlisted input', async () => {
    const stub = makeAuthStub({ error: null });
    vi.mocked(createServerClient).mockResolvedValueOnce(
      stub as unknown as Awaited<ReturnType<typeof createServerClient>>,
    );

    await attemptMagicLink(ALLOWED_EMAIL);

    expect(stub.auth.signInWithOtp).toHaveBeenCalledTimes(1);
    expect(stub.auth.signInWithOtp).toHaveBeenCalledWith({
      email: ALLOWED_EMAIL,
      options: {
        emailRedirectTo: `${SITE_URL}/admin/auth/callback`,
        shouldCreateUser: false,
      },
    });
  });

  it('throws ServiceError tagged with the operation when Supabase returns an error', async () => {
    const supabaseError = { name: 'AuthApiError', message: 'rate limited' };
    const stub = makeAuthStub({ error: supabaseError });
    vi.mocked(createServerClient).mockResolvedValueOnce(
      stub as unknown as Awaited<ReturnType<typeof createServerClient>>,
    );

    await expect(attemptMagicLink(ALLOWED_EMAIL)).rejects.toBeInstanceOf(
      ServiceError,
    );
  });

  it('logs the failure with emailProvided presence and never the raw email', async () => {
    const supabaseError = { name: 'AuthApiError', message: 'rate limited' };
    const stub = makeAuthStub({ error: supabaseError });
    vi.mocked(createServerClient).mockResolvedValueOnce(
      stub as unknown as Awaited<ReturnType<typeof createServerClient>>,
    );

    await expect(attemptMagicLink(ALLOWED_EMAIL)).rejects.toBeInstanceOf(
      ServiceError,
    );

    expect(consoleErrorSpy).toHaveBeenCalled();
    const allCallsString = JSON.stringify(consoleErrorSpy?.mock.calls ?? []);
    expect(allCallsString).toContain('"emailProvided":true');
    expect(allCallsString).not.toContain(ALLOWED_EMAIL);
  });

  it('throws ValidationError and does NOT call Supabase when the email is not allowlisted (F-1)', async () => {
    const stub = makeAuthStub({ error: null });
    vi.mocked(createServerClient).mockResolvedValue(
      stub as unknown as Awaited<ReturnType<typeof createServerClient>>,
    );

    await expect(
      attemptMagicLink('attacker@evil.example'),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(stub.auth.signInWithOtp).not.toHaveBeenCalled();

    // Log carries presence only — not the raw rejected address (SEC-05).
    const allCallsString = JSON.stringify(consoleErrorSpy?.mock.calls ?? []);
    expect(allCallsString).toContain('"error":"not_allowlisted"');
    expect(allCallsString).not.toContain('attacker@evil.example');
  });

  it('matches the allowlist case-insensitively after trim (F-1)', async () => {
    const stub = makeAuthStub({ error: null });
    vi.mocked(createServerClient).mockResolvedValueOnce(
      stub as unknown as Awaited<ReturnType<typeof createServerClient>>,
    );

    // Uppercase variant of the allowlist value must still be accepted.
    await attemptMagicLink('ALLOWED@EXAMPLE.TEST');

    expect(stub.auth.signInWithOtp).toHaveBeenCalledTimes(1);
  });

  it('throws ServiceError when ADMIN_ALLOWED_EMAIL is not configured (F-1)', async () => {
    delete process.env.ADMIN_ALLOWED_EMAIL;
    const stub = makeAuthStub({ error: null });
    vi.mocked(createServerClient).mockResolvedValue(
      stub as unknown as Awaited<ReturnType<typeof createServerClient>>,
    );

    await expect(attemptMagicLink(ALLOWED_EMAIL)).rejects.toBeInstanceOf(
      ServiceError,
    );
    expect(stub.auth.signInWithOtp).not.toHaveBeenCalled();
  });
});

describe('signInWithMagicLink (Server Action wrapper — F-12 + F-13)', () => {
  it('resolves with undefined for a valid allowlisted email (no throw on success)', async () => {
    const stub = makeAuthStub({ error: null });
    vi.mocked(createServerClient).mockResolvedValueOnce(
      stub as unknown as Awaited<ReturnType<typeof createServerClient>>,
    );

    await expect(signInWithMagicLink(ALLOWED_EMAIL)).resolves.toBeUndefined();
    expect(stub.auth.signInWithOtp).toHaveBeenCalledTimes(1);
  });

  it('resolves with undefined (does NOT throw) for a non-allowlisted email (F-13 wire-shape uniformity)', async () => {
    const stub = makeAuthStub({ error: null });
    vi.mocked(createServerClient).mockResolvedValue(
      stub as unknown as Awaited<ReturnType<typeof createServerClient>>,
    );

    await expect(
      signInWithMagicLink('attacker@evil.example'),
    ).resolves.toBeUndefined();
    expect(stub.auth.signInWithOtp).not.toHaveBeenCalled();
  });

  it('resolves with undefined (does NOT throw) for a malformed email (F-13 wire-shape uniformity)', async () => {
    await expect(signInWithMagicLink('not-an-email')).resolves.toBeUndefined();
    await expect(signInWithMagicLink('')).resolves.toBeUndefined();
  });

  it('resolves with undefined (does NOT throw) for an over-length email (F-3 rejection stays inside the F-13 envelope)', async () => {
    await expect(
      signInWithMagicLink(emailOfLength(255)),
    ).resolves.toBeUndefined();
  });

  it('resolves with undefined (does NOT throw) when Supabase fails (F-13 wire-shape uniformity)', async () => {
    const supabaseError = { name: 'AuthApiError', message: 'rate limited' };
    const stub = makeAuthStub({ error: supabaseError });
    vi.mocked(createServerClient).mockResolvedValueOnce(
      stub as unknown as Awaited<ReturnType<typeof createServerClient>>,
    );

    await expect(signInWithMagicLink(ALLOWED_EMAIL)).resolves.toBeUndefined();
  });

  it('takes at least MIN_DURATION_MS regardless of outcome (F-12 timing-channel close)', async () => {
    // Fake timers so the assertion does not wait 750ms of real wall time per
    // case. Explicitly include `performance` in the faked APIs so the
    // `performance.now()` calls inside `signInWithMagicLink` advance with
    // `vi.advanceTimersByTimeAsync` rather than returning real wall-clock
    // microseconds (which would make `elapsed > MIN_DURATION_MS` immediately
    // for the fast inner path).
    vi.useFakeTimers({ toFake: ['setTimeout', 'performance'] });
    try {
      // Track settlement via a side-effect flag so we can assert the promise is
      // still pending at sub-bound time without awaiting it.
      // Case 1: non-allowlisted (fast inner path — would normally resolve in
      // microseconds without the bound).
      let fastSettled = false;
      const fastPath = signInWithMagicLink('attacker@evil.example').then(() => {
        fastSettled = true;
      });
      // Advance up to 1ms BEFORE the bound. Use a loop of microtask flushes
      // interleaved with small timer advances so the inner `await
      // attemptMagicLink(...)` microtask chain runs and reaches the `finally`
      // block where `setTimeout` is scheduled.
      await vi.advanceTimersByTimeAsync(MIN_DURATION_MS - 1);
      expect(fastSettled).toBe(false);
      // Advance the remaining 1ms — timer fires, promise resolves.
      await vi.advanceTimersByTimeAsync(1);
      await fastPath;
      expect(fastSettled).toBe(true);

      // Case 2: allowlisted success path (slow inner path) — still bounded by
      // the same floor.
      const stub = makeAuthStub({ error: null });
      vi.mocked(createServerClient).mockResolvedValueOnce(
        stub as unknown as Awaited<ReturnType<typeof createServerClient>>,
      );
      let slowSettled = false;
      const slowPath = signInWithMagicLink(ALLOWED_EMAIL).then(() => {
        slowSettled = true;
      });
      await vi.advanceTimersByTimeAsync(MIN_DURATION_MS - 1);
      expect(slowSettled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await slowPath;
      expect(slowSettled).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
