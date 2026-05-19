import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './fixtures/auth';

/**
 * TS-04 (e2e) — full sign-out flow.
 *
 * Asserts the user-facing contract of `signOut`:
 *
 *   1. Click "Sign out" on an authenticated admin surface → URL settles at
 *      /admin/login.
 *   2. Browser back after sign-out does NOT restore an authenticated
 *      session — the middleware gate must re-redirect to /admin/login.
 *   3. F-19 (audit pass 5) — after sign-out, no Supabase session cookies
 *      remain on the BrowserContext. The `sb-<project-ref>-auth-token`
 *      cookie family (including chunked variants `.0`, `.1`, ...) must be
 *      absent. The refresh token is stored inside this unified cookie's
 *      payload by `@supabase/ssr`'s implicit flow, not as a separate cookie.
 *
 * Authentication is established by `loginAsAdmin()` (T19.2). That helper
 * POSTs to the triple-gated `/api/test/sign-in` route which mints a Supabase
 * session bound to the BrowserContext cookie jar. The route returns 404 in
 * any non-test runtime, so this fixture is local- / CI-only by construction.
 */

const ADMIN_URL = '/admin';
const LOGIN_URL_RE = /\/admin\/login(\?|$)/;

/**
 * F-19 cookie family that must be cleared on sign-out. Matches the
 * `@supabase/ssr` implicit-flow naming scheme: `sb-<project-ref>-auth-token`
 * plus the chunked variants (`.0`, `.1`, ...) that the SSR helper emits when
 * the cookie payload exceeds browser size limits. The refresh token lives
 * inside this unified cookie's payload, so a separate `-refresh-token` regex
 * matches nothing under the current Supabase client. The cookie name shape
 * is part of Supabase's stable API, not a magic value — but the F-19
 * reference earns the comment. F-24 (audit 7) tightened the regex to cover
 * the chunked variants.
 */
const SUPABASE_AUTH_COOKIE_RE = /^sb-.*-auth-token(\.[0-9]+)?$/;

test.describe('TS-04 — admin sign-out flow', () => {
  // Serial: tests share a single fixture user; concurrent generateLink invalidates in-flight tokens.
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page, context }) => {
    await loginAsAdmin(page, context);
  });

  test('clicking "Sign out" from /admin lands the user on /admin/login', async ({
    page,
    context,
  }) => {
    await page.goto(ADMIN_URL);

    // Sanity: we actually rendered the authenticated surface before clicking.
    await expect(page.getByRole('heading', { level: 1, name: 'Projects' })).toBeVisible();

    await page.getByRole('button', { name: /^sign out$/i }).click();

    await expect(page).toHaveURL(LOGIN_URL_RE);

    // F-19: after sign-out, no Supabase session cookies remain on the context.
    const cookies = await context.cookies();
    const supabaseSessionCookies = cookies.filter((c) =>
      SUPABASE_AUTH_COOKIE_RE.test(c.name),
    );
    expect(supabaseSessionCookies).toHaveLength(0);
  });

  test('browser back after sign-out does NOT restore the authenticated session (middleware re-redirects to /admin/login)', async ({
    page,
  }) => {
    await page.goto(ADMIN_URL);
    await page.getByRole('button', { name: /^sign out$/i }).click();
    await expect(page).toHaveURL(LOGIN_URL_RE);

    // Browser back. Two acceptable outcomes:
    //   - URL stays at /admin/login (the back step is a no-op because the
    //     server response was a 307 that didn't push a history entry), OR
    //   - URL momentarily reads /admin but the middleware admin gate
    //     immediately redirects back to /admin/login.
    // Either way the user must NOT be on /admin authenticated.
    await page.goBack();
    await expect(page).toHaveURL(LOGIN_URL_RE);

    // Re-assert the negative: no admin landing heading is visible. (Post-redirect:
    // the signed-in admin lands on /admin/projects with heading "Projects".)
    await expect(page.getByRole('heading', { level: 1, name: 'Projects' })).toHaveCount(0);
  });
});
