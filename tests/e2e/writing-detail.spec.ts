import { test, expect } from '@playwright/test';

test.describe('/writing/[slug]', () => {
  test('hello-world renders sanitized markdown body', async ({ page }) => {
    const response = await page.goto('/writing/hello-world');
    expect(response, 'no response for /writing/hello-world').not.toBeNull();
    expect(response!.status(), 'non-200 status for /writing/hello-world').toBe(200);

    // Wait for MarkdownContent to hydrate (renderMarkdown runs in useEffect)
    await expect(page.getByRole('heading', { level: 2, name: /Hello/i })).toBeVisible();

    // Sanitized DOM elements present
    await expect(page.locator('strong', { hasText: /^bold$/ })).toBeVisible();
    await expect(page.locator('em', { hasText: /^italic$/ })).toBeVisible();
    await expect(page.locator('a[href="https://example.com"]')).toBeVisible();
    await expect(page.locator('code').first()).toBeVisible();

    // Security: assert raw markdown markers do NOT appear in the body text
    const bodyText = await page.locator('main').innerText();
    expect(bodyText).not.toContain('**bold**');
    expect(bodyText).not.toContain('## Hello');
    expect(bodyText).not.toContain('[link]');

    // Security: no script tags, no inline event handlers in the rendered tree
    const bodyHtml = await page.locator('main').innerHTML();
    expect(bodyHtml).not.toMatch(/<script/i);
    expect(bodyHtml).not.toMatch(/onerror=/i);
    expect(bodyHtml).not.toMatch(/href="javascript:/i);
  });

  test('non-existent slug returns 404', async ({ page }) => {
    const response = await page.goto('/writing/this-slug-does-not-exist');
    expect(response, 'no response for missing slug').not.toBeNull();
    expect(response!.status(), 'expected 404 for missing slug').toBe(404);
    await expect(page.getByText(/this page could not be found/i)).toBeVisible();
  });
});
