import { test, expect } from '@playwright/test';

/**
 * T45.C e2e — embedded linked-post writeup on `/projects/[slug]`
 * (CONSTRAINT-05 Override 3).
 *
 * A project may attach a PUBLISHED writing post whose body renders below the
 * project card. These specs exercise the two render outcomes against a real
 * browser:
 *   - a project with a published linked post shows the post body;
 *   - a project with a null `post_id` shows no body and raises no error.
 *
 * The DRAFT-linked case (a draft `post_id` must render nothing — the security
 * boundary) is covered by the `getPublishedPostById` unit test in
 * `tests/db.test.ts`, because seeding a draft-linked project end-to-end is
 * impractical here (drafts are not reachable via the public surface).
 *
 * Slugs are env-driven and the tests skip — rather than hard-fail — when the
 * matching seed project is absent, so this spec is safe to land before seed
 * data does (mirrors `tests/e2e/public-carousel.spec.ts`).
 */

const LINKED_POST_SLUG = process.env.E2E_LINKED_POST_SLUG ?? 'project-with-writeup';
const NO_POST_SLUG = process.env.E2E_NO_POST_SLUG ?? 'project-without-writeup';

// A distinctive snippet of the linked post's rendered body. Seed-dependent, so
// it is env-overridable like the slugs above. The embedded body is rendered by
// `MarkdownContent`, which hydrates client-side (renderMarkdown in useEffect).
const LINKED_POST_BODY_TEXT = process.env.E2E_LINKED_POST_BODY_TEXT ?? 'writeup';

test.describe('/projects/[slug] — embedded linked-post writeup', () => {
  test('a project with a published linked post shows the post body', async ({ page }) => {
    const errors: Error[] = [];
    page.on('pageerror', (err) => errors.push(err));

    const response = await page.goto(`/projects/${LINKED_POST_SLUG}`);
    expect(response, 'no response for linked-post project').not.toBeNull();
    test.skip(response!.status() !== 200, 'no linked-post seed project in test DB');

    // The embedded body hydrates client-side, so wait for its text to appear.
    await expect(
      page.locator('main').getByText(LINKED_POST_BODY_TEXT, { exact: false }).first(),
    ).toBeVisible();

    expect(
      errors,
      `pageerror events: ${errors.map((e) => e.message).join(' | ')}`,
    ).toHaveLength(0);
  });

  test('a project with a null post_id shows no body and no error', async ({ page }) => {
    const errors: Error[] = [];
    page.on('pageerror', (err) => errors.push(err));

    const response = await page.goto(`/projects/${NO_POST_SLUG}`);
    expect(response, 'no response for no-post project').not.toBeNull();
    test.skip(response!.status() !== 200, 'no unlinked seed project in test DB');

    // The unlinked project must render no embedded body content and no error.
    // (The body snippet from the linked-post fixture must not appear here.)
    await expect(
      page.locator('main').getByText(LINKED_POST_BODY_TEXT, { exact: false }),
    ).toHaveCount(0);

    expect(
      errors,
      `pageerror events: ${errors.map((e) => e.message).join(' | ')}`,
    ).toHaveLength(0);
  });
});
