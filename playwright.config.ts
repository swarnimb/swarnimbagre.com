import { defineConfig, devices } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Load `.env.local` into the Playwright runner's `process.env` so the webServer
 * subprocess inherits Supabase config alongside the T19.2 test-fixture vars.
 *
 * Required because setting `webServer.env.NODE_ENV='test'` makes Next.js skip
 * loading `.env.local` (Next loads `.env.test*` in test mode, which we don't
 * use). Without this loader, `assertRequiredEnv` in `next.config.ts` would
 * throw on every Playwright run. No `dotenv` devDep — parser is a few lines.
 *
 * Lines starting with `#` and blank lines are skipped. Quoted values are
 * unquoted. Pre-existing process.env entries are NOT overwritten.
 */
function loadDotEnvLocal(path: string): void {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
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

loadDotEnvLocal(resolve(process.cwd(), '.env.local'));

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3100',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'next dev -p 3100',
    url: 'http://localhost:3100',
    reuseExistingServer: true,
    timeout: 120_000,
    // NODE_ENV='test' is one of the three gates on /api/test/sign-in (T19.2).
    // Next dev warns but honors a user-set NODE_ENV; in test mode Next does
    // NOT load `.env.local`, so the required Supabase vars must be forwarded
    // explicitly via this block (loadDotEnvLocal above primes process.env).
    // VERCEL stays unset locally; the env-gate refuses on Vercel deploys
    // regardless of NODE_ENV.
    env: {
      NODE_ENV: 'test',
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
      ADMIN_ALLOWED_EMAIL: process.env.ADMIN_ALLOWED_EMAIL ?? '',
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? '',
      TEST_FIXTURE_SECRET: process.env.TEST_FIXTURE_SECRET ?? '',
      TEST_FIXTURE_EMAIL: process.env.TEST_FIXTURE_EMAIL ?? '',
    },
  },
});
