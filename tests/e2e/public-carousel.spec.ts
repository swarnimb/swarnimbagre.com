import { test, expect } from '@playwright/test';

/**
 * T43.G e2e — public `ProjectMediaCarousel` (CONSTRAINT-05 Override 2).
 *
 * These specs exercise the carousel against a real browser: swipe via
 * touch emulation, keyboard nav, the vertical-scroll-wins gesture rule,
 * and multi-instance independence on the `/projects` grid.
 *
 * The carousel only renders nav chrome for a project with 2+ media rows.
 * `MULTI_MEDIA_SLUG` must point at such a project in the test database;
 * if no multi-media project exists yet the affected tests skip rather
 * than hard-fail, so this spec is safe to land before seed data does.
 */

const MULTI_MEDIA_SLUG = process.env.E2E_MULTI_MEDIA_SLUG ?? 'tennis-elbow';

/** Find the first carousel region on the page, or null if none rendered. */
const CAROUSEL = '[role="group"][aria-roledescription="carousel"]';

test.describe('/projects/[slug] — media carousel', () => {
  test('keyboard ArrowRight / ArrowLeft advances slides', async ({ page }) => {
    const response = await page.goto(`/projects/${MULTI_MEDIA_SLUG}`);
    expect(response, 'no response for project detail').not.toBeNull();
    expect(response!.status()).toBe(200);

    const carousel = page.locator(CAROUSEL).first();
    test.skip((await carousel.count()) === 0, 'no multi-media project in test DB');

    const live = carousel.locator('[aria-live="polite"]');
    await expect(live).toContainText(/^Slide 1 of \d+/);

    await carousel.focus();
    await page.keyboard.press('ArrowRight');
    await expect(live).toContainText(/^Slide 2 of \d+/);

    await page.keyboard.press('ArrowLeft');
    await expect(live).toContainText(/^Slide 1 of \d+/);
  });

  test('horizontal swipe advances; vertical drag scrolls the page instead', async ({ page }) => {
    await page.goto(`/projects/${MULTI_MEDIA_SLUG}`);
    const carousel = page.locator(CAROUSEL).first();
    test.skip((await carousel.count()) === 0, 'no multi-media project in test DB');

    const live = carousel.locator('[aria-live="polite"]');
    const box = await carousel.boundingBox();
    expect(box, 'carousel has no layout box').not.toBeNull();
    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;

    // Horizontal-dominant drag — embla should advance.
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx - 200, cy + 8, { steps: 10 });
    await page.mouse.up();
    await expect(live).toContainText(/^Slide 2 of \d+/);

    // Vertical-dominant drag at a low horizontal angle — page scroll wins,
    // the carousel must NOT advance past the current slide. The
    // still-on-"Slide 2" assertion is the meaningful check here:
    // embla declined to capture the gesture as a horizontal swipe.
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 12, cy - 220, { steps: 10 });
    await page.mouse.up();
    await expect(live).toContainText(/^Slide 2 of \d+/);
  });
});

test.describe('/projects — independent carousels per card', () => {
  test('each project card has its own carousel with non-overlapping IDs', async ({ page }) => {
    const response = await page.goto('/projects');
    expect(response!.status()).toBe(200);

    const carousels = page.locator(CAROUSEL);
    const count = await carousels.count();
    test.skip(count < 2, 'fewer than two multi-media projects in test DB');

    // Collect every dot button id across all carousels — they must be unique.
    const ids = await page.locator(`${CAROUSEL} button[aria-label^="Slide "]`).evaluateAll(
      (nodes) => nodes.map((n) => n.id),
    );
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);

    // Advancing the first carousel must not move the second.
    const first = carousels.nth(0);
    const second = carousels.nth(1);
    await first.focus();
    await page.keyboard.press('ArrowRight');
    await expect(first.locator('[aria-live="polite"]')).toContainText(/^Slide 2 of \d+/);
    await expect(second.locator('[aria-live="polite"]')).toContainText(/^Slide 1 of \d+/);
  });
});
