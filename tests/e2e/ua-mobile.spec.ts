import { test, expect } from '@playwright/test';

const MOBILE_MARKER = "things I've built and broken";
const DESKTOP_MARKER = "※ projects";

test.use({
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
});

test('mobile UA serves the mobile Home variant', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText(MOBILE_MARKER, { exact: false })).toBeVisible();
  await expect(page.getByText(DESKTOP_MARKER, { exact: false })).not.toBeVisible();
});
