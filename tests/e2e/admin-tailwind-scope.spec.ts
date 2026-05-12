import { test, expect } from '@playwright/test';

test.describe('T15 - Tailwind admin scoping', () => {
  test('public route HTML contains no admin Tailwind classes', async ({ page }) => {
    await page.goto('/');
    const html = await page.content();
    expect(html).not.toContain('class="p-4');
    expect(html).not.toContain('text-fg');
  });

  test('admin route HTML contains Tailwind utility classes', async ({ page }) => {
    await page.goto('/admin');
    const html = await page.content();
    expect(html).toContain('p-4');
    expect(html).toContain('text-fg');
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
