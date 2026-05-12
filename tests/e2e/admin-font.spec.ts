import { test, expect } from '@playwright/test';

test('admin root inherits Inter font, not Fraunces', async ({ page }) => {
  await page.goto('/admin');
  const fontFamily = await page.locator('.admin-root').evaluate(
    (el) => getComputedStyle(el).fontFamily
  );
  expect(fontFamily.toLowerCase()).toContain('inter');
  expect(fontFamily.toLowerCase()).not.toContain('fraunces');
});
