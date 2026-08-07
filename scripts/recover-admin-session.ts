/**
 * Lockout escape hatch — mint an admin sign-in URL without sending any email.
 *
 * The magic-link inbox is the only routine way into `/admin`. When it is
 * unavailable (lost access, provider outage, deliverability failure) this
 * script produces the same thing the inbox would have produced: a one-time
 * `token_hash` the production callback at
 * `app/(admin)/admin/auth/callback/route.ts` will redeem via `verifyOtp`.
 *
 * How it works — it is the same two-step the test fixture route uses
 * (`app/api/test/sign-in/route.ts`):
 *
 *   1. `auth.admin.generateLink({ type: 'magiclink' })` with the service-role
 *      key returns `properties.hashed_token`. No inbox is involved in reading
 *      it back.
 *   2. That hash is pasted into `{origin}/admin/auth/callback?token_hash=
 *      <hash>&type=email`, which is exactly the shape the callback's
 *      `token_hash` branch accepts (`type` must be `email` or `magiclink` —
 *      see `VALID_EMAIL_OTP_TYPES`). The callback calls `verifyOtp`, the SSR
 *      helper writes the session cookies, and the browser lands on `/admin`.
 *
 * Nothing here touches Supabase's redirect-URL allowlist or the Site URL: the
 * browser goes straight to this app's callback route, never to
 * `/auth/v1/verify`. That is the whole reason this path works when the
 * dashboard's own "copy link" flows do not.
 *
 * The generated token still passes the callback's `rejectIfNotAllowlisted`
 * check, so it can only ever mint a session for `ADMIN_ALLOWED_EMAIL`. The
 * email is read from env rather than argv for the same reason
 * `/api/test/sign-in` does it: the identity is not a caller-supplied argument.
 *
 * Run with: `npx tsx scripts/recover-admin-session.ts [origin]`
 *
 *   origin — optional. Defaults to NEXT_PUBLIC_SITE_URL, then to a
 *            https://-prefixed NEXT_PUBLIC_VERCEL_URL. Pass
 *            `http://localhost:3000` to recover against a local dev server
 *            instead of production.
 *
 * Operational notes:
 *   - The printed URL is single-use and short-lived (Supabase's email-OTP
 *     expiry, 1 hour by default). Treat it as a live credential: it is a
 *     session in a string. Do not paste it into chat, a ticket, or a commit.
 *   - Requires SUPABASE_SERVICE_ROLE_KEY, so it only helps an operator who
 *     still holds that key. If the key is also lost, this script is no use.
 *   - The Supabase user record must already exist. `generateLink` does not
 *     create it.
 *
 * Exit codes:
 *   0 — a recovery URL was printed
 *   1 — any failure (missing config, missing user, Supabase error)
 *
 * Voice: dry. No decoration. No emoji.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Required env var that names the Supabase project URL. */
const ENV_SUPABASE_URL = 'NEXT_PUBLIC_SUPABASE_URL';

/** Required env var that holds the service-role key (server-only, bypasses RLS). */
const ENV_SERVICE_ROLE_KEY = 'SUPABASE_SERVICE_ROLE_KEY';

/** Required env var naming the single admin identity (CONSTRAINT-09). */
const ENV_ADMIN_EMAIL = 'ADMIN_ALLOWED_EMAIL';

/** Preferred origin source — same var `lib/auth-internal.ts::getSiteUrl` reads first. */
const ENV_SITE_URL = 'NEXT_PUBLIC_SITE_URL';

/** Fallback origin source. Vercel supplies the host without a scheme. */
const ENV_VERCEL_URL = 'NEXT_PUBLIC_VERCEL_URL';

/** Path of the route handler that redeems the token. Must match CONSTRAINT-17. */
const CALLBACK_PATH = '/admin/auth/callback';

/**
 * `type` query value written into the recovery URL. Both `email` and
 * `magiclink` are accepted by the callback, but `email` is the pairing the
 * E2E fixture route already exercises against a `generateLink({ type:
 * 'magiclink' })` token, so it is the one with mileage on it.
 */
const CALLBACK_OTP_TYPE = 'email';

/** Process exit code for a successfully generated URL. */
const EXIT_SUCCESS = 0;

/** Process exit code for any failure that requires operator intervention. */
const EXIT_FAILURE = 1;

/**
 * Named error class for recovery failures (EH-05).
 *
 * Carries the operation name and the underlying cause so the CLI stack trace
 * surfaces what failed (EH-02). Never carries env values or secret material.
 */
export class AdminRecoveryError extends Error {
  public readonly operation: string;

  constructor(message: string, options: { operation: string; cause?: unknown }) {
    super(message, { cause: options.cause });
    this.name = 'AdminRecoveryError';
    this.operation = options.operation;
  }
}

/**
 * Minimal `.env.local` parser, matching `scripts/seed-test-fixture.ts` rather
 * than adding `dotenv` as a devDep for two scripts. Comments and blank lines
 * are skipped, quoted values are unquoted, malformed lines are ignored — the
 * required-var checks below fail loud if anything needed is absent.
 *
 * @param path Absolute path to the env file.
 */
function loadDotEnvLocal(path: string): void {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    // No .env.local — fall through to process.env.
    return;
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

/**
 * Read a required env var or throw a loud, named error (EH-02, EH-05).
 *
 * @param name The env var name.
 * @returns The variable's value, never empty.
 * @throws AdminRecoveryError when the var is unset or empty.
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new AdminRecoveryError(
      `Missing required environment variable: ${name}.`,
      { operation: 'requireEnv' },
    );
  }
  return value.trim();
}

/**
 * Resolve the origin the recovery URL is anchored to.
 *
 * Precedence: explicit CLI argument, then NEXT_PUBLIC_SITE_URL, then a
 * https://-prefixed NEXT_PUBLIC_VERCEL_URL. Mirrors
 * `lib/auth-internal.ts::getSiteUrl` so a recovery URL points at the same
 * origin a real magic link would have.
 *
 * @param argvOrigin Optional origin passed on the command line.
 * @returns Absolute origin with no trailing slash.
 * @throws AdminRecoveryError when no origin can be determined.
 */
function resolveOrigin(argvOrigin: string | undefined): string {
  const candidate =
    argvOrigin?.trim() ||
    process.env[ENV_SITE_URL]?.trim() ||
    (process.env[ENV_VERCEL_URL]?.trim()
      ? `https://${process.env[ENV_VERCEL_URL]!.trim()}`
      : '');
  if (!candidate) {
    throw new AdminRecoveryError(
      `No origin. Pass one as the first argument, or set ${ENV_SITE_URL} / ${ENV_VERCEL_URL}.`,
      { operation: 'resolveOrigin' },
    );
  }
  if (!/^https?:\/\//.test(candidate)) {
    throw new AdminRecoveryError(
      `Origin must include a scheme (http:// or https://). Got: ${candidate}`,
      { operation: 'resolveOrigin' },
    );
  }
  return candidate.replace(/\/$/, '');
}

/**
 * Generate a one-time magic-link token via the admin API and assemble the
 * callback URL that redeems it. No email is requested from Supabase by this
 * call path — the token comes back in the API response.
 *
 * @param origin Absolute origin the callback lives on.
 * @returns The paste-ready recovery URL.
 * @throws AdminRecoveryError on missing config or any Supabase failure.
 */
async function buildRecoveryUrl(origin: string): Promise<string> {
  const url = requireEnv(ENV_SUPABASE_URL);
  const serviceRoleKey = requireEnv(ENV_SERVICE_ROLE_KEY);
  const email = requireEnv(ENV_ADMIN_EMAIL);

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });

  if (error) {
    throw new AdminRecoveryError(`generateLink failed: ${error.message}`, {
      operation: 'buildRecoveryUrl',
      cause: error,
    });
  }

  const hashedToken = data?.properties?.hashed_token;
  if (!hashedToken) {
    throw new AdminRecoveryError('generateLink returned no hashed_token.', {
      operation: 'buildRecoveryUrl',
    });
  }

  const params = new URLSearchParams({
    token_hash: hashedToken,
    type: CALLBACK_OTP_TYPE,
  });
  return `${origin}${CALLBACK_PATH}?${params.toString()}`;
}

/**
 * CLI entry. Loads `.env.local` if present, prints one recovery URL, and
 * surfaces failures with a full stack trace (EH-02) before exiting non-zero.
 */
async function main(): Promise<void> {
  loadDotEnvLocal(resolve(process.cwd(), '.env.local'));
  try {
    const origin = resolveOrigin(process.argv[2]);
    const recoveryUrl = await buildRecoveryUrl(origin);
    console.log('One-time admin sign-in URL. Single use. Expires on the');
    console.log('project email-OTP expiry (1 hour by default). Open it in a');
    console.log('browser; do not share, paste into chat, or commit it.');
    console.log('');
    console.log(recoveryUrl);
    process.exit(EXIT_SUCCESS);
  } catch (cause) {
    console.error('[recover-admin-session] aborted', cause);
    process.exit(EXIT_FAILURE);
  }
}

void main();
