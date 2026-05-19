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

    // Image upload + replace (T26 surface). MAY BE BLOCKING — known nested
    // <form> bug from T26 wiring (ImageUpload.tsx <form> nests inside
    // ProjectForm/PostForm <form>). The Upload submit either submits the
    // OUTER form (saving the project) or fails silently; the success copy
    // never appears. Captured here as a step failure so the QA report
    // surfaces it explicitly without masking the rest of the flow.
    await runStep(failures, 'images: upload via project edit form (T26 wiring)', async () => {
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

      const pngBuffer = Buffer.from(TINY_PNG_BASE64, 'base64');
      await page.locator('input[type="file"]').setInputFiles({
        name: 't28-first.png',
        mimeType: 'image/png',
        buffer: pngBuffer,
      });
      const altWithPayload = `T28 alt ${XSS_IMG_PAYLOAD}`;
      await page.getByLabel(/^alt text$/i).fill(altWithPayload);
      const uploadBtn = page.getByRole('button', { name: /^upload$/i });
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
