# Plan — Phase 1: Foundation

**Date:** 2026-05-06
**Status:** Complete (2026-05-11, session 9)
**Tasks:** T1–T14 (14 tasks)
**Predecessor:** none — first phase
**Successor:** [`plan-phase-2-admin.md`](plan-phase-2-admin.md)

Foundation phase covers external-deps prep, Next.js 15 App Router scaffolding, Supabase project provisioning, schema + RLS migrations, magic-link auth scaffolding, public site pages, Markdown render layer, image read layer, env-var coordination, and first Vercel deploy. End state: public site is live with DB-driven content; admin panel routes exist as auth-gated placeholders.

---

## T1 — External-deps prep (Vercel link, Supabase create, DNS plan)

**Files:** none (operational task; no code commits)

**Functions to implement:** [setup task]

**Acceptance criteria:**
- [x] Vercel project created and linked to the GitHub repo `swarnimbagre.com`. Production branch set to `main`. (DS-05: documented in README setup section once code lands.)
- [x] Supabase free-tier project created. Project ref recorded in a private note (not in repo — SEC-01).
- [x] DNS plan: apex `swarnimbagre.com` and `www` subdomain configured to point at Vercel. Action recorded but actual cutover deferred until Phase 4 (T39).
- [x] OpenClaw shared-secret coordination: noted as deferred to Phase 3 (T29). No secret generated yet.
- [x] No code commits at this stage. Repo remains empty (or has only `.gitignore`, README placeholder, and existing `docs/`).

**Tests required:** [setup task — no automated test]

**Depends on:** none

**Specialist:** none (builder-driven)

---

## T2 — Next.js 15 App Router scaffold

**Files:**
- `package.json` (create)
- `next.config.ts` (create)
- `tsconfig.json` (create)
- `app/layout.tsx` (create — root, public-only fonts and CSS, NO Tailwind)
- `app/(admin)/layout.tsx` (create — admin layout, Tailwind/shadcn import deferred to Phase 2)
- `app/page.tsx` (create — Home placeholder)
- `.gitignore` (create — covers `.env*`, `node_modules/`, `.next/`, `out/`, `profile.md`, `content/`, `docs/session-log.md`, `docs/session-handoff.md`, `docs/testing-setup.md`, `docs/framework-issues.md`) (SEC-07)
- `.env.example` (create — names only, no values) (SEC-01)
- `README.md` (create or update — local dev steps, env vars, test command) (DS-05)

**Functions to implement:** [setup task]

**Acceptance criteria:**
- [x] Next.js 15 + React 19 + TypeScript installed. App Router only. No Pages Router.
- [x] Root `app/layout.tsx` imports the public bundle's fonts (Fraunces, JetBrains Mono via `next/font`) and `styles/colors_and_type.css` + `styles/base.css`. No Tailwind import.
- [x] `app/(admin)/layout.tsx` exists as a route group with placeholder content (Tailwind import added in Phase 2 T15).
- [x] `npm run dev` starts cleanly with no console errors.
- [x] `npm run build` succeeds with no warnings (CQ-05).
- [x] `.gitignore` contains every entry listed in SEC-07.
- [x] `.env.example` lists `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` with no values (SEC-01).
- [x] `README.md` documents: project description (one paragraph), setup (`cp .env.example .env.local`, `npm install`, `npm run dev`), env vars (names only — reference `.env.example`), test command (`npm test`) (DS-05).

**Tests required:**
- `should render root layout without errors` — Next.js dev server smoke (TS-04: critical path).

**Depends on:** T1

**Specialist:** `@cto`

---

## T3 — Supabase project provisioning and schema migration

**Files:**
- `supabase/migrations/001_create_schema.sql` (create)
- `.env.example` (update)

**Functions to implement:** [database migration — SQL only]

**Acceptance criteria:**
- [x] Migration creates the four tables defined in `architecture.md` §2: `projects`, `posts`, `stats`, `images`.
- [x] Enum types `project_status` and `post_status` with values `'draft'`, `'published'` are created and used.
- [x] All columns with NOT NULL, UNIQUE, CHECK constraints exactly as specified in architecture.md (CQ-04: no magic values; constraints are named).
- [x] Indexes: `(status, created_at DESC)` on `projects` and `posts`; `(category, created_at DESC)` on `stats`. UNIQUE on `slug` for `projects` and `posts`.
- [x] Migration is idempotent — uses `CREATE TABLE IF NOT EXISTS` and `DO $$ ... $$` blocks for enum creation.
- [x] Migration includes a header comment stating purpose, date, and that RLS is added in subsequent migrations.

**Tests required:**
- `migration applies cleanly to a fresh database` — apply, verify table list and column types via `information_schema` (TS-04: data layer is critical path).
- `migration is idempotent` — apply twice, second run is a no-op.

**Depends on:** T2

**Specialist:** `@supabase`

---

## T4 — RLS policies for `projects`

**Files:**
- `supabase/migrations/002_rls_projects.sql` (create)

**Functions to implement:** [SQL only]

**Acceptance criteria:**
- [x] `ALTER TABLE projects ENABLE ROW LEVEL SECURITY` is the first statement.
- [x] Policy `projects_public_select` — role `anon`, FOR SELECT, USING `(status = 'published')`.
- [x] Policy `projects_admin_all` — role `authenticated`, FOR ALL, USING `true`, WITH CHECK `true`.
- [x] No other policies. Default-deny for every other role and every other operation (SEC-04: explicit authorization per resource; CONSTRAINT-08).
- [x] Header comment explains: "Public can read published. Admin can do anything. Default-deny for everything else."
- [x] Migration is idempotent (uses `DROP POLICY IF EXISTS` then `CREATE POLICY`).

**Tests required:**
- `anon should see only published projects` — query as anon, assert no draft rows in result (TS-04).
- `anon should not be able to insert` — INSERT as anon, assert permission-denied error (TS-04).
- `authenticated should see all projects including drafts` — query as authenticated, assert draft rows present.

**Depends on:** T3

**Specialist:** `@supabase`, `@security`

---

## T5 — RLS policies for `posts`

**Files:**
- `supabase/migrations/003_rls_posts.sql` (create)

**Functions to implement:** [SQL only]

**Acceptance criteria:**
- [x] `ALTER TABLE posts ENABLE ROW LEVEL SECURITY` first.
- [x] Policy `posts_public_select` — role `anon`, FOR SELECT, USING `(status = 'published')`.
- [x] Policy `posts_admin_all` — role `authenticated`, FOR ALL, USING `true`, WITH CHECK `true`.
- [x] Same naming, comment, and idempotency rules as T4.

**Tests required:**
- `anon should see only published posts` (TS-04).
- `anon should not be able to insert posts` (TS-04).
- `authenticated should see all posts` (TS-04).

**Depends on:** T3

**Specialist:** `@supabase`, `@security`

---

## T6 — RLS policies for `stats`

**Files:**
- `supabase/migrations/004_rls_stats.sql` (create)

**Functions to implement:** [SQL only]

**Acceptance criteria:**
- [x] `ALTER TABLE stats ENABLE ROW LEVEL SECURITY` first.
- [x] Policy `stats_public_select` — role `anon`, FOR SELECT, USING `true`.
- [x] Policy `stats_admin_all` — role `authenticated`, FOR ALL, USING `true`, WITH CHECK `true`.
- [x] **No INSERT policy for `anon`.** Programmatic INSERTs go through the Edge Function in Phase 3 using the service role, which bypasses RLS (CONSTRAINT-04).
- [x] Header comment: "Public can read all stats (append-only display). Programmatic INSERTs come via the stats-ingest Edge Function in Phase 3, using the service role. Admin can do anything."

**Tests required:**
- `anon should read all stats` (TS-04).
- `anon should not insert stats directly` — INSERT as anon, assert permission-denied (TS-04).
- `authenticated should read and modify all stats` (TS-04).

**Depends on:** T3

**Specialist:** `@supabase`, `@security`

---

## T7 — RLS policies for `images` + Storage bucket policy

**Files:**
- `supabase/migrations/005_rls_images.sql` (create)
- Supabase Storage bucket settings (operational; recorded in migration as a comment if not SQL-expressible)

**Functions to implement:** [SQL only + bucket configuration]

**Acceptance criteria:**
- [x] `ALTER TABLE images ENABLE ROW LEVEL SECURITY` first.
- [x] Policy `images_public_select` — role `anon`, FOR SELECT, USING a join condition that returns true only when the parent (project or post) has `status='published'`. Implemented via subqueries on `projects` and `posts` keyed by `parent_id` and `parent_type`.
- [x] Policy `images_admin_all` — role `authenticated`, FOR ALL, USING `true`, WITH CHECK `true`.
- [x] Storage bucket `images` created (private). Bucket policy enforces 2 MB max file size (SEC-02: validate at boundary).
- [x] Header comment explains the parent-status gating.

**Tests required:**
- `anon should see images for published parents` (TS-04).
- `anon should not see images for draft parents` (TS-04).
- `authenticated should see all images` (TS-04).

**Depends on:** T3

**Specialist:** `@supabase`, `@security`

---

## T8 — Slug-lock trigger for `projects` and `posts`

**Files:**
- `supabase/migrations/006_slug_lock_triggers.sql` (create)

**Functions to implement:**
- PL/pgSQL trigger function `prevent_slug_change_after_publish()` (≤50 lines — CQ-01).

**Acceptance criteria:**
- [x] Trigger function raises an exception when `OLD.slug != NEW.slug AND OLD.status = 'published'` (CONSTRAINT-12).
- [x] BEFORE UPDATE triggers attached to `projects` and `posts`.
- [x] Function name and trigger names are explicit and descriptive (CQ-06).
- [x] Header comment: "Slugs are immutable once published. This is a contract with anyone who has linked to a published page."

**Tests required:**
- `slug change on published row should raise exception` (TS-04: data write critical path).
- `slug change on draft row should succeed` (happy path — TS-01).
- `non-slug update on published row should succeed` (regression: trigger should not block other updates).

**Depends on:** T3

**Specialist:** `@supabase`

---

## T9 — Supabase Auth configuration + magic-link scaffolding

**Files:**
- `docs/auth-flow.md` (create — DS-02)
- `.env.example` (update — confirm Supabase URL and anon key are listed)
- Supabase dashboard auth settings (operational)

**Functions to implement:** [setup task]

**Acceptance criteria:**
- [x] Email provider enabled in Supabase Auth. All other providers disabled (CONSTRAINT-09).
- [x] Single user `swarnim.build@gmail.com` created in Supabase Auth dashboard.
- [x] JWT expiry: 1 hour (default). Refresh expiry: 30 days inactivity (default). No customization (CONSTRAINT-09).
- [x] `docs/auth-flow.md` documents: (1) admin clicks Login, (2) enters email, (3) receives magic link, (4) clicks link → callback → session set, (5) redirects to `/admin`, (6) logout clears session, (7) lockout fallback = manual session invalidation in Supabase dashboard (DS-02).
- [x] `.env.example` confirms `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (SEC-01).

**Tests required:** [setup; flow tested in Phase 2 T17]

**Depends on:** T6

**Specialist:** `@supabase`

---

## T10 — Public site pages (Home, Projects, Writing, Other) ported verbatim from bundle

Sub-phased on 2026-05-07 into T10a–T10d. Track progress at sub-phase level. Original acceptance criteria roll up across all four sub-phases.

**Roll-up reference (original T10 spec — not directly trackable; trackable items live on T10a–T10d):**

**Files:**
- `app/page.tsx` (Home)
- `app/projects/page.tsx`
- `app/writing/page.tsx`
- `app/other/page.tsx`
- `components/public/` (port from `site/components.jsx` and `site/mobile-components.jsx` verbatim)
- `styles/colors_and_type.css` (copy from `site/colors_and_type.css`)
- `styles/base.css` (copy from `site/base.css` if present)
- `middleware.ts` (create — UA detection for desktop vs. mobile component selection)

**Functions to implement:**
- `isMobileUserAgent(ua: string): boolean` (≤50 lines, CQ-01) — checks the request's User-Agent against the bundle's mobile detection rules.

**Acceptance criteria:**
- All four pages render the bundle's components verbatim — same hex codes, same px values, same fonts, same 220ms `cubic-bezier(.2, .7, .2, 1)` timing (CONSTRAINT-05).
- No Tailwind utility classes anywhere in `app/` or `components/public/` — verified by grep for `@apply`, `text-`, `w-`, `h-`, `bg-`, `rounded-` (CONSTRAINT-03).
- Server-side UA detection in `middleware.ts` decides which variant (desktop or mobile components) to render. Single canonical URL per page.
- All pages have static placeholder content for now — DB wiring in T11.
- Tweaks panel gated by `NEXT_PUBLIC_TWEAKS=1` env var (not querystring).
- All four pages have `<title>`, `<meta description>`, and `<link rel="canonical">` set.

**Tests required:**
- `each public page renders without errors` — Playwright snapshot per page (TS-04).
- `mobile UA serves mobile component variant` — middleware test with mobile UA header.
- `desktop UA serves desktop component variant` — middleware test with desktop UA header.

**Depends on:** T2

**Specialist:** `@ui-swarnimbagre`

---

## T10a — Port 22 bundle components verbatim to TypeScript

**Files:**
- `components/public/` (16 .tsx files ported from `site/components.jsx`): Wordmark, SocialIcon, Nav, Footer, TypoIcon, StatusPill, ProjectThumb, ProjectRow, SectionHead, MorePointer, Page, ProjectCard, ProjectMedia, DemoLoop, BeforeAfterMedia, StillMedia
- `components/public/mobile/` (6 .tsx files ported from `site/mobile-components.jsx`): MobilePage, MobileNav, MobileFooter, MobilePageTitle, MobileProjectCard, MobileProjectRow
- `styles/colors_and_type.css` (copy from `site/colors_and_type.css`)
- `styles/base.css` (copy from `site/base.css` if present)
- Skipped: `site/ios-frame.jsx` (design-time only), `site/tweaks-panel.jsx` (deferred to T10d)

**Conversion rules per file:** (1) `'use client'` at top. (2) Replace `const useState = React.useState` with `import { useState, useEffect } from 'react'`. (3) Convert `function Foo({ x })` → `export function Foo({ x }: FooProps)` with minimal `interface FooProps`. (4) Preserve verbatim: inline styles, hex codes, px values, SVG paths, 220ms `cubic-bezier(.2,.7,.2,1)` timing, defaults, prop names.

**Acceptance criteria:**
- [x] All 22 components ported with conversion rules applied uniformly.
- [x] No Tailwind utility classes anywhere (`@apply`, `text-`, `w-`, `h-`, `bg-`, `rounded-`) — verified by grep.
- [x] No `any` types — every component has `interface FooProps`.
- [x] `onNav` prop interface preserved verbatim (not wired to router — deferred to T10c).
- [x] `href="#"` + `e.preventDefault()` preserved verbatim in SocialIcon (real URLs deferred to T10c).
- [x] Hex codes, px values, SVG paths, animation timing match source byte-for-byte.
- [x] CSS files copied to `styles/` with no modification.

**Tests required:** None at this stage — Vitest/Playwright don't exist until T10.5. Visual verification deferred until T10c when pages render.

**Depends on:** T2

**Specialist:** `@ui-swarnimbagre`

---

## T10b — UA-detect middleware

**Files:** `middleware.ts` (create — UA detection for desktop vs. mobile component selection)

**Functions:** `isMobileUserAgent(ua: string): boolean` (≤50 lines, CQ-01)

**Acceptance criteria:**
- [x] Server-side UA detection in `middleware.ts` decides desktop vs mobile variant per request.
- [x] Single canonical URL per page (no redirects or path forking).
- [x] Function ≤ 50 lines, no external deps beyond Next.js built-ins.

**Tests required:** Backfilled at T10.5 (mobile UA test, desktop UA test).

**Depends on:** T10a

**Specialist:** `@ui-swarnimbagre`

---

## T10c — Build 4 page files and wire navigation

**Files:** `app/page.tsx` (Home), `app/projects/page.tsx`, `app/writing/page.tsx`, `app/other/page.tsx`. Plus implicit: the 8 bundle page-level components ported into `components/public/pages/` and `components/public/mobile/pages/`, plus `lib/nav-targets.ts` and `lib/social-links.ts` foundation constants, plus `global.d.ts` (React 19 JSX workaround). Doc gap surfaced 2026-05-11 — original Files list was incomplete.

**Acceptance criteria:**
- [x] All four pages render the bundle's components verbatim — same hex codes, same px values, same fonts, same 220ms `cubic-bezier(.2, .7, .2, 1)` timing (CONSTRAINT-05).
- [x] Static placeholder content only — DB wiring is T11.
- [x] `onNav` wired to `next/navigation` `router.push` (resolves Conflict 1 from sub-phasing).
- [x] `SocialIcon` real URLs wired (mailto, x.com, etc.) — replaces `href="#"` placeholders (resolves Conflict 2). YouTube href kept as `#` placeholder pending URL from builder.

**Tests required:** Backfilled at T10.5 (`each public page renders without errors` Playwright snapshots).

**Depends on:** T10a, T10b

**Specialist:** `@ui-swarnimbagre`

---

## T10d — Tweaks panel + SEO meta

**Files:** Port `site/tweaks-panel.jsx` → `components/public/TweaksPanel.tsx`. Add `<title>`, `<meta description>`, `<link rel="canonical">` to all 4 pages.

**Acceptance criteria:**
- [x] Tweaks panel gated by `NEXT_PUBLIC_TWEAKS=1` env var (not querystring).
- [x] All four pages have `<title>`, `<meta description>`, and `<link rel="canonical">` set.

**Tests required:** None.

**Depends on:** T10c

**Specialist:** `@ui-swarnimbagre`

---

## T10.5 — Testing infrastructure (Vitest + Playwright)

> **Inserted 2026-05-07** between T10 and T11. T10 sub-phases (10a–10d) run untested first; T10.5 installs the harness; T10's listed tests are then backfilled here, and T11 onwards write tests against real infra. Logged in `docs/framework-issues.md` — neither `@modify-plan` nor `@create-plan` fits non-feature plan additions (both gate on PRD presence).

**Files:**
- `package.json` (modify — add devDeps and scripts)
- `vitest.config.ts` (create)
- `playwright.config.ts` (create)
- `tests/setup.ts` (create — Vitest setup, jsdom)
- `tests/smoke.test.ts` (create — one trivial passing unit test)
- `tests/e2e/smoke.spec.ts` (create — one trivial passing e2e test)
- `.gitignore` (modify — add `/test-results/`, `/playwright-report/`, `/playwright/.cache/`) (SEC-07)

**Functions to implement:** [setup task]

**Acceptance criteria:**
- [x] Vitest installed (latest stable). `npm test` runs the unit harness cleanly.
- [x] Playwright installed. `npm run test:e2e` runs the browser harness against the dev server.
- [x] One trivial unit test passes (sanity check that Vitest is wired).
- [x] One trivial e2e test passes (navigates to `/` and asserts a stable element renders).
- [x] No CI step added — CI is Phase 4 territory.
- [x] `.gitignore` updated to ignore Playwright artifacts (SEC-07).
- [x] Backfill the three T10 tests once infra is in place (see Backfill below).

**Backfill after T10.5 lands (these are T10 acceptance that couldn't be written until now):**
- `each public page renders without errors` — Playwright snapshot per page (TS-04)
- `mobile UA serves mobile component variant` — middleware test
- `desktop UA serves desktop component variant` — middleware test

**Tests required:**
- The two trivial passing tests above are the acceptance test for this task.

**Depends on:** T10d

---

## T11 — Database read layer for public site

**Files:**
- `lib/supabase.ts` (create — server and browser client factories)
- `lib/db.ts` (create — public read functions)
- `app/projects/page.tsx` (modify — wire up data)
- `app/projects/[slug]/page.tsx` (create — single project view)
- `app/writing/page.tsx` (modify)
- `app/writing/[slug]/page.tsx` (create — single post view)
- `app/other/page.tsx` (modify)

**Functions to implement:**
- `createServerClient(): SupabaseClient` (≤50 lines, CQ-01) — server-side Supabase client using anon key + cookie store.
- `createBrowserClient(): SupabaseClient` (≤50 lines, CQ-01) — browser client.
- `getPublishedProjects(): Promise<Project[]>` (≤50 lines, CQ-01) — reads from `projects` filtered by `status='published'`, ordered by `created_at DESC`. Throws `ServiceError` with cause on failure (EH-01, EH-02, EH-05).
- `getProjectBySlug(slug: string): Promise<Project | null>` (≤50 lines, CQ-01) — single fetch by slug; returns null on miss; throws on DB error.
- `getPublishedPosts(): Promise<Post[]>` (≤50 lines, CQ-01).
- `getPostBySlug(slug: string): Promise<Post | null>` (≤50 lines, CQ-01).
- `getStatsByCategory(): Promise<Record<string, Stat[]>>` (≤50 lines, CQ-01) — groups stats by `category`.

**Acceptance criteria:**
- [x] All queries use Supabase's query builder with `.eq()` / `.order()` — never string concatenation (SEC-03).
- [x] No hardcoded Supabase URL or key — all from `process.env.NEXT_PUBLIC_*` (SEC-01, CQ-04).
- [x] Errors are caught, logged with context (operation, sanitized inputs, stack) (EH-01, EH-02, EH-03), and re-thrown as `ServiceError` (EH-05).
- [x] User-facing pages render a clean error state if the DB query fails (EH-04). The full error detail goes to the log only.
- [x] No PII (email, etc.) in logs — only operation and presence flags (SEC-05).
- [x] All public functions have doc comments stating params, return, throws (DS-01).

**Tests required:**
- `getPublishedProjects returns rows when DB returns data` — happy path (TS-01).
- `getPublishedProjects throws ServiceError when DB fails` — error case (TS-01).
- `getProjectBySlug returns null when slug not found` (TS-01).
- `getProjectBySlug throws ServiceError when DB fails` (TS-01).
- Same shape for posts and stats functions.
- All tests mock the Supabase client (TS-03).

**Depends on:** T4, T5, T6, T10

**Specialist:** `@supabase`

---

## T12 — Markdown rendering: `marked` + DOMPurify whitelist

**Files:**
- `lib/markdown.ts` (create)
- `components/public/MarkdownContent.tsx` (create — client component)

**Functions to implement:**
- `renderMarkdown(rawMd: string): string` (security/validation — may extend to 80 lines, CQ-01) — parses with `marked`, sanitizes with DOMPurify against the locked whitelist.
- `<MarkdownContent md={string} />` (≤200 lines, CQ-02) — client component that calls `renderMarkdown` and injects via `dangerouslySetInnerHTML`.

**Acceptance criteria:**
- [x] Whitelist is exactly: `p, ul, ol, li, blockquote, code, pre, em, strong, a, h1, h2, h3, h4, img` (CONSTRAINT-06).
- [x] Allowed attributes: `a[href]` (no `javascript:` protocol), `img[src, alt]`. Everything else stripped (SEC-02).
- [x] No inline event handlers reach the DOM. DOMPurify default profile is augmented with the whitelist; result is verified by tests.
- [x] `MarkdownContent` accepts a `className` prop (CQ-06: explicit naming).
- [x] Public function has a doc comment listing the whitelist (DS-01).
- [x] No `console.log` or debug artifact (CQ-05).

**Tests required:**
- `renderMarkdown parses basic Markdown` — input `**bold**` → output contains `<strong>bold</strong>` (TS-01 happy).
- `renderMarkdown strips <script> tags` — input contains `<script>alert(1)</script>` → output does not contain `<script` (TS-01 error / TS-04 critical).
- `renderMarkdown strips inline event handlers` — input `<img src=x onerror="alert(1)">` → output has no `onerror` attribute (TS-04).
- `renderMarkdown strips javascript: protocol on links` — input `[click](javascript:alert(1))` → output `<a>` has no `javascript:` href (TS-04).
- `renderMarkdown preserves https: links` — input `[ok](https://example.com)` → output `<a href="https://example.com">` (TS-01).
- `MarkdownContent renders without errors when md is empty` (TS-01 edge).

**Depends on:** T11

**Specialist:** `@security` (review)

---

## T13 — Image read layer (Storage URL helpers + components) [x]

**Files:**
- `lib/images.ts` (create) [x]
- `components/public/ProjectImage.tsx` (create) [x]
- `components/public/PostImage.tsx` (create) [x]
- `lib/db.ts` (modify — add `getImageById`) [x]

**Functions to implement:**
- `getImageUrl(bucketPath: string, client?: SupabaseClient): Promise<string>` (≤50 lines, CQ-01) — resolves to a Supabase Storage **signed** URL (TTL 3600s). No hardcoded URLs (SEC-01, CQ-04). **Signature changed from sync `string` to async `Promise<string>` during build**: the `images` bucket is private per migration 005 RLS spec, so URLs must be signed at request time. See session 8 log + handoff for rationale.
- `getImageById(id: string, client?: SupabaseClient): Promise<ImageRecord | null>` (≤50 lines, CQ-01) — resolves an `images.id` to its row. Added to `lib/db.ts` (mirrors `getProjectBySlug` pattern). Not in original spec; needed because components take `imageId` but `getImageUrl` takes `bucketPath`.
- `<ProjectImage imageId?: string, alt: string />` async Server Component (≤200 lines, CQ-02).
- `<PostImage imageId?: string, alt: string />` async Server Component (≤200 lines, CQ-02).

**Acceptance criteria:**
- [x] Components render `<img>` with `loading="lazy"`, `alt={alt}` (alt is required by prop type — `alt: string` not `alt?: string`).
- [x] No image case: components render nothing or a typographic placeholder (no broken-image icon).
- [x] Image URLs come from the `images` table's `bucket_path` column, resolved via Supabase Storage (CONSTRAINT-07).
- [x] Errors fetching the image URL are caught and logged with context (EH-01, EH-02). Component degrades to no-image silently (EH-04 client side).

**Tests required:**
- [x] `getImageUrl returns valid URL for a known path` (TS-01 happy) — `tests/images.test.ts`.
- [x] `getImageUrl throws when path is empty` (TS-01 error) — `tests/images.test.ts`.
- [x] `ProjectImage renders <img> with alt when imageId resolves` (TS-01) — `tests/ProjectImage.test.tsx`.
- [x] `ProjectImage renders nothing when imageId is undefined` (TS-01 edge) — `tests/ProjectImage.test.tsx`.

**New devDeps added (T13):** `@testing-library/react ^16.1.0`, `@testing-library/jest-dom ^6.6.3`. Required for component render tests. `tests/setup.ts` now imports `@testing-library/jest-dom/vitest`.

**Depends on:** T7, T11

**Specialist:** `@supabase`

**Status:** Complete in session 8 (2026-05-11). 32 Vitest tests pass.

---

## T14 — Env-var coordination + first Vercel deploy (Phase 1 checkpoint)

**Files:**
- `.env.example` (finalize)
- `docs/env-vars.md` (create — DS-02)
- Vercel project settings (operational)
- `next.config.ts` (modify — add a startup check for required env vars; throw if missing — EH-01)

**Functions to implement:**
- `assertRequiredEnv(): void` (≤50 lines, CQ-01) — runs at startup, throws if any required var is missing. Names listed: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

**Acceptance criteria:**
- [x] `.env.example` is final for Phase 1: all three Supabase vars listed, no values, header comments distinguish public vs server-only (SEC-01).
- [x] Vercel project environment variables set for production with the same three names. Service role key is server-only (Production + Preview).
- [x] `docs/env-vars.md` documents: each var name, public vs server-only, where to get the value (Supabase dashboard), where to set locally (`.env.local`), where to set in production (Vercel dashboard) (DS-02).
- [x] Startup check fails loudly with a descriptive error if any var is missing (EH-01, EH-02). Verified — local build threw on missing SUPABASE_SERVICE_ROLE_KEY with a clear message listing the missing var and pointing at `docs/env-vars.md`.
- [x] `npm run build` succeeds with no warnings (CQ-05). Initial run logged 3 Dynamic-server-usage errors caught by `safeLoad`; resolved by declaring `/projects /writing /other` as `export const dynamic = 'force-dynamic'` since they call `cookies()` via `createServerClient`. Second build is clean.
- [x] First Vercel production deploy succeeds. After a one-time framework-preset fix (Vercel had it set to "Other" instead of "Next.js"), deploy is green; route table shows all DB-driven pages as `ƒ` dynamic on-demand.
- [x] Supabase logs show no errors from the deploy. Verified via `mcp__supabase__get_logs` — postgres logs clean (the only ERRORs are dashboard-side `supabase_migrations.schema_migrations does not exist` quirks unrelated to the app); API logs show 200s on `/rest/v1/projects`, `/rest/v1/posts`, `/rest/v1/stats` in the deploy window.
- [x] Auto-Logging entry written to `docs/session-log.md` documenting the Phase 1 close (DS-03).

**Tests required:**
- [x] `assertRequiredEnv throws when var is missing` (TS-01 error).
- [x] `assertRequiredEnv passes when all vars present` (TS-01 happy).
- [x] `production build succeeds` (`npm run build`) — TS-04.
- [x] `public pages render with DB data` — Playwright MCP smoke ran against `https://swarnimbagre-com.vercel.app` covering `/`, `/projects`, `/writing`, `/other`, `/writing/hello-world`. All pages: correct title/canonical, nav rendered, DB-driven content present (Hello world post listed on `/writing` with `MAY 2026` date + excerpt; full Markdown rendered on `/writing/hello-world` with `<strong>`, `<em>`, list, link, and code-fence preserved). Zero console errors aside from the known favicon 404 (carried in deferred items). Mobile-variant smoke not run — MCP browser session cannot override User-Agent; deferred.

**Depends on:** T9, T12, T13

**Specialist:** `@cto`, `@supabase`

**Status:** Complete in session 9 (2026-05-11). 35 Vitest tests pass (32 prior + 3 new). Vercel production deploy green. Commit `bbd6d5d`.

---

## Phase 1 Exit Criteria

- All 14 tasks complete; their tests passing.
- Public site live on Vercel with DB-backed content from Supabase.
- `/admin/*` routes exist as auth-gated placeholders (full admin UI is Phase 2).
- No SaaS phrases, no emoji in any committed copy (CONSTRAINT-13).
- No secrets committed; `.gitignore` enforces SEC-07.
- Mark Phase 1 row as Done in [`plan-index.md`](plan-index.md). Mark Phase 2 row as Active. Log the transition in `docs/session-log.md`.
