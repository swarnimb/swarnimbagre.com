const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

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
