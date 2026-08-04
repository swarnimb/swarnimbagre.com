import { test, expect } from '@playwright/test';

/**
 * One stable text marker per public route.
 *
 * T46 replaced the Home marker. It used to assert the page-contextual footer
 * line ("No cookies, no analytics, pure vibes."), but the redesign has no
 * footer on any page. The chat question bubble is the equivalent anchor: it
 * is static, always rendered, and unique to Home.
 */
const pages = [
  { path: '/',         marker: 'is this another portfolio site?' },
  { path: '/projects', marker: 'Projects' },
  { path: '/writing',  marker: 'Writing' },
  { path: '/other',    marker: 'everything else' },
];

for (const p of pages) {
  test(`page ${p.path} renders, returns 200, no pageerror`, async ({ page }) => {
    const errors: Error[] = [];
    page.on('pageerror', (err) => errors.push(err));

    const response = await page.goto(p.path);
    expect(response, `no response for ${p.path}`).not.toBeNull();
    expect(response!.status(), `non-200 status for ${p.path}`).toBe(200);

    await expect(page.getByText(p.marker, { exact: false }).first()).toBeVisible();

    expect(errors, `pageerror events on ${p.path}: ${errors.map((e) => e.message).join(' | ')}`).toHaveLength(0);
  });
}
