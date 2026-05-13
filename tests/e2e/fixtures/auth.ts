/**
 * T19.2 — Playwright auth fixture.
 *
 * Establishes an authenticated admin session on the active BrowserContext by
 * POSTing to the triple-gated `/api/test/sign-in` route. The route returns
 * 204 and Set-Cookie writes the Supabase SSR session cookies onto the
 * context's cookie jar, so subsequent `page.goto('/admin')` calls render the
 * authenticated surface.
 *
 * This helper is only viable when `NODE_ENV === 'test'`. In Production /
 * Preview deploys, `/api/test/sign-in` returns 404 (see route doc-block) —
 * importing or calling this helper from any non-test code path will fail.
 */

import type { BrowserContext, Page } from '@playwright/test';

/** Path of the gated fixture route. Single source of truth for callers. */
const SIGN_IN_PATH = '/api/test/sign-in';

/** Header name the fixture route reads the shared secret from. */
const FIXTURE_SECRET_HEADER = 'x-fixture-secret';

/** HTTP status the fixture route returns on a successful session mint. */
const EXPECTED_OK_STATUS = 204;

/**
 * Named error class for the "secret missing from runner env" case (EH-05).
 *
 * Carries operation context so the failure surfaces what the test rig needs
 * to fix (typically: add `TEST_FIXTURE_SECRET` to `.env.local` and confirm
 * `playwright.config.ts` forwards it to the webServer).
 */
export class TestFixtureMissingSecretError extends Error {
  public readonly operation: string;

  constructor(operation: string) {
    super(
      `TEST_FIXTURE_SECRET is not set in the test runner environment. ` +
        `Set it in .env.local and confirm playwright.config.ts forwards it ` +
        `to webServer.env. operation=${operation}`,
    );
    this.name = 'TestFixtureMissingSecretError';
    this.operation = operation;
  }
}

/**
 * Named error class for the "fixture route did not return 204" case (EH-05).
 *
 * Carries the actual status, the response body (best-effort, may be empty),
 * and the operation tag so a failed test gives the engineer enough context
 * to triage without re-running with verbose tracing.
 */
export class TestFixtureSignInError extends Error {
  public readonly operation: string;
  public readonly status: number;

  constructor(options: { operation: string; status: number; body: string }) {
    super(
      `Fixture sign-in failed. operation=${options.operation} ` +
        `status=${options.status} body=${options.body.slice(0, 200)}`,
    );
    this.name = 'TestFixtureSignInError';
    this.operation = options.operation;
    this.status = options.status;
  }
}

/**
 * Sign the Playwright BrowserContext in as the admin fixture user.
 *
 * Calls the triple-gated `/api/test/sign-in` fixture route. Production and
 * Preview deployments return 404 — this helper is only viable in
 * `NODE_ENV === 'test'`.
 *
 * On success, the Supabase SSR session cookie lives on the BrowserContext;
 * subsequent navigations to `/admin` render the authenticated surface.
 *
 * @param page    The Playwright Page used to navigate to /admin after sign-in.
 * @param context The Playwright BrowserContext that will hold the session cookie.
 * @throws TestFixtureMissingSecretError when TEST_FIXTURE_SECRET is unset.
 * @throws TestFixtureSignInError       when the fixture route does not return 204.
 */
export async function loginAsAdmin(
  page: Page,
  context: BrowserContext,
): Promise<void> {
  const operation = 'loginAsAdmin';
  const secret = process.env.TEST_FIXTURE_SECRET;
  if (!secret || secret.length === 0) {
    throw new TestFixtureMissingSecretError(operation);
  }

  const response = await context.request.post(SIGN_IN_PATH, {
    headers: { [FIXTURE_SECRET_HEADER]: secret },
  });
  if (response.status() !== EXPECTED_OK_STATUS) {
    const body = await response.text().catch(() => '');
    throw new TestFixtureSignInError({
      operation,
      status: response.status(),
      body,
    });
  }

  await page.goto('/admin');
  await page.waitForURL('**/admin');
}
