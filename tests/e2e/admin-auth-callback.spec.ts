import { test, expect } from '@playwright/test';

/**
 * T17 acceptance: the `/admin/auth/callback` route is reachable, handles a
 * payload it cannot verify, and never crashes the user into a 500. The full
 * verifyOtp / exchangeCodeForSession success path can only be exercised
 * against a real Supabase project — out of scope for unit-level e2e.
 *
 * This test asserts the contract that matters at the routing layer:
 * the handler runs, decides the payload is invalid, logs internally, and
 * redirects to `/admin/login` with a generic `error=callback_failed` query
 * (EH-04, SEC-05). No token leaks, no internal detail in the URL.
 */
test('admin auth callback with a bogus payload redirects to /admin/login with a generic error', async ({ page }) => {
  const response = await page.goto('/admin/auth/callback?token_hash=invalid&type=email', {
    waitUntil: 'load',
  });

  // After the redirect chain settles, the user lands on /admin/login.
  await expect(page).toHaveURL(/\/admin\/login(\?|$)/);

  // The redirect carries the generic error code — no token, no Supabase detail.
  const finalUrl = page.url();
  expect(finalUrl).toContain('error=callback_failed');
  expect(finalUrl).not.toContain('invalid');

  // The handler returned a non-error response (it redirected, not crashed).
  expect(response?.status() ?? 0).toBeLessThan(500);
});
