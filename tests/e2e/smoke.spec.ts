import { test, expect } from '@playwright/test';

/**
 * Phase-1 liveness check: the app boots and Home renders real markup.
 *
 * The previous marker was the page-contextual footer line ("No cookies, no
 * analytics, pure vibes."). T46 removed every page footer site-wide — a
 * recorded CONSTRAINT-05 deviation — so the assertion could never pass again.
 * It survived because this spec was not in T46's rewrite list, and the suite
 * had never been run.
 *
 * The anchor below is the static chat question bubble, which is always
 * rendered and unique to Home. `pages.spec.ts` uses the same string for `/`
 * deliberately: if the marker ever moves again, both fail together instead of
 * drifting apart.
 *
 * NOTE: this file is now a strict subset of `pages.spec.ts`'s `/` case, which
 * additionally asserts a 200 status and an empty `pageerror` log. Kept rather
 * than deleted because removing coverage is the builder's call, not a
 * spec-fix's — flagged for a keep-or-drop decision.
 */
const HOME_MARKER = 'is this another portfolio site?';

test('home page renders a stable element', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(HOME_MARKER, { exact: false }).first()).toBeVisible();
});
