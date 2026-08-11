import { test, expect } from '@playwright/test';

/**
 * `/writing/[slug]` — renders a real published post through the sanitizing
 * Markdown path (CONSTRAINT-06: marked → DOMPurify → DOM).
 *
 * This spec used to hard-code the slug `hello-world` and assert that fixture's
 * exact body (`**bold**`, `*italic*`, a link to example.com, a code span).
 * That post was removed by the S42 production-fixture purge, so the route
 * 404'd. It also read the body out of `page.locator('main')`, and this route
 * renders no `<main>` element at all — the body container is `.post-body` —
 * so the assertion could not have passed even with a live fixture.
 *
 * Rather than reintroduce a fixture row into production (CONSTRAINT-02: there
 * is no staging project, so every test row is a live row), the slug is derived
 * from the `/writing` list at run time. The trade-off is deliberate and worth
 * knowing: because real post bodies are arbitrary prose, this can no longer
 * assert that a specific Markdown construct rendered. It asserts the invariants
 * that hold for any body — it rendered as HTML rather than raw text, and the
 * sanitizer stripped every script vector.
 */

/** Block-level tags `marked` emits; at least one must be present in a body. */
const RENDERED_BLOCK_SELECTOR = 'p, h2, h3, h4, ul, ol, blockquote, pre';

test.describe('/writing/[slug]', () => {
  test('a published post renders sanitized markdown', async ({ page }) => {
    await page.goto('/writing');

    const firstRow = page.locator('a.lrow').first();
    await expect(firstRow, 'no published posts on /writing to exercise').toBeVisible();

    const href = await firstRow.getAttribute('href');
    expect(href, 'post row is missing an href').toBeTruthy();

    // The list heading carries a decorative `<span class="larrow">→</span>`.
    // It is `aria-hidden`, but `innerText()` still returns it, which would
    // append a stray arrow to the title and break the match against the
    // detail page's `<h1>`. Strip aria-hidden nodes before reading the text.
    const title = await firstRow.locator('h2.ltitle').evaluate((el) => {
      const clone = el.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('[aria-hidden="true"]').forEach((node) => node.remove());
      return (clone.textContent ?? '').trim();
    });

    const response = await page.goto(href!);
    expect(response, `no response for ${href}`).not.toBeNull();
    expect(response!.status(), `non-200 status for ${href}`).toBe(200);

    // The same title heads the detail page.
    await expect(page.locator('h1.page-title')).toContainText(title);

    // MarkdownContent renders in a useEffect — wait for real HTML, not raw text.
    const body = page.locator('.post-body');
    await expect(body).toBeVisible();
    await expect(
      body.locator(RENDERED_BLOCK_SELECTOR).first(),
      'post body produced no block-level HTML — markdown did not render',
    ).toBeVisible();

    // SEC: sanitizer stripped every script vector (CONSTRAINT-06 whitelist).
    const bodyHtml = await body.innerHTML();
    expect(bodyHtml).not.toMatch(/<script/i);
    expect(bodyHtml).not.toMatch(/\son\w+=/i);
    expect(bodyHtml).not.toMatch(/href="javascript:/i);
    expect(bodyHtml).not.toMatch(/<iframe/i);
  });

  test('non-existent slug returns 404', async ({ page }) => {
    const response = await page.goto('/writing/this-slug-does-not-exist');
    expect(response, 'no response for missing slug').not.toBeNull();
    expect(response!.status(), 'expected 404 for missing slug').toBe(404);
    // Assert OUR 404, not Next's default. This line asserted the framework
    // fallback ("This page could not be found") until T41 shipped
    // `app/not-found.tsx`; the swap went unnoticed because that session never
    // ran Playwright. A 404 status with the stock page would be a real defect.
    await expect(page.getByRole('heading', { name: 'Nothing here.' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to the start' })).toBeVisible();
  });
});
