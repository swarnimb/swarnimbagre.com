/**
 * T19.2 — Triple-gated test-only fixture route.
 *
 * Mints a Supabase session bound to the SSR cookie jar so Playwright specs
 * can land on `/admin` already authenticated WITHOUT round-tripping a real
 * inbox. Gated on three independent conditions; any failure returns 404 so
 * the route is indistinguishable from a non-existent path:
 *
 *   1. `NODE_ENV === 'test'` — build-time / runtime guard. `next build` does
 *      NOT set NODE_ENV='test', so this branch is dead in production output.
 *   2. `process.env.VERCEL !== '1'` — second guard. Vercel injects VERCEL=1
 *      in every Production and Preview deploy, so a build that somehow made
 *      it into Vercel (e.g., NODE_ENV override) still refuses.
 *   3. `timingSafeEqual` on header `x-fixture-secret` against
 *      `TEST_FIXTURE_SECRET`. The secret is set in `.env.local` and in CI
 *      runner secrets only — never in Vercel.
 *
 * Internally uses `auth.admin.generateLink({ type: 'magiclink' })` to obtain
 * a `token_hash`, then `verifyOtp({ token_hash, type: 'email' })` against the
 * SSR-bound client to write the session cookie. The shape matches the
 * production callback at `app/(admin)/admin/auth/callback/route.ts` so the
 * test path exercises the same code as a real magic-link redemption.
 *
 * SEC-09 N/A — this is a Route Handler, not a Server Action, and is not
 * exported from any `'use server'` module. The Server Action allowlist in
 * `tests/server-actions-manifest.test.ts` is unaffected.
 *
 * Service-role env reads are inside the POST handler body — never at module
 * scope — to keep the key out of any build-time inlined bundle.
 */

import { timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@/lib/supabase';

/** Operation tag for structured log lines from this route (EH-02). */
const ROUTE_OPERATION = 'apiTestSignIn';

/** 404: returned for any gate failure. Indistinguishable from a missing route. */
const STATUS_NOT_FOUND = 404;

/** 500: returned when Supabase admin/SSR auth surfaces report an unexpected error. */
const STATUS_SERVER_ERROR = 500;

/** 204: returned on successful session mint. Empty body — caller only needs the Set-Cookie. */
const STATUS_NO_CONTENT = 204;

/** Header name that carries the fixture secret. */
const FIXTURE_SECRET_HEADER = 'x-fixture-secret';

/**
 * Env-var key name held in a variable so the lookup `process.env[NODE_ENV_KEY]`
 * is NOT statically replaced by Next's compile-time NODE_ENV inlining.
 *
 * Next (via webpack `DefinePlugin` + SWC's env transform) inlines BOTH
 * `process.env.NODE_ENV` (member expression) and `process.env['NODE_ENV']`
 * (computed member with a string literal) as `'development'` under `next dev`
 * and `'production'` under `next build`. Only a computed read whose key is a
 * variable (not a string literal) preserves the real runtime value.
 *
 * Playwright sets `NODE_ENV='test'` via `webServer.env`. Without this
 * indirection the dev-mode comparison would always be `'development' !== 'test'`
 * and the route would be permanently 404, with no way to drive E2E tests.
 */
const NODE_ENV_KEY = 'NODE_ENV';

/**
 * Log a fixture-route failure with structured context. Never logs the secret
 * header value, the token_hash, or any session material (SEC-05).
 */
function logFixtureFailure(reason: string, error?: unknown): void {
  console.error(`[auth] ${ROUTE_OPERATION} failed`, {
    operation: ROUTE_OPERATION,
    reason,
    nodeEnv: process.env[NODE_ENV_KEY] ?? null,
    vercel: process.env.VERCEL ?? null,
    error,
  });
}

/**
 * Refuse the request unless the runtime is the test rig. Returns a 404
 * Response on refusal; null when the environment is acceptable.
 *
 * Production safety: Vercel sets `NODE_ENV='production'` at runtime, so the
 * `!== 'test'` comparison refuses there. The independent `VERCEL=1` gate and
 * the secret gate (TEST_FIXTURE_SECRET is never set on Vercel) provide
 * defense-in-depth.
 */
function assertTestEnvironment(): Response | null {
  if (process.env[NODE_ENV_KEY] !== 'test') {
    return new Response(null, { status: STATUS_NOT_FOUND });
  }
  if (process.env.VERCEL === '1') {
    return new Response(null, { status: STATUS_NOT_FOUND });
  }
  return null;
}

/**
 * Refuse the request unless the `x-fixture-secret` header matches the
 * `TEST_FIXTURE_SECRET` env var, compared with `timingSafeEqual` to remove
 * any length-leak side channel. Equal-length precondition is enforced first
 * because `timingSafeEqual` throws on unequal-length buffers — and length
 * mismatch is itself the cheapest possible reject. Returns a 404 Response
 * on refusal; null when the secret matches.
 */
function assertFixtureSecret(req: Request): Response | null {
  const provided = req.headers.get(FIXTURE_SECRET_HEADER) ?? '';
  const expected = process.env.TEST_FIXTURE_SECRET ?? '';
  if (expected.length === 0) {
    return new Response(null, { status: STATUS_NOT_FOUND });
  }
  if (provided.length !== expected.length) {
    return new Response(null, { status: STATUS_NOT_FOUND });
  }
  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);
  if (!timingSafeEqual(providedBuf, expectedBuf)) {
    return new Response(null, { status: STATUS_NOT_FOUND });
  }
  return null;
}

/**
 * Mint a Supabase session for `email`. Generates a magic-link token via the
 * admin API, then redeems it through the SSR client so the session cookies
 * land in the request's cookie jar. Returns a 204 on success; a logged 500
 * on any Supabase failure.
 */
async function mintFixtureSession(email: string): Promise<Response> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!url || !serviceRoleKey) {
    logFixtureFailure('missing supabase config env vars');
    return new Response(null, { status: STATUS_SERVER_ERROR });
  }
  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  if (error || !data?.properties?.hashed_token) {
    logFixtureFailure('generateLink returned no hashed_token', error);
    return new Response(null, { status: STATUS_SERVER_ERROR });
  }
  const ssr = await createServerClient();
  const { error: verifyError } = await ssr.auth.verifyOtp({
    token_hash: data.properties.hashed_token,
    type: 'email',
  });
  if (verifyError) {
    logFixtureFailure('verifyOtp returned error', verifyError);
    return new Response(null, { status: STATUS_SERVER_ERROR });
  }
  return new Response(null, { status: STATUS_NO_CONTENT });
}

/**
 * Test-only fixture route. Triple-gated. 404 in any non-test runtime.
 * SEC-09 N/A — not a Server Action, not in the Server Action allowlist.
 *
 * Body: ignored — the fixture user identity comes from `TEST_FIXTURE_EMAIL`
 * env so test specs cannot forge a different identity by POST payload.
 * Header: `x-fixture-secret` required, validated with `timingSafeEqual`.
 *
 * @param req Incoming request.
 * @returns 204 on success, 404 on any gate failure, 500 on Supabase failure.
 */
export async function POST(req: Request): Promise<Response> {
  const envRejection = assertTestEnvironment();
  if (envRejection) return envRejection;

  const secretRejection = assertFixtureSecret(req);
  if (secretRejection) return secretRejection;

  const email = process.env.TEST_FIXTURE_EMAIL ?? '';
  if (!email) {
    logFixtureFailure('missing TEST_FIXTURE_EMAIL env');
    return new Response(null, { status: STATUS_SERVER_ERROR });
  }

  return mintFixtureSession(email);
}
