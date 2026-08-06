import { test, expect } from '@playwright/test';

/**
 * CONSTRAINT-03 guard: Tailwind is admin-only and must never reach the public
 * bundle.
 *
 * The canary classes below are asserted in BOTH directions — present in the
 * admin shell, absent from public HTML — so the negative test cannot pass
 * vacuously. That was the previous failure mode: the canaries were `p-4` and
 * `text-fg`, and by T46 neither appeared in any rendered admin markup (`p-4`
 * survives only in `app/(admin)/error.tsx`, which does not render on the login
 * page these tests land on; `text-fg` was never a class in this Tailwind
 * config at all, since admin tokens are `--admin-*` mapped to shadcn slot
 * names). The "public has no admin classes" test therefore passed by asserting
 * the absence of strings that existed nowhere, while its admin counterpart
 * failed.
 *
 * Both strings below are taken from `app/(admin)/admin/login/page.tsx`, which
 * is what `/admin` redirects an unauthenticated request to. They are
 * distinctive enough not to collide with a chunk hash or an inlined stylesheet
 * on a public page.
 */
const ADMIN_TAILWIND_CANARIES = ['min-h-screen', 'text-foreground'] as const;

test.describe('T15 - Tailwind admin scoping', () => {
  test('public route HTML contains no admin Tailwind classes', async ({ page }) => {
    await page.goto('/');
    const html = await page.content();
    for (const canary of ADMIN_TAILWIND_CANARIES) {
      expect(html, `public HTML leaked the admin Tailwind class "${canary}"`).not.toContain(canary);
    }
  });

  test('admin route HTML contains Tailwind utility classes', async ({ page }) => {
    await page.goto('/admin');
    const html = await page.content();
    for (const canary of ADMIN_TAILWIND_CANARIES) {
      expect(html, `admin HTML is missing the Tailwind class "${canary}"`).toContain(canary);
    }
  });

  test('public route computed style unchanged after navigating from admin', async ({ page }) => {
    await page.goto('/');
    const baselineBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const baselineColor = await page.evaluate(() => getComputedStyle(document.body).color);

    await page.goto('/admin');
    await page.goto('/');

    const afterBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const afterColor = await page.evaluate(() => getComputedStyle(document.body).color);

    expect(afterBg).toBe(baselineBg);
    expect(afterColor).toBe(baselineColor);
  });
});
