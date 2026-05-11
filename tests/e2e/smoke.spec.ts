import { test, expect } from '@playwright/test';

test('home page renders a stable element', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('No cookies, no analytics', { exact: false })).toBeVisible();
});
