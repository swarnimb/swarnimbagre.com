const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

/** Env var that names the sole email allowed to sign in to the admin panel. */
const ADMIN_ALLOWED_EMAIL_VAR = 'ADMIN_ALLOWED_EMAIL';

/**
 * Fail loud at startup if any required env var is missing. Called from
 * `next.config.ts` so a missing var blocks both `next dev` and `next build`.
 *
 * @throws Error listing every missing variable, pointing at `docs/env-vars.md`.
 */
export function assertRequiredEnv(): void {
  const missing = REQUIRED_ENV_VARS.filter((name) => !process.env[name]);
  if (missing.length === 0) return;

  throw new Error(
    `Missing required environment variable(s): ${missing.join(', ')}. ` +
      `Set them in .env.local (local development) or the Vercel dashboard ` +
      `(Preview + Production). See docs/env-vars.md for source values.`,
  );
}

/**
 * Return the allowlisted admin email, normalized for comparison.
 *
 * The value is read fresh on every call so test setups can override via
 * `vi.stubEnv` and so a deployment rotation takes effect without a process
 * restart. The check is security-critical (CONSTRAINT-09) — missing config is
 * a refusal, not a permissive default (SEC-04). Lowercase + trim is applied so
 * call sites can compare with `===` against a similarly-normalized candidate
 * without re-doing the normalization themselves.
 *
 * @returns The trimmed lowercase allowlisted email.
 * @throws Error when `ADMIN_ALLOWED_EMAIL` is unset or empty.
 */
export function getAdminAllowedEmail(): string {
  const raw = process.env[ADMIN_ALLOWED_EMAIL_VAR];
  if (!raw || raw.trim().length === 0) {
    throw new Error(
      `Missing required environment variable: ${ADMIN_ALLOWED_EMAIL_VAR}. ` +
        `This var enforces CONSTRAINT-09 (single-user admin allowlist). ` +
        `Set it in .env.local and the Vercel dashboard. See docs/env-vars.md.`,
    );
  }
  return raw.trim().toLowerCase();
}
