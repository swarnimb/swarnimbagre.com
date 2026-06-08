import { test, expect } from '@playwright/test';

const pages = [
  { path: '/',         marker: "No cookies, no analytics, pure vibes." },
  { path: '/projects', marker: 'projects' },
  { path: '/writing',  marker: 'writing' },
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
