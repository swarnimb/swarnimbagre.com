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

import { test, expect, type ConsoleMessage, type Page } from '@playwright/test';
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
/** Second value, used to prove the T46 `updateStat` edit path persists. */
const STAT_VALUE_EDITED = '43';

// --- T42 end-to-end path constants (CQ-04) --------------------------------

/** T42 test project title — distinct prefix so it can't collide with T28 rows. */
const T42_PROJECT_TITLE = `T42 e2e project ${RUN_ID}`;
/** T42 description — surfaces in the public card blurb. */
const T42_PROJECT_DESCRIPTION = `T42 end-to-end project description ${RUN_ID}.`;
/** T42 github URL — https, max-length safe, non-collision. */
const T42_GITHUB_URL = 'https://github.com/test/t42-smoke';
/** T42 live URL — https, non-collision. */
const T42_LIVE_URL = 'https://example.com/t42-smoke';
/**
 * T42 post URL. The relative form is permitted by `postUrlSchema`.
 *
 * Still an admin field, so the create step still fills it, but T46 stopped
 * rendering `post_url` anywhere: the card's Writeup action resolves from the
 * linked post's slug instead. Nothing on the public side asserts this value.
 */
const T42_POST_URL = '/writing/t42-smoke-post';
/**
 * T42 progress: an in-range value the admin field must round-trip. T46
 * deleted `ProgressRing`, so it no longer reaches any public surface.
 */
const T42_PROGRESS_PERCENT = '100';
/** T46 subtitle: renders as `.sb-subtitle` under the card title. */
const T42_SUBTITLE = `T42 subtitle ${RUN_ID}`;
/**
 * T46 tags: one comma-separated text input, not a widget. The server splits,
 * trims and drops blanks, so the pills below are what the card should draw.
 */
const T42_TAGS_INPUT = 'Next.js, Supabase, Postgres';
/** Expected `.sb-tag` pill texts, in order, after the server-side split. */
const T42_TAG_PILLS: readonly string[] = ['Next.js', 'Supabase', 'Postgres'];

/** T43.F media-flow project title — distinct prefix so cleanup can scope by it. */
const T43F_MEDIA_TITLE = `T43F media project ${RUN_ID}`;
/** T43.F captions used as stable identifiers for post-reload row assertions. */
const T43F_CAPTION_SINGLE = `T43F single caption ${RUN_ID}`;
const T43F_CAPTION_PAIR = `T43F pair caption ${RUN_ID}`;

/**
 * T46 public card action labels. Exact visible text on the `.sb-action`
 * anchors inside `.sb-actions`. These replace the deleted `TypoIcon` glyph
 * labels, which is why no Unicode is pinned here any more.
 */
const ACTION_DEMO_TEXT = 'Demo';
const ACTION_GITHUB_TEXT = 'GitHub';
const ACTION_WRITEUP_TEXT = 'Writeup';
/** Copy rendered as `.sb-soon` in place of the actions when a card has none. */
const ACTION_EMPTY_TEXT = 'links coming soon';
/** Copy rendered as `.sb-noprev` when a project has zero `project_media` rows. */
const NO_PREVIEW_TEXT = 'no preview yet';
/** Text typed into the home chat box so the echoed bubble is identifiable. */
const HOME_FOLLOWUP = 'so it does nothing at all';

/**
 * T46 removed the server-side device split and the whole `components/public/
 * mobile/` tree, so there is no mobile UA context to open any more: the public
 * site is one responsive render with a single 640px breakpoint. Mobile
 * coverage is therefore a viewport resize below that breakpoint, followed by a
 * resize back to the runner default so the admin steps after it lay out wide.
 */
const MOBILE_VIEWPORT = { width: 390, height: 844 } as const;
const DESKTOP_VIEWPORT = { width: 1280, height: 720 } as const;

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
 * it works for the `Linked writeup` select as well as `Status`.
 *
 * The trigger's accessible name comes from `<Label htmlFor="…">`; the
 * linked-post select label is "Linked writeup" (see ProjectFormDisplay.tsx).
 * T46 deleted the third consumer, the "Thumbnail" select, along with
 * `thumb_kind` itself.
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
 * Assert that the T46 card's three action links render with their exact
 * visible text, the right primary/secondary treatment, and the URLs we
 * submitted on the admin form. Scope the assertion to one card by passing
 * the `article.sb-card` Locator in.
 *
 * T46 replaced the `TypoIcon` glyph row with plain anchors in `.sb-actions`:
 * `Demo` for the live URL, `GitHub` for the repo, `Writeup` for the linked
 * post. Two consequences for this helper:
 *   1. `Writeup` points at `/writing/[slug]` derived from `post_id`, not at
 *      the `post_url` column, which no longer renders anywhere.
 *   2. There is no inert-link regression guard any more. `TypoIcon` called
 *      `preventDefault` unconditionally and the same bug existed on the old
 *      `SocialIcon`; both components are deleted, and these are ordinary
 *      anchors with no click handler for a guard to catch.
 */
async function assertT42ActionRow(
  scope: Page | import('@playwright/test').Locator,
  expectedUrls: {
    githubUrl: string;
    liveUrl: string;
    writeupHref: string;
  },
): Promise<void> {
  const demoLink = scope.getByRole('link', { name: ACTION_DEMO_TEXT });
  const githubLink = scope.getByRole('link', { name: ACTION_GITHUB_TEXT });
  const writeupLink = scope.getByRole('link', { name: ACTION_WRITEUP_TEXT });
  await expect(demoLink.first()).toBeVisible();
  await expect(githubLink.first()).toBeVisible();
  await expect(writeupLink.first()).toBeVisible();
  await expect(demoLink.first()).toHaveAttribute('href', expectedUrls.liveUrl);
  await expect(githubLink.first()).toHaveAttribute('href', expectedUrls.githubUrl);
  await expect(writeupLink.first()).toHaveAttribute(
    'href',
    expectedUrls.writeupHref,
  );
  // Only the live URL gets the filled treatment; the other two are outlines.
  await expect(demoLink.first()).toHaveClass(/sb-action--primary/);
  await expect(githubLink.first()).toHaveClass(/sb-action--secondary/);
  await expect(writeupLink.first()).toHaveClass(/sb-action--secondary/);
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
    //
    // T46 replaced the shadcn Table with a stack of editable `<li>` cards,
    // matching the notes surface. A `<form>` cannot legally be a child of a
    // `<tr>`, so in-place editing forced the change. Two consequences here:
    //
    //   1. Row assertions target `listitem`, not `cell` / `row`.
    //   2. `getByLabel('Category')` is now ambiguous, because every rendered
    //      row carries the same six labels. Fields are addressed by id
    //      instead: the insert form uses the bare `stat-` prefix, while rows
    //      use `stat-<uuid>-`, so `#stat-category` matches only the form.
    await runStep(failures, 'stats: insert + edit + delete with confirm modal', async () => {
      await page.goto('/admin/stats');
      await assertVoiceClean(page, '/admin/stats');

      await page.locator('#stat-category').fill(STAT_CATEGORY);
      await page.locator('#stat-label').fill(STAT_LABEL);
      await page.locator('#stat-value').fill(STAT_VALUE);
      await page.getByRole('button', { name: /^save$/i }).first().click();

      const statCard = page
        .getByRole('listitem')
        .filter({ hasText: STAT_LABEL });
      await expect(statCard).toHaveCount(1);

      // T46 edit path (`updateStat`). Stats were insert-or-delete only until
      // the redesign made the Other-page tiles hand-maintained and long-lived.
      const valueField = statCard.locator('input[name="value"]');
      await valueField.fill(STAT_VALUE_EDITED);
      await statCard.getByRole('button', { name: /^save$/i }).click();
      await page.reload();
      await expect(
        page
          .getByRole('listitem')
          .filter({ hasText: STAT_LABEL })
          .locator('input[name="value"]'),
      ).toHaveValue(STAT_VALUE_EDITED);

      await page
        .getByRole('listitem')
        .filter({ hasText: STAT_LABEL })
        .getByRole('button', { name: /^delete$/i })
        .click();
      await confirmDeleteInDialog(page);
      await expect(
        page.getByRole('listitem').filter({ hasText: STAT_LABEL }),
      ).toHaveCount(0);
    });

    // -------------------------------------------------------------------
    // T42 end-to-end path: admin create with the content-model fields →
    // publish → assert the public render.
    //
    // Image attachment to the deprecated `image_id` / `image_after_id`
    // columns is SKIPPED — T43.F removed `ProjectImageField`, so those
    // columns have no admin write surface at all. Project images now live
    // in `project_media`, exercised by the dedicated T43.F step further
    // below. This T42 path therefore exercises the still-no-image public
    // render branch, which after T46 is the `.sb-noprev` empty frame.
    //
    // There is no mobile variant to assert any more. T46 deleted the
    // server-side device split, so the public tree is one responsive render
    // and the mobile check below is a viewport resize under 640px.
    // -------------------------------------------------------------------

    await runStep(failures, 'T42: create project with every content-model field filled', async () => {
      await page.goto('/admin/projects/new');
      await page.getByLabel('Title').fill(T42_PROJECT_TITLE);
      await page.getByLabel('Description').fill(T42_PROJECT_DESCRIPTION);
      await page.getByLabel('GitHub URL').fill(T42_GITHUB_URL);
      await page.getByLabel('Live URL').fill(T42_LIVE_URL);
      await page.getByLabel('Post URL').fill(T42_POST_URL);
      await page.getByLabel('Progress').fill(T42_PROGRESS_PERCENT);
      // T46 replaced the `Thumbnail` select with these two plain text inputs.
      await page.getByLabel('Subtitle').fill(T42_SUBTITLE);
      await page.getByLabel('Tags').fill(T42_TAGS_INPUT);
      // T45.B: attach the published post created earlier. After T46 that link
      // is what renders the card's `Writeup` action, so a project with no
      // linked post gets one fewer action.
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
      // T46: the Writeup action resolves from the linked post's slug, which
      // is why this reads `postSlug` captured by the posts step above rather
      // than the `post_url` column we also filled.
      writeupHref: `/writing/${postSlug}`,
    };
    const t42TitleRe = new RegExp(T42_PROJECT_TITLE);

    /** Locate one `article.sb-card` on `/projects` by its `h2` title text. */
    const cardByTitle = (titleRe: RegExp) => {
      const title = page.locator('h2.sb-card-title', { hasText: titleRe });
      return page.locator('article.sb-card', { has: title }).first();
    };

    // Home no longer carries a project region. T46 turned `/` into a static
    // fake chat: a canned question, the bio answer, three nav pills, the
    // reach-out row, and an input whose only job is to echo itself back.
    await runStep(failures, 'T46 home: static chat renders and echoes a submitted question', async () => {
      await page.goto('/');
      await expect(page.locator('.h-qbubble').first()).toBeVisible();
      await expect(page.locator('.h-avatar').first()).toBeVisible();
      await expect(page.locator('.h-bio')).toBeVisible();
      // Projects / Writing / Other.
      await expect(page.locator('.h-btn')).toHaveCount(3);
      await expect(page.locator('.h-find')).toBeVisible();

      // Submitting is client-only: no model, no API route, no navigation.
      // The echoed second bubble is the only proof the handler ran, so it is
      // what we assert rather than any network effect.
      await page.locator('.h-input').fill(HOME_FOLLOWUP);
      await page.locator('.h-send').click();
      await expect(page.locator('.h-qbubble')).toHaveCount(2);
      await expect(page.locator('.h-qbubble').nth(1)).toHaveText(HOME_FOLLOWUP);
      await expect(page.locator('.h-reply')).toBeVisible();
      await expect(page.locator('.h-reply')).not.toBeEmpty();
    });

    await runStep(failures, 'T46 desktop: /projects renders the card body + actions', async () => {
      await page.goto('/projects');
      await expect(
        page.locator('h2.sb-card-title', { hasText: t42TitleRe }).first(),
      ).toBeVisible();
      const card = cardByTitle(t42TitleRe);

      // Every field we submitted on the admin form, in the order the card
      // draws them. `.sb-card-title--empty` is the untitled fallback, so its
      // absence confirms the title came from the row.
      await expect(card.locator('h2.sb-card-title')).toHaveText(T42_PROJECT_TITLE);
      await expect(card.locator('h2.sb-card-title--empty')).toHaveCount(0);
      await expect(card.locator('p.sb-subtitle')).toHaveText(T42_SUBTITLE);
      await expect(card.locator('p.sb-desc')).toHaveText(T42_PROJECT_DESCRIPTION);
      await expect(card.locator('span.sb-tag')).toHaveText([...T42_TAG_PILLS]);

      // Zero `project_media` rows (see the section note above), so the frame
      // draws its empty state and mounts no carousel track.
      await expect(card.locator('.sb-frame .sb-noprev')).toHaveText(NO_PREVIEW_TEXT);
      await expect(card.locator('.sb-track')).toHaveCount(0);

      await assertT42ActionRow(card, t42PublicAssertions);
    });

    // T46 retired the T45.D title-link gating: with the detail route gone, no
    // card title is ever a link. The enriched-vs-bare contrast survives one
    // element lower, in the actions row.
    //   - Enriched (T42 project: live URL + repo + linked writeup) → three
    //     `.sb-action` anchors.
    //   - Bare (PROJECT_TITLE_EDITED: published, no links, no linked post) →
    //     the `.sb-soon` placeholder instead.
    await runStep(failures, 'T46 desktop: /projects actions gating (enriched vs bare)', async () => {
      await page.goto('/projects');

      const enrichedCard = cardByTitle(t42TitleRe);
      await expect(enrichedCard.locator('.sb-action')).toHaveCount(3);
      await expect(enrichedCard.locator('.sb-soon')).toHaveCount(0);
      // Titles are inert headings on every card now, enriched or not.
      await expect(enrichedCard.locator('h2.sb-card-title a')).toHaveCount(0);

      const bareRe = new RegExp(PROJECT_TITLE_EDITED);
      await expect(
        page.locator('h2.sb-card-title', { hasText: bareRe }).first(),
      ).toBeVisible();
      const bareCard = cardByTitle(bareRe);
      await expect(bareCard.locator('.sb-action')).toHaveCount(0);
      await expect(bareCard.locator('.sb-soon')).toHaveText(ACTION_EMPTY_TEXT);
      await expect(bareCard.locator('h2.sb-card-title a')).toHaveCount(0);
    });

    // Mobile is a resize, not a second context: T46 deleted the UA-based
    // device split, so the same tree has to hold up under 640px.
    await runStep(failures, 'T46 mobile viewport: /projects card holds under the 640px breakpoint', async () => {
      await page.setViewportSize({ ...MOBILE_VIEWPORT });
      try {
        await page.goto('/projects');
        await expect(
          page.locator('h2.sb-card-title', { hasText: t42TitleRe }).first(),
        ).toBeVisible();
        const card = cardByTitle(t42TitleRe);
        await expect(card.locator('p.sb-subtitle')).toBeVisible();
        await expect(card.locator('span.sb-tag')).toHaveCount(T42_TAG_PILLS.length);
        await expect(card.locator('.sb-frame .sb-noprev')).toBeVisible();
        await assertT42ActionRow(card, t42PublicAssertions);
      } finally {
        // Restore the runner default so the admin steps below lay out wide.
        // Loud by design (EH-01): a failed restore throws rather than leaving
        // every later step silently narrow.
        await page.setViewportSize({ ...DESKTOP_VIEWPORT });
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

    // -------------------------------------------------------------------
    // T44.D end-to-end — admin list drag-reorder round-trip.
    //
    // The /admin/projects list now renders a reorderable table body
    // (`ResourceListReorder`): each row is `draggable` with HTML5 DnD, an
    // explicit "Save order" button commits the order via `saveProjectOrder`.
    // Same DragEvent + shared DataTransfer dispatch technique as the T43.F
    // media step — Playwright's mouse-based `.dragTo()` does NOT fire HTML5
    // DragEvent listeners.
    //
    // Capture the first two row titles, drag row 1 onto row 2, Save order,
    // assert the toast, reload, and assert the two titles swapped position.
    // -------------------------------------------------------------------
    await runStep(failures, 'T44.D: projects list drag-reorder + save round-trip', async () => {
      await page.goto('/admin/projects');
      const bodyRows = page.locator('tbody tr');
      // The smoke flow seeds several projects; need at least two to reorder.
      const rowCount = await bodyRows.count();
      expect(rowCount, 'need >= 2 project rows to exercise reorder').toBeGreaterThanOrEqual(2);

      // Title is the second cell (cell 0 is the drag handle).
      const titleOf = async (i: number): Promise<string> =>
        ((await bodyRows.nth(i).locator('td').nth(1).textContent()) ?? '').trim();
      const firstTitle = await titleOf(0);
      const secondTitle = await titleOf(1);
      expect(firstTitle, 'first row title captured').not.toBe('');
      expect(secondTitle, 'second row title differs from first').not.toBe(firstTitle);

      // Drag row 1 onto row 2 via dispatched DragEvents on the draggable rows.
      await bodyRows.evaluateAll((nodes) => {
        const src = nodes[0] as HTMLElement;
        const tgt = nodes[1] as HTMLElement;
        if (!src || !tgt) throw new Error('reorder rows missing');
        const dt = new DataTransfer();
        src.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }));
        tgt.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
        tgt.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
        src.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true, dataTransfer: dt }));
      });
      // After the drag, the originally-second title now occupies row 1.
      await expect(bodyRows.nth(0).locator('td').nth(1)).toHaveText(secondTitle);
      await expect(bodyRows.nth(1).locator('td').nth(1)).toHaveText(firstTitle);

      // Commit the new order.
      await page.getByRole('button', { name: /^save order$/i }).click();
      await expect(page.getByText(/^order saved\.$/i)).toBeVisible({ timeout: SHORT_WAIT_MS });

      // Reload — the server now sorts by the persisted order; the swap holds.
      await page.reload();
      const reloadedRows = page.locator('tbody tr');
      await expect(reloadedRows.nth(0).locator('td').nth(1)).toHaveText(secondTitle);
      await expect(reloadedRows.nth(1).locator('td').nth(1)).toHaveText(firstTitle);
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
