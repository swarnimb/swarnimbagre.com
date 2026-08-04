import { test, expect } from '@playwright/test';

/**
 * CONSTRAINT-16: admin uses Inter (loaded by the admin route group's own
 * layout), never a public-site signature font. Using one there would dilute
 * the public site's identity.
 *
 * T46 re-pointed the negative assertion. It used to guard against Fraunces,
 * which no longer exists anywhere in the project. The public display face is
 * now Instrument Serif, so that is what must not leak into admin.
 */
test('admin root inherits Inter, not the public display serif', async ({ page }) => {
  await page.goto('/admin');
  const fontFamily = await page.locator('.admin-root').evaluate(
    (el) => getComputedStyle(el).fontFamily
  );
  expect(fontFamily.toLowerCase()).toContain('inter');
  expect(fontFamily.toLowerCase()).not.toContain('instrument serif');
  expect(fontFamily.toLowerCase()).not.toContain('space grotesk');
});
