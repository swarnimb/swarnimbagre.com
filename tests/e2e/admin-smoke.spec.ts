/**
 * T28 — Admin smoke test (end-to-end).
 *
 * Single-test, serial-mode Playwright spec that exercises every Phase 2
 * admin surface in one signed-in session: auth gate, projects CRUD (with
 * publish + slug-lock), posts CRUD (with raw Markdown round-trip via the
 * public renderer), stats insert + delete, images upload + replace, the
 * /admin/images orphan listing, logout (+ back-button non-restoration), and
 * the CONSTRAINT-03 public-style isolation check.
 *
 * Architecture:
 *   - One `test()` block per Playwright run because the fixture user is
 *     shared with `admin-logout.spec.ts` and concurrent
 *     `auth.admin.generateLink` calls invalidate each other's tokens
 *     (see auth-flow doc 4.8). One test = one sign-in = no token race.
 *   - The flow is partitioned into named `runStep(label, fn)` invocations
 *     that catch their own throws into a `failures[]` array. The test
 *     continues to the next step even if one step throws — every QA-able
 *     section gets a chance to run, and the final assertion lists every
 *     failure in one shot. This is the right shape for `@qa` orchestration:
 *     a single broken admin surface should not blind us to whether the
 *     other surfaces work.
 *
 * Negative coverage:
 *   - SEC-02: `<script>` and `<img onerror>` payloads in title + alt fields
 *     must round-trip as literal text; no execution.
 *   - CONSTRAINT-13: visible body text on every admin page is scanned
 *     against a SaaS deny-list + emoji codepoint set.
 *   - CONSTRAINT-03: the public `/projects` body computed style baseline
 *     captured pre-flow must equal the post-flow capture.
 *   - CQ-05: a console-error + pageerror listener captures all events for
 *     the duration of the test; asserted empty at the end.
 */

import { test, expect, type BrowserContext, type ConsoleMessage, type Page } from '@playwright/test';
import { loginAsAdmin } from './fixtures/auth';

// --- Constants (CQ-04) -----------------------------------------------------

const ADMIN_URL = '/admin';
const LOGIN_URL_RE = /\/admin\/login(\?|$)/;
const PUBLIC_PROJECTS_URL = '/projects';

const RUN_ID = `t28-${Date.now()}`;
const PROJECT_TITLE = `T28 project ${RUN_ID}`;
const PROJECT_TITLE_EDITED = `T28 project edited ${RUN_ID}`;
const PROJECT_DESCRIPTION = `Smoke test project description ${RUN_ID}.`;
const IMAGE_PROJECT_TITLE = `T28 image project ${RUN_ID}`;
const POST_TITLE = `T28 post ${RUN_ID}`;
const POST_MARKDOWN_BODY = `## T28 heading\n\nA list item exercises the renderer.\n\n- one\n- two with **bold**\n- three with [a link](https://example.com)`;
const STAT_CATEGORY = `t28-${RUN_ID}`;
const STAT_LABEL = `T28 stat ${RUN_ID}`;
const STAT_VALUE = '42';

// --- T42 end-to-end path constants (CQ-04) --------------------------------

/** T42 test project title — distinct prefix so it can't collide with T28 rows. */
const T42_PROJECT_TITLE = `T42 e2e project ${RUN_ID}`;
/** T42 description — surfaces in the public card blurb. */
const T42_PROJECT_DESCRIPTION = `T42 end-to-end project description ${RUN_ID}.`;
/** T42 github URL — https, max-length safe, non-collision. */
const T42_GITHUB_URL = 'https://github.com/test/t42-smoke';
/** T42 live URL — https, non-collision. */
const T42_LIVE_URL = 'https://example.com/t42-smoke';
/** T42 post URL — relative form is permitted by `postUrlSchema`. */
const T42_POST_URL = '/writing/t42-smoke-post';
/** T42 progress — 100 triggers the `ProgressRing` done-glow render path. */
const T42_PROGRESS_PERCENT = '100';
/** T42 thumb_kind — first entry of `THUMB_KIND_OPTIONS` (`disc`). */
const T42_THUMB_KIND_LABEL = 'Disc';

/** T43.F media-flow project title — distinct prefix so cleanup can scope by it. */
const T43F_MEDIA_TITLE = `T43F media project ${RUN_ID}`;
/** T43.F captions used as stable identifiers for post-reload row assertions. */
const T43F_CAPTION_SINGLE = `T43F single caption ${RUN_ID}`;
const T43F_CAPTION_PAIR = `T43F pair caption ${RUN_ID}`;

/** TypoIcon visible-text labels. Unicode characters preserved verbatim per
 * CONSTRAINT-13 — `↗` and `¶` must not be transliterated to `->` or `section`. */
const TYPO_ICON_GITHUB_TEXT = '{ } code';
const TYPO_ICON_LIVE_TEXT = '↗ site';
const TYPO_ICON_POST_TEXT = '¶ notes';

/**
 * Mobile UA token matched by `MOBILE_UA_TOKENS` in `middleware.ts`. Selecting
 * the iPhone string keeps parity with `tests/e2e/ua-mobile.spec.ts`; both
 * specs exercise the same middleware classification path.
 */
const T42_MOBILE_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) ' +
  'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

/** SEC-02 payloads. Both must round-trip as literal text — no execution. */
const XSS_SCRIPT_PAYLOAD = `<script>window.__t28_xss=1;</script>`;
const XSS_IMG_PAYLOAD = `<img src=x onerror="window.__t28_xss=1;">`;

/** SaaS deny-list (CONSTRAINT-13). Substring + case-insensitive. */
const SAAS_DENY_LIST: readonly string[] = [
  'ai-powered',
  'ai powered',
  'next-gen',
  'next gen',
  'seamless',
  'powerful',
  'amazing',
  'leverage',
  'synergy',
  'cutting-edge',
];

/** Emoji deny-list (CONSTRAINT-13) — pictographs + dingbats; not symbols. */
const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

/** 1×1 transparent PNG, base64. Inlined so no fixture file is needed. */
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=';

const PUBLIC_STYLE_PROPERTIES = ['backgroundColor', 'color', 'fontFamily'] as const;

/** Per-step timeout. Default 30s; image-upload server action runs to the
 * SEC-09 750ms floor + Storage I/O so a few tests need ≤ 15s for stability. */
const STEP_TIMEOUT_MS = 20_000;

/** Step-level wait used inside helpers for individual UI transitions. */
const SHORT_WAIT_MS = 10_000;

// --- Helpers ---------------------------------------------------------------

interface ConsoleWatch {
  assertNoErrors: () => void;
}

function watchConsole(page: Page): ConsoleWatch {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (msg: ConsoleMessage) => {
    const type = msg.type();
    if (type === 'error' || type === 'warning') {
      consoleErrors.push(`[${type}] ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => {
    pageErrors.push(err.message);
  });
  return {
    assertNoErrors(): void {
      expect(
        consoleErrors,
        `console errors/warnings: ${consoleErrors.join(' | ')}`,
      ).toHaveLength(0);
      expect(
        pageErrors,
        `pageerror events: ${pageErrors.join(' | ')}`,
      ).toHaveLength(0);
    },
  };
}

async function capturePublicStyleBaseline(
  page: Page,
): Promise<Record<string, string>> {
  await page.goto(PUBLIC_PROJECTS_URL);
  await page.waitForLoadState('domcontentloaded');
  return page.evaluate((properties) => {
    const computed = getComputedStyle(document.body);
    const out: Record<string, string> = {};
    for (const prop of properties) {
      out[prop] = computed[prop as keyof CSSStyleDeclaration] as string;
    }
    return out;
  }, PUBLIC_STYLE_PROPERTIES as readonly string[]);
}

async function assertPublicStyleUnchanged(
  page: Page,
  baseline: Record<string, string>,
): Promise<void> {
  const after = await capturePublicStyleBaseline(page);
  expect(
    after,
    `public /projects computed style drifted — admin Tailwind/shadcn leaked past .admin-root`,
  ).toEqual(baseline);
}

async function assertVoiceClean(page: Page, where: string): Promise<void> {
  const text = (await page.locator('body').innerText()).toLowerCase();
  const offences: string[] = [];
  for (const phrase of SAAS_DENY_LIST) {
    if (text.includes(phrase)) offences.push(`saas:"${phrase}"`);
  }
  if (EMOJI_RE.test(text)) {
    const match = text.match(EMOJI_RE);
    offences.push(`emoji:${match?.[0] ?? '?'}`);
  }
  expect(
    offences,
    `voice deny-list hits on ${where}: ${offences.join(', ')}`,
  ).toHaveLength(0);
}

async function confirmDeleteInDialog(page: Page): Promise<void> {
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: /^delete$/i }).click();
}

/**
 * Open the form's Status combobox and pick `optionName` from the listbox.
 * Match by accessible-name "Status" — the Radix trigger inherits it via
 * `<Label htmlFor="…-status">`. That name does not collide with the list
 * page's `Filter by status` combobox or the sibling hidden native select
 * Radix renders for form participation. Force-click the option to bypass
 * the stability wait (Radix's exit animation re-mounts the option mid-
 * action); wait for listbox-hidden so the next click lands on the real
 * target instead of the dim overlay.
 */
async function selectFormStatus(
  page: Page,
  optionName: string,
): Promise<void> {
  await page.getByRole('combobox', { name: 'Status' }).click();
  const listbox = page.getByRole('listbox');
  await expect(listbox).toBeVisible();
  await page.getByRole('option', { name: optionName }).click({ force: true });
  await expect(listbox).toBeHidden();
}

async function deleteRowsMatching(
  page: Page,
  nameRe: RegExp,
): Promise<void> {
  for (let safety = 0; safety < 20; safety += 1) {
    const rows = page.getByRole('row', { name: nameRe });
    const count = await rows.count();
    if (count === 0) return;
    await rows
      .first()
      .getByRole('button', { name: /^delete$/i })
      .click();
    await confirmDeleteInDialog(page);
    await expect(rows).toHaveCount(count - 1);
  }
}

/**
 * Run a named sub-flow under a bounded wall-clock timeout. Failures are
 * captured into `failures[]` and the test continues. Lets the QA report
 * surface every broken surface in one run rather than masking later
 * surfaces behind the first failure.
 */
async function runStep(
  failures: string[],
  label: string,
  fn: () => Promise<void>,
): Promise<void> {
  const start = Date.now();
  try {
    await Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`step "${label}" exceeded ${STEP_TIMEOUT_MS}ms`)),
          STEP_TIMEOUT_MS,
        ),
      ),
    ]);
    // Step succeeded — no entry in failures.
  } catch (err) {
    const elapsed = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    failures.push(`STEP "${label}" failed after ${elapsed}ms: ${message}`);
    // Best-effort: log to test runner so the live output lists which step
    // tripped before the final assertion.
    console.error(`[T28] step "${label}" failed: ${message}`);
  }
}

/**
 * Pick a value from a shadcn Select by its accessible label. Mirrors
 * `selectFormStatus` but parameterised on the trigger's accessible name so
 * it works for both the `Status` and `Thumbnail` selects on `ProjectForm`.
 *
 * The trigger's accessible name comes from `<Label htmlFor="…">`; the
 * project-thumb-kind select label is "Thumbnail" (see ProjectFormDisplay.tsx).
 */
async function selectFormOption(
  page: Page,
  triggerName: string,
  optionName: string,
): Promise<void> {
  await page.getByRole('combobox', { name: triggerName }).click();
  const listbox = page.getByRole('listbox');
  await expect(listbox).toBeVisible();
  await page.getByRole('option', { name: optionName }).click({ force: true });
  await expect(listbox).toBeHidden();
}

/**
 * Assert that the three T42 TypoIcon link buttons render with their exact
 * bundle-preserved Unicode labels and carry the URLs we submitted on the
 * admin form. The TypoIcon component renders each as an `<a>`; the visible
 * text is glyph + space + label (e.g. `{ } code`). We scope the assertion
 * to the project card region by passing the article `Locator` in.
 *
 * Each link's `onClick` only calls `preventDefault` when `href === "#"`
 * (decorative bundle default). Production consumers pass a real URL, so
 * primary clicks navigate normally; the `href` attribute carries the URL
 * directly.
 */
async function assertT42LinkRow(
  scope: Page | import('@playwright/test').Locator,
  expectedUrls: {
    githubUrl: string;
    liveUrl: string;
    postUrl: string;
  },
): Promise<void> {
  const githubLink = scope.getByRole('link', { name: TYPO_ICON_GITHUB_TEXT });
  const liveLink = scope.getByRole('link', { name: TYPO_ICON_LIVE_TEXT });
  const postLink = scope.getByRole('link', { name: TYPO_ICON_POST_TEXT });
  await expect(githubLink.first()).toBeVisible();
  await expect(liveLink.first()).toBeVisible();
  await expect(postLink.first()).toBeVisible();
  await expect(githubLink.first()).toHaveAttribute('href', expectedUrls.githubUrl);
  await expect(liveLink.first()).toHaveAttribute('href', expectedUrls.liveUrl);
  await expect(postLink.first()).toHaveAttribute('href', expectedUrls.postUrl);
}

/**
 * Assert the `ProgressRing` is present and in done-state (percent === 100).
 *
 * `ProgressRing` returns `null` when `percent` is null/undefined, so the
 * presence of the `[role="img"]` span with `aria-label="progress 100%"` is
 * a load-bearing signal that:
 *   1. The DB value round-tripped to the public render (component received `100`).
 *   2. The done-state branch fired (the aria-label is computed AFTER the
 *      `Math.min(100, percent)` clamp; only `percent === 100` produces this
 *      exact string).
 */
async function assertProgressRingDone(
  scope: Page | import('@playwright/test').Locator,
): Promise<void> {
  const ring = scope.getByRole('img', { name: 'progress 100%' });
  await expect(ring.first()).toBeVisible();
}

// --- The flow --------------------------------------------------------------

test.describe('T28 — admin smoke (end-to-end)', () => {
  // Single-test design: the fixture user is shared with admin-logout.spec.ts;
  // concurrent generateLink calls invalidate each other's tokens (auth-flow
  // doc 4.8). Splitting into multiple tests would re-call generateLink per
  // test and race itself.

  test('full admin CRUD flow: every Phase 2 surface in one signed-in session', async ({
    page,
    context,
  }) => {
    test.setTimeout(STEP_TIMEOUT_MS * 12); // generous global cap.

    const errorWatch = watchConsole(page);
    const failures: string[] = [];

    // Pre-flow: capture the public style baseline BEFORE the admin flow.
    const publicBaseline = await capturePublicStyleBaseline(page);

    // Auth gate.
    await runStep(failures, 'auth gate: signed-out /admin → /admin/login', async () => {
      await page.goto(ADMIN_URL);
      await expect(page).toHaveURL(LOGIN_URL_RE);
      await expect(
        page.getByRole('heading', { level: 1, name: /sign in/i }),
      ).toBeVisible();
      await assertVoiceClean(page, '/admin/login');
    });

    // Sign in once for the rest of the flow.
    // /admin redirects to /admin/projects (server-side redirect — there is no
    // standalone admin landing surface). The landing assertion targets the
    // Projects list heading rendered by ResourceList.tsx.
    await runStep(failures, 'pre-seeded session lands on /admin/projects', async () => {
      await loginAsAdmin(page, context);
      await expect(page).toHaveURL(/\/admin\/projects$/);
      await expect(
        page.getByRole('heading', { level: 1, name: 'Projects' }),
      ).toBeVisible();
      await assertVoiceClean(page, '/admin/projects');
    });

    // Projects CRUD.
    await runStep(failures, 'projects: create (+XSS title)', async () => {
      await page.goto('/admin/projects/new');
      const xssTitle = `${PROJECT_TITLE} ${XSS_SCRIPT_PAYLOAD}`;
      await page.getByLabel('Title').fill(xssTitle);
      await page.getByLabel('Description').fill(PROJECT_DESCRIPTION);
      await page.getByRole('button', { name: /^save$/i }).click();
      await page.waitForURL(/\/admin\/projects(\?[^/]*)?$/);
      await expect(
        page.getByRole('cell', { name: new RegExp(PROJECT_TITLE) }).first(),
      ).toBeVisible();
      const xssMarker = await page.evaluate(
        () => (window as unknown as { __t28_xss?: number }).__t28_xss ?? null,
      );
      expect(xssMarker, 'XSS title payload should NOT execute').toBeNull();
    });

    await runStep(failures, 'projects: edit title saves', async () => {
      await page
        .getByRole('row', { name: new RegExp(PROJECT_TITLE) })
        .getByRole('link', { name: /^edit$/i })
        .click();
      await page.waitForURL(/\/admin\/projects\/[0-9a-f-]+$/);
      await page.getByLabel('Title').fill(PROJECT_TITLE_EDITED);
      await page.getByRole('button', { name: /^save$/i }).click();
      await page.waitForURL(/\/admin\/projects(\?[^/]*)?$/);
      await expect(
        page.getByRole('cell', { name: PROJECT_TITLE_EDITED }).first(),
      ).toBeVisible();
    });

    await runStep(failures, 'projects: publish → slug locks read-only', async () => {
      await page
        .getByRole('row', { name: new RegExp(PROJECT_TITLE_EDITED) })
        .getByRole('link', { name: /^edit$/i })
        .click();
      await page.waitForURL(/\/admin\/projects\/[0-9a-f-]+$/);
      await selectFormStatus(page, 'Published');
      await page.getByRole('button', { name: /^save$/i }).click();
      await page.waitForURL(/\/admin\/projects(\?[^/]*)?$/, { timeout: SHORT_WAIT_MS });
      // Re-open the freshly-published row.
      await page
        .getByRole('row', { name: new RegExp(PROJECT_TITLE_EDITED) })
        .getByRole('link', { name: /^edit$/i })
        .click();
      await page.waitForURL(/\/admin\/projects\/[0-9a-f-]+$/);
      const slugInput = page.getByLabel(/^slug$/i);
      await expect(slugInput).toBeVisible();
      await expect(slugInput).toHaveAttribute('readonly', '');
    });

    // Image upload + replace (T26 surface, rewired for T43.F).
    //
    // T43.F removed `ProjectImageField` and replaced it with the row-based
    // `ProjectMediaField`. The upload widget (`ImageUpload`) is unchanged —
    // it still derives per-instance ids via `useId()` and prefixes visible
    // labels with `instanceLabel`. A single row added via "+ image" mounts
    // `ImageUpload` with `instanceLabel="Image"`, so the legacy locators
    // `Image choose image` / `Image alt text` still resolve verbatim. The
    // only behavioral delta is that the operator must click "+ image" first
    // to add a row; nothing mounts the upload widget on a fresh edit page.
    await runStep(failures, 'images: upload via project edit form (T43.F rewired)', async () => {
      await page.goto('/admin/projects/new');
      await page.getByLabel('Title').fill(IMAGE_PROJECT_TITLE);
      await page.getByLabel('Description').fill(`Image upload smoke ${RUN_ID}`);
      await page.getByRole('button', { name: /^save$/i }).click();
      await page.waitForURL(/\/admin\/projects(\?[^/]*)?$/);
      await page
        .getByRole('row', { name: new RegExp(IMAGE_PROJECT_TITLE) })
        .getByRole('link', { name: /^edit$/i })
        .click();
      await page.waitForURL(/\/admin\/projects\/[0-9a-f-]+$/);

      // T43.F: ProjectMediaField mounts in edit mode but is empty by
      // default — adding a single row reveals the (unchanged) ImageUpload
      // labels the rest of this step asserts against.
      await page.getByRole('button', { name: '+ image' }).click();

      // Diagnostic: count nested forms — the bug detector. If this is > 0
      // and the upload then fails, the failure root cause is the nested
      // form, not a test-rig issue.
      const nestedForms = await page.evaluate(
        () => document.querySelectorAll('form form').length,
      );
      expect(
        nestedForms,
        `nested <form> elements detected on edit page = ${nestedForms} ` +
          `(invalid HTML; ImageUpload's <form> is rendered inside ` +
          `ProjectForm's <form> — see T26 wiring)`,
      ).toBe(0);

      // T42 regression pin: no duplicate ids in the rendered DOM. Catches
      // the original bug shape (two ImageUpload instances both hardcoded
      // `id="image-file"`).
      const duplicateIds = await page.evaluate(() => {
        const ids = Array.from(document.querySelectorAll('[id]')).map(
          (el) => el.id,
        );
        const seen = new Set<string>();
        const dupes = new Set<string>();
        for (const id of ids) {
          if (seen.has(id)) dupes.add(id);
          else seen.add(id);
        }
        return Array.from(dupes);
      });
      expect(
        duplicateIds,
        `duplicate DOM ids detected on edit page: ${duplicateIds.join(', ')}`,
      ).toEqual([]);

      const pngBuffer = Buffer.from(TINY_PNG_BASE64, 'base64');
      // Scope to the primary `Image` ProjectImageField so the locator does
      // not strict-mode-fail on the sibling `After image` instance.
      await page.getByLabel('Image choose image').setInputFiles({
        name: 't28-first.png',
        mimeType: 'image/png',
        buffer: pngBuffer,
      });
      const altWithPayload = `T28 alt ${XSS_IMG_PAYLOAD}`;
      await page.getByLabel('Image alt text').fill(altWithPayload);
      // Two Upload buttons exist (one per instance) — pick the first, which
      // is the primary `Image` instance (rendered before the after image in
      // ProjectForm). `.first()` keeps the click unambiguous.
      const uploadBtn = page.getByRole('button', { name: /^upload$/i }).first();
      await expect(uploadBtn).toBeEnabled();
      await uploadBtn.click();
      await expect(
        page.getByText(/new image saved\. preview refreshes after save\./i),
      ).toBeVisible({ timeout: SHORT_WAIT_MS });
      const xssMarker = await page.evaluate(
        () => (window as unknown as { __t28_xss?: number }).__t28_xss ?? null,
      );
      expect(xssMarker, 'alt-text XSS payload should NOT execute').toBeNull();
    });

    await runStep(failures, '/admin/images orphan listing renders', async () => {
      await page.goto('/admin/images');
      await expect(
        page.getByRole('heading', { name: /orphaned images/i }),
      ).toBeVisible();
      await assertVoiceClean(page, '/admin/images');
      const empty = page.getByText(/no orphaned images\./i);
      const anyRow = page.locator('td.font-mono');
      const eitherVisible =
        (await empty.isVisible().catch(() => false)) ||
        (await anyRow.first().isVisible().catch(() => false));
      expect(
        eitherVisible,
        '/admin/images rendered neither empty-state nor any orphan row',
      ).toBe(true);
    });

    // Posts CRUD with Markdown round-trip via public renderer.
    let postSlug = '';
    await runStep(failures, 'posts: create published', async () => {
      await page.goto('/admin/posts/new');
      await page.getByLabel('Title').fill(POST_TITLE);
      await page.getByLabel('Content').fill(POST_MARKDOWN_BODY);
      await selectFormStatus(page, 'Published');
      await page.getByRole('button', { name: /^save$/i }).click();
      await page.waitForURL(/\/admin\/posts(\?[^/]*)?$/, { timeout: SHORT_WAIT_MS });
      const postRow = page.getByRole('row', { name: new RegExp(POST_TITLE) });
      await expect(postRow).toBeVisible();
      postSlug = ((await postRow.locator('td').nth(1).textContent()) ?? '').trim();
      expect(postSlug, 'post slug must be derived').not.toBe('');
    });

    await runStep(failures, 'public /writing/[slug] renders Markdown', async () => {
      // Acceptance criteria mention a "preview pane" — implementation has
      // none (PostForm is a plain Textarea); the round-trip is through the
      // visitor-facing renderer at /writing/[slug].
      if (postSlug === '') throw new Error('postSlug not captured');
      await page.goto(`/writing/${postSlug}`);
      await expect(
        page.getByRole('heading', { level: 2, name: /t28 heading/i }),
      ).toBeVisible();
      await expect(page.getByText(/two with/i)).toBeVisible();
      await expect(page.getByRole('link', { name: /a link/i })).toBeVisible();
    });

    // Stats CRUD.
    await runStep(failures, 'stats: insert + delete with confirm modal', async () => {
      await page.goto('/admin/stats');
      await assertVoiceClean(page, '/admin/stats');
      await page.getByLabel('Category').fill(STAT_CATEGORY);
      await page.getByLabel('Label').fill(STAT_LABEL);
      await page.getByLabel('Value').fill(STAT_VALUE);
      await page.getByRole('button', { name: /^save$/i }).click();
      await expect(
        page.getByRole('cell', { name: STAT_LABEL }).first(),
      ).toBeVisible();
      await page
        .getByRole('row', { name: new RegExp(STAT_LABEL) })
        .getByRole('button', { name: /^delete$/i })
        .click();
      await confirmDeleteInDialog(page);
      await expect(
        page.getByRole('cell', { name: STAT_LABEL }),
      ).toHaveCount(0);
    });

    // -------------------------------------------------------------------
    // T42 end-to-end path — admin create with the 6 new content-model
    // fields → publish → assert public render on desktop AND mobile.
    //
    // Image attachment to the deprecated `image_id` / `image_after_id`
    // columns is SKIPPED — T43.F removed `ProjectImageField`, so those
    // columns have no admin write surface at all. Project images now live
    // in `project_media`, exercised by the dedicated T43.F step further
    // below. This T42 path therefore exercises the still-no-image public
    // render branch; the image-bound branches (`ProjectMedia` `<img>` and
    // `BeforeAfterMedia`) stay covered by their unit tests.
    //
    // Mobile assertions use a separate BrowserContext with the iPhone UA
    // matched by `MOBILE_UA_TOKENS` in middleware.ts. Viewport size alone
    // would NOT switch the variant — detection is UA-based.
    // -------------------------------------------------------------------

    await runStep(failures, 'T42: create project with all 6 new fields filled', async () => {
      await page.goto('/admin/projects/new');
      await page.getByLabel('Title').fill(T42_PROJECT_TITLE);
      await page.getByLabel('Description').fill(T42_PROJECT_DESCRIPTION);
      await page.getByLabel('GitHub URL').fill(T42_GITHUB_URL);
      await page.getByLabel('Live URL').fill(T42_LIVE_URL);
      await page.getByLabel('Post URL').fill(T42_POST_URL);
      await page.getByLabel('Progress').fill(T42_PROGRESS_PERCENT);
      await selectFormOption(page, 'Thumbnail', T42_THUMB_KIND_LABEL);
      // T45.D Override 3: attach the published post created earlier so this
      // project's detail page has a body the list card does not — which makes
      // the `/projects` list title an active link (the "enriched" state).
      await selectFormOption(page, 'Linked writeup', POST_TITLE);
      await selectFormStatus(page, 'Published');
      await page.getByRole('button', { name: /^save$/i }).click();
      await page.waitForURL(/\/admin\/projects(\?[^/]*)?$/, { timeout: SHORT_WAIT_MS });
      await expect(
        page.getByRole('cell', { name: T42_PROJECT_TITLE }).first(),
      ).toBeVisible();
    });

    const t42PublicAssertions = {
      githubUrl: T42_GITHUB_URL,
      liveUrl: T42_LIVE_URL,
      postUrl: T42_POST_URL,
    };
    const t42TitleRe = new RegExp(T42_PROJECT_TITLE);

    await runStep(failures, 'T42 desktop: home renders project row with ring + 3 links', async () => {
      await page.goto('/');
      const heading = page.getByRole('heading', { level: 3, name: t42TitleRe });
      await expect(heading.first()).toBeVisible();
      const article = page.locator('article', { has: heading });
      await assertProgressRingDone(article.first());
      await assertT42LinkRow(article.first(), t42PublicAssertions);

      // Regression guard: TypoIcon previously called `preventDefault`
      // unconditionally, making every link visibly clickable but inert.
      // Synthesise a primary click on the `{ } code` link and assert the
      // event was NOT default-prevented. Use `evaluate` so we don't trigger
      // a real cross-origin navigation in the test runner.
      const githubLink = article
        .first()
        .getByRole('link', { name: TYPO_ICON_GITHUB_TEXT })
        .first();
      const wasDefaultPrevented = await githubLink.evaluate((el) => {
        const evt = new MouseEvent('click', { bubbles: true, cancelable: true });
        el.dispatchEvent(evt);
        return evt.defaultPrevented;
      });
      expect(
        wasDefaultPrevented,
        'TypoIcon primary click must NOT preventDefault for real URLs',
      ).toBe(false);
    });

    await runStep(failures, 'T42 desktop: /projects renders card with ring + 3 links', async () => {
      await page.goto('/projects');
      const heading = page.getByRole('heading', { level: 3, name: t42TitleRe });
      await expect(heading.first()).toBeVisible();
      const article = page.locator('article', { has: heading });
      await assertProgressRingDone(article.first());
      await assertT42LinkRow(article.first(), t42PublicAssertions);
    });

    // T45.D Override 3 — title-link gating on the public /projects list.
    //   - Enriched card (T42 project: has an attached post)  → title IS a link.
    //   - Bare card (PROJECT_TITLE_EDITED: published, no post, no media) →
    //     title is an inert label (no anchor).
    // The bare card never carries TypoIcon links either, so scoping the
    // title-link assertion to the article's <h3> keeps it unambiguous.
    await runStep(failures, 'T45.D desktop: /projects title-link gating (enriched vs bare)', async () => {
      await page.goto('/projects');

      // Enriched: T42 card title resolves as a link with the project title.
      const enrichedHeading = page.getByRole('heading', { level: 3, name: t42TitleRe });
      await expect(enrichedHeading.first()).toBeVisible();
      const enrichedArticle = page.locator('article', { has: enrichedHeading }).first();
      await expect(
        enrichedArticle.getByRole('link', { name: T42_PROJECT_TITLE }),
      ).toBeVisible();

      // Bare: PROJECT_TITLE_EDITED card title is present as a heading but is
      // NOT a link (no anchor inside the <h3>).
      const bareRe = new RegExp(PROJECT_TITLE_EDITED);
      const bareHeading = page.getByRole('heading', { level: 3, name: bareRe });
      await expect(bareHeading.first()).toBeVisible();
      const bareArticle = page.locator('article', { has: bareHeading }).first();
      await expect(
        bareArticle.getByRole('link', { name: bareRe }),
      ).toHaveCount(0);
    });

    await runStep(failures, 'T42 desktop: /projects/[slug] renders detail with ring + 3 links', async () => {
      // Slug derives from the title via the create flow; titles round-trip
      // to slugs via lib/slug.ts (lowercased, spaced→`-`, special-stripped).
      await page.goto('/admin/projects');
      const slugCell = page
        .getByRole('row', { name: t42TitleRe })
        .locator('td')
        .nth(1);
      const t42Slug = ((await slugCell.textContent()) ?? '').trim();
      expect(t42Slug, 'T42 project slug must be derivable').not.toBe('');
      await page.goto(`/projects/${t42Slug}`);
      const heading = page.getByRole('heading', { level: 3, name: t42TitleRe });
      await expect(heading.first()).toBeVisible();
      const article = page.locator('article', { has: heading });
      await assertProgressRingDone(article.first());
      await assertT42LinkRow(article.first(), t42PublicAssertions);
    });

    await runStep(failures, 'T42 mobile: /projects + /projects/[slug] via iPhone UA context', async () => {
      const browser = context.browser();
      if (!browser) {
        throw new Error('T42 mobile: BrowserContext has no browser reference');
      }
      // Look up the slug from the admin list before swapping contexts —
      // the mobile context is unauthenticated by design.
      await page.goto('/admin/projects');
      const slugCell = page
        .getByRole('row', { name: t42TitleRe })
        .locator('td')
        .nth(1);
      const t42Slug = ((await slugCell.textContent()) ?? '').trim();
      expect(t42Slug, 'T42 project slug must be derivable for mobile').not.toBe('');

      const mobileContext: BrowserContext = await browser.newContext({
        userAgent: T42_MOBILE_USER_AGENT,
      });
      try {
        const mobilePage = await mobileContext.newPage();
        // Mobile /projects — MobileProjectCard surface.
        await mobilePage.goto('/projects');
        const mobileHeading = mobilePage.getByRole('heading', {
          level: 3,
          name: t42TitleRe,
        });
        await expect(mobileHeading.first()).toBeVisible();
        const mobileArticle = mobilePage.locator('article', { has: mobileHeading });
        await assertProgressRingDone(mobileArticle.first());
        await assertT42LinkRow(mobileArticle.first(), t42PublicAssertions);

        // Mobile /projects/[slug] — MobileProjectCard rendered by the
        // detail page's MobileDetail branch.
        await mobilePage.goto(`/projects/${t42Slug}`);
        const detailHeading = mobilePage.getByRole('heading', {
          level: 3,
          name: t42TitleRe,
        });
        await expect(detailHeading.first()).toBeVisible();
        const detailArticle = mobilePage.locator('article', { has: detailHeading });
        await assertProgressRingDone(detailArticle.first());
        await assertT42LinkRow(detailArticle.first(), t42PublicAssertions);
        // Mobile Home is skipped by design: the bundle's MobileHome has no
        // project-card region (deferred `@designer` consult, post-launch).
      } finally {
        // Loud cleanup (EH-01) — surface close failures rather than swallow.
        await mobileContext.close();
      }
    });

    // -------------------------------------------------------------------
    // T43.F end-to-end — admin ProjectMediaField round-trip.
    //
    // Create project → add single + pair row → fill captions + uploads →
    // drag-reorder (pair above single) → Save media → reload → assert the
    // reordered captions match by position.
    //
    // HTML5 native drag-drop note: Playwright's `.dragTo()` simulates mouse
    // events, which do NOT trigger HTML5 DragEvent listeners. The helper
    // below dispatches DragEvents with a shared DataTransfer so the
    // `draggable` div's `onDragStart` / `onDragOver` / `onDrop` handlers
    // fire as they would for a real human drag.
    // -------------------------------------------------------------------

    await runStep(failures, 'T43.F: media-field create + reorder + save round-trip', async () => {
      await page.goto('/admin/projects/new');
      await page.getByLabel('Title').fill(T43F_MEDIA_TITLE);
      await page.getByLabel('Description').fill(`T43.F media smoke ${RUN_ID}`);
      await page.getByRole('button', { name: /^save$/i }).click();
      await page.waitForURL(/\/admin\/projects(\?[^/]*)?$/, { timeout: SHORT_WAIT_MS });
      await page
        .getByRole('row', { name: new RegExp(T43F_MEDIA_TITLE) })
        .getByRole('link', { name: /^edit$/i })
        .click();
      await page.waitForURL(/\/admin\/projects\/[0-9a-f-]+$/);

      // Row 1 (single). One ImageUpload — instanceLabel `Image`.
      await page.getByRole('button', { name: '+ image' }).click();
      const png = Buffer.from(TINY_PNG_BASE64, 'base64');
      await page.getByLabel('Image choose image').setInputFiles({
        name: 't43f-single.png', mimeType: 'image/png', buffer: png,
      });
      await page.getByLabel('Image alt text').fill('T43F single alt');
      await page.getByRole('button', { name: /^upload$/i }).first().click();
      await expect(
        page.getByText(/new image saved\. preview refreshes after save\./i).first(),
      ).toBeVisible({ timeout: SHORT_WAIT_MS });
      await page.getByLabel(/^caption$/i).first().fill(T43F_CAPTION_SINGLE);

      // Row 2 (pair). Two ImageUploads — `Before image` + `After image`.
      await page.getByRole('button', { name: '+ pair' }).click();
      await page.getByLabel('Before image choose image').setInputFiles({
        name: 't43f-before.png', mimeType: 'image/png', buffer: png,
      });
      await page.getByLabel('Before image alt text').fill('T43F before alt');
      await page.getByRole('button', { name: /^upload$/i }).nth(1).click();
      await expect(
        page.getByText(/new image saved\. preview refreshes after save\./i).nth(1),
      ).toBeVisible({ timeout: SHORT_WAIT_MS });
      await page.getByLabel('After image choose image').setInputFiles({
        name: 't43f-after.png', mimeType: 'image/png', buffer: png,
      });
      await page.getByLabel('After image alt text').fill('T43F after alt');
      await page.getByRole('button', { name: /^upload$/i }).nth(2).click();
      await expect(
        page.getByText(/new image saved\. preview refreshes after save\./i).nth(2),
      ).toBeVisible({ timeout: SHORT_WAIT_MS });
      // Pair row's caption is the second textarea (row 1 already has one).
      await page.getByLabel(/^caption$/i).nth(1).fill(T43F_CAPTION_PAIR);

      // Drag pair (row 2) above single (row 1) via dispatched DragEvents.
      // Scope to the media `<ol>` by its aria-label — `getByRole('listitem')`
      // unscoped also matches AdminNav and other page lists.
      const mediaList = page.getByRole('list', { name: /project media rows/i });
      const items = mediaList.getByRole('listitem');
      await expect(items).toHaveCount(2);
      await items.evaluateAll((nodes) => {
        const src = nodes[1].querySelector('[draggable="true"]') as HTMLElement | null;
        const tgt = nodes[0].querySelector('[draggable="true"]') as HTMLElement | null;
        if (src === null || tgt === null) throw new Error('draggable handles missing');
        const dt = new DataTransfer();
        src.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }));
        tgt.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
        tgt.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
        src.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true, dataTransfer: dt }));
      });
      // After reorder the pair caption should occupy row 1.
      await expect(page.getByLabel(/^caption$/i).first()).toHaveValue(T43F_CAPTION_PAIR);
      await expect(page.getByLabel(/^caption$/i).nth(1)).toHaveValue(T43F_CAPTION_SINGLE);

      // Save media — independent from ProjectForm's Save button.
      await page.getByRole('button', { name: /^save media$/i }).click();
      // Toast text per CONSTRAINT-13 voice copy.
      await expect(page.getByText(/^media saved\.$/i)).toBeVisible({ timeout: SHORT_WAIT_MS });

      // Reload and confirm persistence — pair caption still first, single second.
      await page.reload();
      await expect(page.getByLabel(/^caption$/i).first()).toHaveValue(T43F_CAPTION_PAIR);
      await expect(page.getByLabel(/^caption$/i).nth(1)).toHaveValue(T43F_CAPTION_SINGLE);
    });

    // Cleanup — best effort; swallows individual delete failures.
    await runStep(failures, 'cleanup: delete test post', async () => {
      await page.goto('/admin/posts');
      await deleteRowsMatching(page, new RegExp(POST_TITLE));
    });
    await runStep(failures, 'cleanup: delete test projects', async () => {
      await page.goto('/admin/projects');
      await deleteRowsMatching(page, new RegExp(PROJECT_TITLE_EDITED));
      await deleteRowsMatching(page, new RegExp(PROJECT_TITLE));
      await deleteRowsMatching(page, new RegExp(IMAGE_PROJECT_TITLE));
      await deleteRowsMatching(page, t42TitleRe);
      await deleteRowsMatching(page, new RegExp(T43F_MEDIA_TITLE));
    });

    // Logout + back-button non-restoration.
    await runStep(failures, 'logout → /admin/login; back-button does not restore', async () => {
      await page.goto(ADMIN_URL);
      await page.getByRole('button', { name: /^sign out$/i }).click();
      await expect(page).toHaveURL(LOGIN_URL_RE);
      await page.goBack();
      await expect(page).toHaveURL(LOGIN_URL_RE);
      await expect(
        page.getByRole('heading', { level: 1, name: 'Projects' }),
      ).toHaveCount(0);
    });

    // CONSTRAINT-03 post-flow assertion.
    await runStep(failures, 'CONSTRAINT-03: public /projects style unchanged', async () => {
      await assertPublicStyleUnchanged(page, publicBaseline);
    });

    // Final assertion — list every step failure in the message so the QA
    // report does not have to dig into individual error contexts.
    expect(
      failures,
      `T28 step failures (${failures.length}):\n  - ${failures.join('\n  - ')}`,
    ).toEqual([]);

    // CQ-05: console / pageerror gate. We do this LAST so the message above
    // surfaces step failures even if the console is also dirty.
    errorWatch.assertNoErrors();
  });
});
