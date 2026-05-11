import { test, expect } from '@playwright/test';

const MOBILE_MARKER = "things I've built and broken";
const DESKTOP_MARKER = "※ projects";

test.use({
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
});

test('desktop UA serves the desktop Home variant', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText(DESKTOP_MARKER, { exact: false })).toBeVisible();
  await expect(page.getByText(MOBILE_MARKER, { exact: false })).not.toBeVisible();
});
