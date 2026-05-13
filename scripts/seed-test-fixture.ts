/**
 * T19.2 — One-off CLI to provision the Playwright test fixture user in
 * Supabase Auth.
 *
 * Idempotent: re-running after the user exists is a no-op (exit 0). Reads the
 * three required env vars below and uses the service-role key via
 * `auth.admin.createUser` to create a pre-confirmed account. The fixture
 * email lives on a subdomain (`test.swarnimbagre.com`) with no MX record so
 * the magic-link mails Supabase queues are black-holed at the DNS edge — the
 * test rig never actually sends mail. See `docs/plan-phase-2-admin.md` T19.2
 * and the locked `@supabase` consult.
 *
 * Run with: `npx tsx scripts/seed-test-fixture.ts`
 *
 * Exit codes:
 *   0 — user created OR already exists (idempotent)
 *   1 — any other failure (config error, network error, unexpected API error)
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

/** Required env var that names the fixture user's email. */
const ENV_FIXTURE_EMAIL = 'TEST_FIXTURE_EMAIL';

/**
 * Substring Supabase Auth returns when `createUser` is called for an email
 * that already has a record. Matched against `error.message` (case-insensitive
 * via `.toLowerCase()`). Named so the idempotent-no-op branch is not a magic
 * string (CQ-04). Source: Supabase Auth v2 — `Email address ... has already
 * been registered` / `User already registered`.
 */
const ALREADY_REGISTERED_TOKENS = [
  'already been registered',
  'already registered',
  'user already exists',
];

/** Process exit code for success or idempotent no-op. */
const EXIT_SUCCESS = 0;

/** Process exit code for any failure that requires user intervention. */
const EXIT_FAILURE = 1;

/**
 * Named error class for fixture-seed failures (EH-05).
 *
 * Carries the operation name and the underlying cause so the CLI stack trace
 * surfaces what failed (EH-02). Never carries env values or secret material.
 */
export class TestFixtureSetupError extends Error {
  public readonly operation: string;

  constructor(message: string, options: { operation: string; cause?: unknown }) {
    super(message, { cause: options.cause });
    this.name = 'TestFixtureSetupError';
    this.operation = options.operation;
  }
}

/**
 * Minimal `.env.local` parser. Avoids adding `dotenv` as a devDep just for one
 * script. Lines starting with `#` and blank lines are skipped. Quoted values
 * are unquoted. Anything malformed is silently skipped — the next required-var
 * check throws a loud, contextual error if a needed value is missing.
 *
 * @param path Absolute path to the env file.
 */
function loadDotEnvLocal(path: string): void {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    // No .env.local — fall through to process.env. Tests may inject env directly.
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
 * @throws TestFixtureSetupError when the var is unset or empty.
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new TestFixtureSetupError(
      `Missing required environment variable: ${name}.`,
      { operation: 'requireEnv' },
    );
  }
  return value.trim();
}

/**
 * Returns true when the Supabase error message indicates the user already
 * exists. Comparison is case-insensitive and substring-based — Supabase has
 * varied the exact phrasing across versions.
 */
function isAlreadyRegistered(message: string | undefined): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return ALREADY_REGISTERED_TOKENS.some((token) => lower.includes(token));
}

/**
 * Create the fixture user, idempotently. Logs progress in dry voice
 * (CONSTRAINT-13). Throws TestFixtureSetupError on unexpected failures so the
 * full stack trace surfaces at the CLI (EH-02).
 *
 * @returns A short status string indicating which branch was taken.
 */
async function seedFixtureUser(): Promise<'created' | 'already_exists'> {
  const url = requireEnv(ENV_SUPABASE_URL);
  const serviceRoleKey = requireEnv(ENV_SERVICE_ROLE_KEY);
  const email = requireEnv(ENV_FIXTURE_EMAIL);

  console.log(`Creating fixture user ${email}...`);

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });

  if (!error) {
    console.log('Created.');
    return 'created';
  }

  if (isAlreadyRegistered(error.message)) {
    console.log('Already exists -- no-op.');
    return 'already_exists';
  }

  throw new TestFixtureSetupError(`Failed: ${error.message}`, {
    operation: 'seedFixtureUser',
    cause: error,
  });
}

/**
 * CLI entry. Loads `.env.local` if present, then invokes `seedFixtureUser`.
 * Surfaces failures with full stack trace (EH-02) and exits non-zero.
 */
async function main(): Promise<void> {
  loadDotEnvLocal(resolve(process.cwd(), '.env.local'));
  try {
    await seedFixtureUser();
    process.exit(EXIT_SUCCESS);
  } catch (cause) {
    console.error('[seed-test-fixture] aborted', cause);
    process.exit(EXIT_FAILURE);
  }
}

void main();
