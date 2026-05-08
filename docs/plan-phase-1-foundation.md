# Plan — Phase 1: Foundation

**Date:** 2026-05-06
**Status:** Active
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
- [ ] All four pages render the bundle's components verbatim — same hex codes, same px values, same fonts, same 220ms `cubic-bezier(.2, .7, .2, 1)` timing (CONSTRAINT-05).
- [ ] No Tailwind utility classes anywhere in `app/` or `components/public/` — verified by grep for `@apply`, `text-`, `w-`, `h-`, `bg-`, `rounded-` (CONSTRAINT-03).
- [ ] Server-side UA detection in `middleware.ts` decides which variant (desktop or mobile components) to render. Single canonical URL per page.
- [ ] All pages have static placeholder content for now — DB wiring in T11.
- [ ] Tweaks panel gated by `NEXT_PUBLIC_TWEAKS=1` env var (not querystring).
- [ ] All four pages have `<title>`, `<meta description>`, and `<link rel="canonical">` set.

**Tests required:**
- `each public page renders without errors` — Playwright snapshot per page (TS-04).
- `mobile UA serves mobile component variant` — middleware test with mobile UA header.
- `desktop UA serves desktop component variant` — middleware test with desktop UA header.

**Depends on:** T2

**Specialist:** `@ui-swarnimbagre`

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
- [ ] All queries use Supabase's query builder with `.eq()` / `.order()` — never string concatenation (SEC-03).
- [ ] No hardcoded Supabase URL or key — all from `process.env.NEXT_PUBLIC_*` (SEC-01, CQ-04).
- [ ] Errors are caught, logged with context (operation, sanitized inputs, stack) (EH-01, EH-02, EH-03), and re-thrown as `ServiceError` (EH-05).
- [ ] User-facing pages render a clean error state if the DB query fails (EH-04). The full error detail goes to the log only.
- [ ] No PII (email, etc.) in logs — only operation and presence flags (SEC-05).
- [ ] All public functions have doc comments stating params, return, throws (DS-01).

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
- [ ] Whitelist is exactly: `p, ul, ol, li, blockquote, code, pre, em, strong, a, h1, h2, h3, h4, img` (CONSTRAINT-06).
- [ ] Allowed attributes: `a[href]` (no `javascript:` protocol), `img[src, alt]`. Everything else stripped (SEC-02).
- [ ] No inline event handlers reach the DOM. DOMPurify default profile is augmented with the whitelist; result is verified by tests.
- [ ] `MarkdownContent` accepts a `className` prop (CQ-06: explicit naming).
- [ ] Public function has a doc comment listing the whitelist (DS-01).
- [ ] No `console.log` or debug artifact (CQ-05).

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

## T13 — Image read layer (Storage URL helpers + components)

**Files:**
- `lib/images.ts` (create)
- `components/public/ProjectImage.tsx` (create)
- `components/public/PostImage.tsx` (create)

**Functions to implement:**
- `getImageUrl(bucketPath: string): string` (≤50 lines, CQ-01) — constructs a public URL via Supabase Storage SDK. No hardcoded URLs (SEC-01, CQ-04).
- `<ProjectImage imageId?: string, alt: string />` (≤200 lines, CQ-02).
- `<PostImage imageId?: string, alt: string />` (≤200 lines, CQ-02).

**Acceptance criteria:**
- [ ] Components render `<img>` with `loading="lazy"`, `alt={alt}` (alt is required by prop type — `alt: string` not `alt?: string`).
- [ ] No image case: components render nothing or a typographic placeholder (no broken-image icon).
- [ ] Image URLs come from the `images` table's `bucket_path` column, resolved via Supabase Storage (CONSTRAINT-07).
- [ ] Errors fetching the image URL are caught and logged with context (EH-01, EH-02). Component degrades to no-image silently (EH-04 client side).

**Tests required:**
- `getImageUrl returns valid URL for a known path` (TS-01 happy).
- `getImageUrl throws when path is empty` (TS-01 error).
- `ProjectImage renders <img> with alt when imageId resolves` (TS-01).
- `ProjectImage renders nothing when imageId is undefined` (TS-01 edge).

**Depends on:** T7, T11

**Specialist:** `@supabase`

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
- [ ] `.env.example` is final for Phase 1: all three Supabase vars listed, no values, no comments containing real secrets (SEC-01).
- [ ] Vercel project environment variables set for production with the same three names. Service role key is server-only.
- [ ] `docs/env-vars.md` documents: each var name, public vs server-only, where to get the value (Supabase dashboard), where to set locally (`.env.local`), where to set in production (Vercel dashboard) (DS-02).
- [ ] Startup check fails loudly with a descriptive error if any var is missing (EH-01, EH-02).
- [ ] `npm run build` succeeds with no warnings (CQ-05).
- [ ] First Vercel production deploy succeeds. The four public pages render at the production URL (placeholder DNS is fine if cutover is deferred).
- [ ] Supabase logs show no errors from the deploy (verify via `@supabase` MCP or dashboard).
- [ ] Auto-Logging entry written to `docs/session-log.md` documenting the Phase 1 close (DS-03).

**Tests required:**
- `assertRequiredEnv throws when var is missing` (TS-01 error).
- `assertRequiredEnv passes when all vars present` (TS-01 happy).
- `production build succeeds` (`npm run build`) — TS-04.
- `public pages render with DB data` — Playwright smoke against the deploy.

**Depends on:** T9, T12, T13

**Specialist:** `@cto`, `@supabase`

---

## Phase 1 Exit Criteria

- All 14 tasks complete; their tests passing.
- Public site live on Vercel with DB-backed content from Supabase.
- `/admin/*` routes exist as auth-gated placeholders (full admin UI is Phase 2).
- No SaaS phrases, no emoji in any committed copy (CONSTRAINT-13).
- No secrets committed; `.gitignore` enforces SEC-07.
- Mark Phase 1 row as Done in [`plan-index.md`](plan-index.md). Mark Phase 2 row as Active. Log the transition in `docs/session-log.md`.
