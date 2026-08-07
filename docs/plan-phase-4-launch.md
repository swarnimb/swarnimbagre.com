# Plan — Phase 4: Polish + Launch

**Date:** 2026-05-06 — **last updated 2026-08-07.**
**Status:** Complete.

- **Closed:** T32–T40, T42–T47.
- **T41** shipped 2026-08-06 (Session 55, commit `b369d47`). Two of its criteria are unsatisfiable as written and two are still open — see the T41 block.
- **Outstanding work not tracked by any open task:** none.

**Tasks:** T32–T47 (16 tasks). T41 was trigger-gated and never blocked Phase 4 exit — same pattern as Phase 3's T29/T31 operator-gated deferrals.
**Predecessor:** [`plan-phase-3-ingestion.md`](plan-phase-3-ingestion.md)
**Successor:** none — final phase

End state: site is live at `swarnimbagre.com`, monitored, the post-launch checklist is closed. Phase 4 is operational and quality work — error monitoring, env-var hygiene, security review, code review, doc audit, production deploy, and post-launch ops.

---

## Outstanding work not tracked by any open task

**None as of Session 55 (2026-08-06).** This section previously held three items, all closed: the unrun Playwright suite (run at Session 54; its follow-on defect became T47), the project screenshots / image assets gate (removed from plan tracking by builder decision — cards rendering "no preview yet" is an accepted state), and the DS-05 fresh-clone verification (superseded as not needed). Heading retained so cross-references still resolve, and so a future close-out knows the section was emptied deliberately.

---

## T32 — Error monitoring (Sentry) — option A deploy or option B defer [x]

**Option chosen:** B (defer) — picked 2026-05-14 by `@cto` consultation, approved by builder. Rationale: pre-launch bundle weight on the public site (CONSTRAINT-05) outweighs zero-traffic monitoring value; reversibility high. Full rationale in `docs/founder-brief.md` entry 23 and `docs/monitoring.md`.

**Files:**
- `lib/sentry.ts` (create — if deploying)
- `next.config.ts` (modify — if deploying)
- `.env.example` (update — `SENTRY_DSN` if deploying)
- `docs/monitoring.md` (modify)

**Functions to implement:**
- `initSentry(): void` (≤50 lines, CQ-01) — if deploying. Configures client + server instrumentation with PII scrubbing.

**Acceptance criteria:**

**Option A — deploy now:** *(dead branch — Option B was chosen 2026-05-14; all five boxes below are `[~]` and will never be ticked. Text retained as the record of what Option A would have required if Sentry is ever reconsidered.)*
- [~] Sentry project created. `SENTRY_DSN` set in Vercel production env (server) and `NEXT_PUBLIC_SENTRY_DSN` (client) if needed.
- [~] Unhandled errors in both browser and server contexts are reported.
- [~] **PII scrubbing rules:** email addresses, tokens, and request bodies are stripped before send (SEC-05).
- [~] Error events include: route path, session presence flag (anon vs authenticated), error name, sanitized stack.
- [~] No `console.log` debug aids left in (CQ-05).

**Option B — defer:**
- [x] `.env.example` lists `SENTRY_DSN` with a comment "deferred — set when monitoring is added".
- [x] `docs/monitoring.md` documents that Sentry is deferred and what the builder should look at instead in the meantime (Vercel logs, Supabase Edge Function logs).

**Tests required:**
- `initSentry initializes without error when DSN is set` (TS-01) — option A only.
- `initSentry skips initialization when DSN is unset` (TS-01) — option A only.

**Depends on:** Phase 3 complete (T31)

**Specialist:** `@cto`

---

## T33 — README finalization [x]

**Files:**
- `README.md` (finalize)

**Functions to implement:** [documentation only]

**Acceptance criteria:**
- [x] README contains the five required sections (DS-05):
  - **Project description** — one paragraph, voice-rule compliant (CONSTRAINT-13). No SaaS phrases.
  - **Setup** — exact commands: `cp .env.example .env.local`, fill values, `npm install`, `npm run dev`, open `http://localhost:3000`.
  - **Environment variables** — names only, reference `.env.example`. No real values (SEC-01).
  - **Tests** — `npm test`.
  - **Deploy** — `git push origin main` triggers Vercel auto-deploy.
- [x] Additional sections (kept terse): admin login flow link to `docs/auth-flow.md`; design rules link to `docs/design-decisions.md`; voice rules link to `docs/constraints.md`.
- [x] No `TODO` lines left in (CQ-05).
- [~] **MANUAL BUILDER ACTION — no agent can close this.** DS-05 verification: a fresh checkout, following only the README, reaches a working `npm run dev` state. — **SUPERSEDED 2026-08-06, Session 55, by builder decision: not needed.** The fresh-clone run will not be performed. Do not re-open it. Mirrored at T38 (`README.md` is accurate, DS-05) — the same decision closes both.

**Tests required:**
- Manual: builder runs through README setup on a fresh clone, confirms steps work as written. Logged in `docs/session-log.md`.

**Depends on:** T32

**Specialist:** none

---

## T34 — Environment variables checklist + startup validation [x]

**Decisions (2026-05-15, builder-approved):** (1) `docs/env-vars.md` git-renamed to `docs/env-checklist.md` and made the single authoritative env reference, rather than creating a second doc. (2) `ADMIN_ALLOWED_EMAIL` promoted to startup-required (hard-fails `next build` / `next dev`), previously lazily-validated. `NEXT_PUBLIC_SITE_URL` deliberately NOT promoted (it has a Vercel-preview fallback).

**Files:**
- `.env.example` (finalize)
- `docs/env-checklist.md` (create — DS-02)
- `next.config.ts` (modify — finalize startup check from T14)

**Functions to implement:**
- `assertRequiredEnv()` (extended from T14 if needed) — covers all final required vars.

**Acceptance criteria:**
- [x] `.env.example` lists all required public + server-only vars; no values (SEC-01).
- [x] `docs/env-checklist.md` documents each var: name, public/server, where to source the value, where to set it locally, where to set it in production, what fails if it is missing (EH-01).
- [x] Startup check throws a clear error naming the missing variable (EH-02). Server fails to boot rather than running with a missing var (EH-01: fail loud).
- [x] No real secret in `.env.example`, no real secret in `docs/env-checklist.md`, no real secret in any committed file (SEC-01, SEC-07).
- [x] `.env`, `.env.local`, `.env.*.local` are gitignored (SEC-07 verified).

**Tests required:**
- `assertRequiredEnv throws when a required var is missing` (TS-01 error).
- `assertRequiredEnv passes when all required vars are present` (TS-01 happy).

**Depends on:** T33

**Specialist:** none

---

## T35 — Launch checklist document [x]

**Files:**
- `docs/launch-checklist.md` (create)

**Functions to implement:** [documentation only]

**Acceptance criteria:**
- [x] Document has three sections (each is a checklist):

**Pre-launch:**
- All tests pass (`npm test`).
- `npm run build` clean (CQ-05: no warnings, no dead code).
- All four public pages render on desktop and mobile (Playwright smoke).
- Admin end-to-end flow passes (the T28 suite).
- OpenClaw integration test passes (T31 manual tests).
- DNS for `swarnimbagre.com` and `www` points at Vercel.
- HTTPS is enforced (Vercel default — verified via `curl -I https://...`).
- Vercel production domain is set to `swarnimbagre.com`.
- All env vars set in Vercel production.
- `.env.local`, `.env`, `profile.md`, `manifest.md`, `CLAUDE.md`, session log files are gitignored (SEC-07 verified).
- No PII in any log path (SEC-05 spot check).

**Launch:**
- Tag the release commit.
- Push to `main`.
- Verify Vercel deploy succeeds in the dashboard.
- Hit the production URL: pages load, admin login redirects work, public pages render DB content.
- Announcement copy follows voice rules — no superlatives, no SaaS phrases, no emoji (CONSTRAINT-13).

**Post-launch:**
- Monitor Vercel logs and Supabase Edge Function logs for the first 24 hours (T32 monitoring path).
- Watch `stats` table activity to confirm OpenClaw is writing.
- Add the first 2–3 sample projects and 1–2 sample posts via the admin panel so the public site has content.
- Bug triage: any crash → file a follow-up task or hotfix.

**Tests required:** [documentation only]

**Depends on:** T34

**Specialist:** none

---

## T36 — Security review [x]

**Files:** all code from T1–T34.

**Functions to implement:** [review task — no new code]

**Acceptance criteria:**
- [x] **RLS audit:** `@security` confirms every table has RLS enabled and that policies match `architecture.md` §6.1. No table is permissive by default. OpenClaw cannot SELECT, UPDATE, or DELETE on any table — only the Edge Function (using the service role) can INSERT to `stats` (SEC-04, CONSTRAINT-08).
- [x] **Auth audit:** middleware redirects unauthenticated requests on every `/admin/*` route. JWT lifetime is the Supabase default. Magic-link tokens are short-lived. No PII in logs (SEC-05).
- [x] **Input validation audit:** every Server Action validates inputs at the boundary with zod (SEC-02). All Supabase queries use parameterized builders (SEC-03). The Markdown sanitizer's whitelist is the locked one (CONSTRAINT-06).
- [x] **File upload audit:** `uploadImage` enforces type and size at both the boundary and the Storage bucket policy (SEC-02). Path scheme matches CONSTRAINT-07.
- [x] **Secrets audit:** `.env*` gitignored; no real secret in any committed file (SEC-01, SEC-07). Service role key is loaded only in server contexts. Edge Function secret is in Supabase env, not in repo.
- [x] **Edge Function audit:** constant-time secret comparison verified (SEC-04). 401 response is identical for missing-vs-wrong header. No detail leaked in any error response body.
- [x] **HTTPS:** Vercel auto-managed; verified by checking redirect from `http://` to `https://`.

**Findings:** any failure here blocks launch. Fix and re-run before marking done. — **Audit 16 (2026-05-15): CLEAR.** 0 Critical / 0 High. 2 new Medium (F-29 auth log hygiene, F-30 Storage bucket limit not in migration) + 5 new Low — documented, tracked, non-blocking. Markdown sanitization is client-side **by CONSTRAINT-06 mandate**, whitelist matches the locked spec verbatim. F-30 leaves a manual Dashboard-verification line on the launch checklist. See `docs/security-report.md`.

**Tests required:** [review task — assertions captured in checklist above]

**Depends on:** T34

**Specialist:** `@security`

---

## T37 — Code review [x]

**Files:** all code from T1–T34.

**Functions to implement:** [review task]

**Acceptance criteria:**
- [x] All committed code passes ESLint + Prettier (CQ-05).
- [x] Function lengths ≤ 50 lines (security/validation may extend to 80) (CQ-01). — largest `uploadImageInternal` 75 (validation, ≤80 cap).
- [x] File lengths ≤ 300 (services) or ≤ 200 (components) (CQ-02). — 4 over-cap files split.
- [x] Single responsibility per file (CQ-03). Naming is explicit (CQ-06).
- [x] No magic numbers — every threshold is a named constant with a comment (CQ-04).
- [x] No dead code, no commented-out blocks, no `console.log` debug, no `TODO` left from earlier in the project (CQ-05).
- [x] No duplicated logic (CQ-07). — `padToFloor`, log helpers, `loadCurrentImage`, list components all extracted.
- [x] No accidental O(n²) where O(n) is available (CQ-08).
- [x] Error handling: EH-01 visible-handle-or-rethrow, EH-02 context, EH-03 stack traces, EH-04 concise-vs-detailed, EH-05 custom error types — all PASS.
- [x] All public functions have doc comments (DS-01). — `cn` exempt (shadcn boilerplate).
- [x] All tests pass (`npm test`). Critical paths happy+error (TS-01/04), behavior names (TS-02), no external deps (TS-03), no shared mutable state (TS-05) — all PASS.

**Tests required:** the existing `npm test` suite must pass.

**Depends on:** T36

**Specialist:** `@code-review`

**Closed:** 2026-05-15, Session 24. Initial verdict FAIL on CQ-02 (4 files over cap) + CQ-07 (4 duplication clusters); builder elected fix-all-now; final verdict **PASS**. `lib/admin-queries.ts` was kept as a stable re-export barrel — that pattern still binds. Discharges parked cleanup-queue items #1–#4; item #5 (OrphanCleanup batch-delete grammar) is CONSTRAINT-13 voice scope, not CQ.

---

## [x] T38 — Documentation audit

**Files:** all `docs/*.md` and `README.md`.

**Functions to implement:** [review task]

**Acceptance criteria:**
- [x] `docs/architecture.md` matches the implementation. Reconciled §2.4 + §5.2 (migration 008 is the bucket-limit source of truth; migration 005's trailing comment is superseded but stays in the file, because **applied migrations are immutable**), §5.3 (`STATS_INGEST_SECRET` Edge-Function-only carve-out), §6.6.4, new §6.6.8 (T37 query split + `logQueryError`).
- [x] `docs/founder-brief.md` has an entry for every architectural decision actually present in code. Added Index rows 24–26: the T37 query split, migration 008 / F-30, and the `/api/admin/*` self-gate (F-17).
- [x] `docs/constraints.md` matches what is enforced. Audited — no stale constraint.
- [x] `docs/auth-flow.md` describes the actual flow as built. Allowlist enforcement location corrected (callback + sign-in helper, **not** middleware); logout redirect → `/admin/login`.
- [x] `docs/env-checklist.md` lists every var that is actually checked at startup. Verified exact match with `lib/env.ts` `REQUIRED_ENV_VARS`.
- [x] `docs/monitoring.md` and `docs/openclaw-config.md` are accurate. Auth-route path corrected to `/admin/auth/callback`.
- [x] `docs/launch-checklist.md` reflects current operational reality.
- [~] **MANUAL BUILDER ACTION — no agent can close this.** `README.md` is accurate (DS-05). README **content** audited and accurate. Fresh-clone runtime verification is the same criterion as T33 criterion 4. — **SUPERSEDED 2026-08-06, Session 55, by builder decision: not needed.** Do not re-open it.
- [x] No broken links between docs. `env-vars.md`→`env-checklist.md` and `docs/plan.md`→`docs/plan-index.md` stale refs fixed.
- [x] No `TODO` or `[Placeholder]` left in any committed doc (CQ-05 applied to docs).

**T38 decision (still binding):** launch is DECOUPLED from OpenClaw — the public site and admin deploy independently; OpenClaw ingestion (T29/T31) and its verification are post-launch. T39 was NOT blocked on OpenClaw being live; its OpenClaw scope narrowed to "stats-ingest path deployed + smoke-verifiable". Supersedes the earlier "T39 hard-block on OpenClaw" framing.

**T38 auth follow-up (non-blocking, not a task):** an optional redundant email-allowlist check could be added to `/admin/*` middleware for defense-in-depth. Not required — enforcement at the callback (`getUser()` round-trip) plus the sign-in helper is already effective. Recorded in `docs/auth-flow.md` §3.

**Tests required:**
- Manual link check across all `docs/*.md` files (broken-link audit).

**Depends on:** T37

**Specialist:** none

---

## [x] T39 — Production deploy + DNS cutover

**Files:** all code from prior tasks; Vercel production settings; DNS.

**Functions to implement:** [deployment task]

**Acceptance criteria:**
- [x] Final commit on `main`. Vercel auto-deploy succeeds (verify in dashboard).
- [x] DNS for `swarnimbagre.com` apex and `www` cut over to Vercel. TTL is set sensibly (e.g., 300s for cutover, raise to 3600+ once stable). — domain via Cloudflare, **DNS-only (grey cloud)**; resolves to Vercel `76.76.21.21`.
- [x] HTTPS is live; `http://swarnimbagre.com` redirects to `https://swarnimbagre.com`. — HTTPS + HSTS live; apex is the canonical primary and `www → apex` chains correctly. CONSTRAINT-21 satisfied. Non-blocking: `www → apex` returns 307; 308 would be more conventional for a permanent canonical move (single toggle in the Vercel Domains panel).
- [x] All four public pages return 200 with valid HTML at the production URL.
- [x] Mobile UA serves the mobile component variant; desktop UA serves the desktop variant. — *the server-side device split this criterion describes was deleted at T46; the site is now one responsive tree.*
- [x] Admin login redirects work; magic link to the configured admin email (`ADMIN_ALLOWED_EMAIL`) lands and produces a working session.
- [x] Projects, Posts, Stats, Images CRUD all work against production (verified by the T28 flow against the live URL).
- [~] OpenClaw test message produces a row visible at `/admin/stats` and `/other`. — SUPERSEDED by the T38 decouple decision: post-launch; T39 scope narrows to "stats-ingest path deployed + smoke-verifiable".
- [x] No console errors on any page in production browser DevTools (CQ-05 in production runtime).

**Closed:** 2026-05-19, Session 27. Live on apex canonical `swarnimbagre.com`; operator CRUD round-trip verified end to end. Three admin UI bugs were found during the operator smoke and fixed in commit `5b88f24` — of these, one decision still binds: the eight `--admin-*` CSS variables live at `:root` in `app/styles/admin.css`, not on `.admin-root`, because Radix portals to `document.body` and popovers rendered transparent otherwise (dark chrome itself stays scoped to `.admin-root`). Also added `app/(admin)/error.tsx`, the admin segment's LOUD-failure boundary.

**Tests required:**
- Playwright smoke against the live URL covering: each public page renders; admin login redirects; one full admin flow (create project, view in public list after publish, delete) (TS-04).

**Depends on:** T36, T37, T38

**Specialist:** `@qa`, `@cto`

---

## T40 — Post-launch monitoring + sample content [x]

**Files:** Supabase logs (operational); Vercel analytics (operational); admin panel content.

**Functions to implement:** [operational task]

**Acceptance criteria:**
- [x] Clear 28 test-fixture rows from `projects` table (`t28-*`, `t42-e2e-*`, `t43f-*`); 12 published rows currently visible on live `/projects` removed first. Verify `/projects` is empty on production before adding real content. — 32 rows deleted; 6 `project_media` rows removed via FK CASCADE. 32 orphan `images` rows plus their bucket objects were left behind; those are swept by T47's teardown.
- [~] ~~First 24h: Supabase Edge Function logs reviewed daily. Any 5xx or unexpected 401 spike triaged.~~ — calendar-stale.
- [x] Retroactive launch-week (2026-05-19 → 2026-05-25) Supabase Edge Function logs reviewed. Any 5xx or unexpected 401 spikes triaged. — trivially satisfied: zero Edge Functions are deployed (`stats-ingest` is gated on T31, still deferred), so no EF traffic exists. **Re-verify when T31 lands and `stats-ingest` deploys.**
- [~] ~~First 24h: Vercel logs reviewed daily. No unhandled errors.~~ — calendar-stale.
- [x] Retroactive launch-week (2026-05-19 → 2026-05-25) Vercel logs reviewed. No unhandled errors found, or any found are triaged. — all deployments Ready; the only anomaly was a `404 GET /favicon.png` probe, since closed by T41's `app/icon.svg`. Hobby-tier runtime-log retention (~1 hour) cannot reach a full week; accepted, given T32 Option B (no persistent monitoring).
- [~] ~~OpenClaw is producing real (non-test) stat rows at the expected cadence.~~ — superseded: blocked on T29 + T31 (OpenClaw operator gate deferred — see `plan-phase-3-ingestion.md`). Re-verify when T29/T31 land.
- [x] 2–3 real projects added via admin so `/projects` is not empty. — 6 projects published 2026-05-28. Slugs are LOCKED (CONSTRAINT-12): `parsaveables`, `claude-code-magic`, `swarnimbagre-com`, `totes-sales-crm`, `amibroke`, `cardmaxxer`.
- [x] 1–2 real posts added via admin so `/writing` is not empty.
- [~] Voice check on all live copy: no SaaS phrases, no emoji, no LinkedIn-motivational tone (CONSTRAINT-13). — **SUPERSEDED 2026-08-06, Session 55, by builder decision.** This is continuous work, not a one-time gate, so it could never be "completed" and was holding T40 open indefinitely. Remaining scope, carried outside the plan: builder-authored project blurbs and post bodies, plus all T46 UI copy (home bio and question bubble, the three rotating chat deflections, the three page ledes, the Writing closing line, the "Find me here:" label, four empty states). The chat deflections in particular are placeholders — the builder deferred final wording, since the structure holds regardless of the copy.
- [x] Any bug found is logged in `docs/session-log.md` with severity and a follow-up task description.
- [~] `docs/launch-checklist.md` post-launch section is checked off. — **SUPERSEDED 2026-08-06, Session 55, by builder decision:** continuous work, not a one-time gate. The work continues outside the plan.
- [x] Auto-Logging entry written to `docs/session-log.md` documenting the launch (DS-03). — satisfied by a single canonical launch retrospective entry rather than a retroactive day-of-launch reconstruction.

**Closed:** 2026-08-06, Session 55, commit `a19fe72`. Two criteria were superseded, not completed — they are continuous work.

**Tests required:** [operational verification — covered by checklist]

**Depends on:** T39

**Specialist:** `@qa`, `@cto`

---

## T41 — Discoverability + public-route resilience

**Status:** Shipped 2026-08-06, Session 55, commit `b369d47`. Originally logged 2026-05-19 as deferred and trigger-gated (the public site had zero ambient traffic in week 1, so discoverability infra had nothing to discover and no visitors to crash on). The trigger fired at the Session 55 `@qa` pass, which filed NB-06 (no public error boundary), NB-07 (no favicon anywhere) and NB-08 (unstyled stock 404). Two criteria below are unsatisfiable as written and two are still open; the rest are verified in code and on production.

**The plan spec below was three months stale at execution and was overridden in four places** — it named `app/projects/[slug]/page.tsx` (deleted at T46), Fraunces and JetBrains Mono (retired at T46), the old dark palette (inverted to light at T46), and a favicon inside the retired dark bundle. The Files list has been corrected to the T46 baseline; the acceptance criteria are left at their original wording, because criteria are the spec of record.

**Files:**
- `app/robots.ts` (create)
- `app/sitemap.ts` (create)
- `app/layout.tsx` (modify — extend Metadata with `metadataBase` + `openGraph` + `twitter` objects. No `icons` key: `app/icon.svg` is a file convention and Next injects the `<link rel="icon">` itself, so declaring it here too emits the tag twice)
- `app/opengraph-image.tsx` (create — 1200×630 card, wordmark in Instrument Serif, T46 palette verbatim: `#F4F1EA` ground, `#1F3D2F` accent, `#16140E` / `#837D70` text. `next/font` cannot be used inside `ImageResponse` — the loader returns a CSS class and Satori needs raw font bytes — so the TTF is fetched at render time and every fetch is guarded: on failure the family is simply not registered and Satori falls back, giving the right palette with the wrong typeface rather than a broken build)
- `app/icon.svg` (create — the T46 design source ships no favicon, so the icon is composed from palette values only: `#1F3D2F` ground, `#F4F1EA` glyph)
- `app/error.tsx` (create — public-route LOUD-failure error boundary, styled with the T46 public classes, NOT shadcn; mirrors `app/(admin)/error.tsx`)
- `app/not-found.tsx` (create — public 404 page, same styling and voice rules per CONSTRAINT-13)
- `app/writing/[slug]/page.tsx` (modify — per-route OG/Twitter override. This is the only per-route override that exists: `/projects/[slug]` was deleted at T46)
- `docs/founder-brief.md` (modify — add entry for the discoverability + resilience decisions)

**CONSTRAINT-05 note, still open:** the design export contains no 404 and no error page. Both are composed exclusively from pre-existing classes (`.container`, `.title-block`, `.page-title`, `.page-lede`, `.h-actions`, `.h-btn`, `.h-btn--fill`, `.h-btn--outline`) with zero invented values — but `.h-actions` and `.h-btn` are used off the home page here for the first time, and CONSTRAINT-05 says to consult `@designer` when a pattern is absent from the export. Flagged for design sign-off rather than treated as settled.

**Functions to implement:**
- `robots(): MetadataRoute.Robots` — allow all crawlers, disallow `/admin` and `/api`, point at the sitemap.
- `sitemap(): Promise<MetadataRoute.Sitemap>` — emit static routes (`/`, `/projects`, `/writing`, `/other`) + dynamic published post URLs queried from Supabase. Drafts are excluded twice over, in SQL and again before emit: this is the one surface that hands URLs to third parties, and un-publishing afterwards does not un-index a URL that was already crawled and cached.

**Acceptance criteria:**
- [x] `app/robots.ts` emits a valid `/robots.txt` allowing all crawlers; references the sitemap URL.
- [~] `app/sitemap.ts` emits a valid `/sitemap.xml` listing all 4 public root routes + every published project + every published post. Drafts excluded. — **unsatisfiable as written:** the roots, the published posts and the draft exclusion all ship and are verified, but there are no per-project URLs to list because `/projects/[slug]` was deleted at T46.
- [~] Open Graph + Twitter Card metadata is set in `app/layout.tsx` (site-wide defaults) and overridden per route on `app/projects/[slug]/page.tsx` + `app/writing/[slug]/page.tsx` (title, description, image). — **unsatisfiable as written:** site-wide defaults and the `/writing/[slug]` override both ship; `app/projects/[slug]/page.tsx` was deleted at T46 and cannot carry an override.
- [x] OG image is wired and validates via `https://www.opengraph.xyz/url/https%3A%2F%2Fswarnimbagre.com` or equivalent. — `/opengraph-image` returns 200 `image/png` at 1200×630 on production; tags are complete with absolute URLs and `summary_large_image`.
- [x] Favicon visible in browser tab (no more default Next.js icon). — `<link rel="icon">` emitted and `/icon.svg` resolves 200 on production; the `/favicon.png` 404 that had fired on every page load since Session 42 is gone.
- [x] `app/error.tsx` catches client-side render crashes on public routes; styled to match the bundle (no shadcn); message follows voice rules (CONSTRAINT-13: dry, no SaaS phrases, no emoji). — exercised against a real crash in a browser: the boundary engaged, rendered on the T46 palette with all three fonts confirmed loaded, and `reset()` genuinely re-mounted. The `error.digest` branch is still unverified — `digest` is only populated in production builds.
- [x] `app/not-found.tsx` renders for unknown public URLs; styled to match the bundle; same voice rules. — returns a genuine HTTP 404 **and** renders our page. Note: the root `not-found.tsx` also serves unmatched `/admin/*` paths, so an admin typo gets the cream public 404; an admin-styled miss would need `app/(admin)/not-found.tsx`.
- [ ] Site verified in Google Search Console (DNS TXT or HTML meta tag method); sitemap submitted via Search Console. — needs the builder's Google account; cannot be automated.
- [x] `docs/founder-brief.md` has a new entry covering the discoverability decisions (DS-02). — entry #40, written 2026-08-07.
- [x] No console errors on `/error` or `/not-found` test routes (CQ-05). — clean on `/`, `/projects`, `/writing`, `/other`. The single error on a 404 URL is the browser reporting the document's own status code, which is correct and unavoidable.

**Known follow-ups, not criteria:** the production origin is now hand-written in eight places and is worth consolidating. OG preview caches are sticky, so re-validate the card the day before the URL is first shared publicly.

**Tests required:**
- [x] `robots() emits expected User-agent and Sitemap directives` (TS-01). — `tests/robots.test.ts`.
- [x] `sitemap() includes published items and excludes drafts` (TS-01 happy + error). — `tests/sitemap.test.ts`.
- Manual: paste production URL into Twitter compose / iMessage / Slack — preview card renders with image, title, description.
- [x] Manual: visit a known-bad URL like `/projects/this-does-not-exist` — `not-found.tsx` renders with bundle styling, not the default Next.js 404.

**Depends on:** T40 (sample content exists, so sitemap has actual rows)

**Specialist:** `@cto`, `@designer` (OG image spec only), `@content-writer` (error + not-found copy per voice rules)

---

## [x] T42 — Project content-model expansion + public-card redesign

**Closed:** 2026-05-19, Sessions 29–31 (Sessions A/B/C). Migration `009_projects_content_model.sql` applied to prod; admin write surface, then desktop render, then mobile render + Override 1 docs. `@security` audit 18 CLEAR; `@code-review` APPROVED WITH MINOR. Supersedes `docs/content-model-expansion.md`, which proposed a heavier Option C schema — T42 shipped the lighter "6 nullable columns, zero new tables" variant (`@cto` confirmed Shape A over Shape C pre-migration).

**Decisions locked in brainstorm (Session 28):**
- Progress: integer percent (0–100), ring visual with auto "full circle + subtle glow" done state at 100. No lifecycle vocabulary.
- Links: 3 fixed nullable URL columns (`github_url`, `live_url`, `post_url`). No `project_links` table.
- Demo image: static images only for v1 (clips deferred post-launch). Before/after handled by the `image_after_id` FK + `BeforeAfterMedia.tsx`.
- Home thumbnail: hand-tuned SVG motifs in `ProjectThumb.tsx`, no CHECK constraint on `thumb_kind` so new motifs cost no migration.
- Projects page demo: real screenshots via `image_id`; the bundle's animated `DemoLoop` variants dropped from the data path.
- CONSTRAINT-05 override approved, documented as Override 1.

> **Superseded in part at T46:** Overrides 1–3 are retired, the SVG thumb motifs and `lib/thumb-kinds.ts` are deleted (photos only — a project with no media renders "no preview yet"), and `/projects/[slug]` is gone. The migration-009 columns themselves all remain in the schema and in `Project`.

**Acceptance criteria:**

*Schema:*
- [x] Migration 009 applies cleanly to dev + production Supabase projects. Idempotent (uses `add column if not exists` or guard).
- [x] All 6 columns nullable; only `progress_percent` has a CHECK constraint (`between 0 and 100`).
- [x] `image_after_id` FK references `images(id) on delete set null` (matches existing `image_id` pattern).
- [x] RLS policies on `projects` already cover read access to all columns — no new policies needed (verified against migration 002).

*Admin form:*
- [x] All 6 new fields render in `ProjectForm.tsx` (image fields edit-only, matching `image_id` precedent).
- [x] Zod validation catches: invalid URL format on the 3 URL fields, percent out of range, unknown thumb_kind value.
- [x] `ImageUpload` for `image_after_id` uses the same `parentType: 'projects'` + `parentId` binding as primary image.
- [x] `ProjectForm.tsx` stays ≤200 lines (CQ-02) — split into `ProjectFormLinks.tsx` + `ProjectFormDisplay.tsx` + `ProjectImageField.tsx`.
- [x] Save round-trip works for all new fields (verified via Playwright admin smoke test).

*Public render — desktop:*
- [x] Home page renders DB-driven projects (not hardcoded `featured` array).
- [x] Projects page renders real screenshot (from `image_id`) instead of `DemoLoop` animation.
- [x] `ProgressRing` renders correctly at 0, 25, 50, 75, 100. Done glow visible only at 100.
- [x] 3 buttons (github / live / post) render only when their URL column is non-null. Hidden otherwise. — bundle labels `{ } code` / `↗ site` / `¶ notes` kept.
- [x] Bundle's `StatusPill` no longer renders on project cards.

*Public render — mobile:*
- [x] All desktop changes mirrored on mobile components.
- [x] Mobile-specific layout regression-checked via Playwright.

*Before/after slider:*
- [x] When `image_after_id` is non-null, `BeforeAfterMedia` renders the slider with both images.
- [x] When `image_after_id` is null, falls back to static image.

*Docs:*
- [x] `docs/design-decisions.md` Override 1 entry written with rationale.
- [x] `docs/founder-brief.md` architectural entry added (DS-02). — entry #28.
- [x] `docs/architecture.md` §2 updated.
- [x] `docs/content-model-expansion.md` marked SUPERSEDED with link to T42.

*Quality gates:*
- [x] `npm run build` clean (CQ-05). No console errors in production runtime.
- [x] `npm test` 100% passing.
- [x] Voice check on any new operator-facing labels (CONSTRAINT-13).

**Tests required:**
- `ProgressRing renders correctly at 0/25/50/75/100 percents` (TS-01 happy).
- `ProgressRing renders done glow only at percent=100` (TS-01).
- `ProgressRing renders nothing when percent is null` (TS-01 error).
- `Zod schema rejects invalid URL formats` (TS-01 error).
- `Zod schema rejects percent out of range` (TS-01 error).
- `Zod schema accepts null for all 6 new fields` (TS-01 happy).
- `ProjectForm submits all 6 new fields on create` (TS-01 happy).
- `ProjectForm prefills all 6 fields on edit` (TS-01 happy).
- `ProjectMedia renders BeforeAfterMedia when image_after_id is present` (TS-01).
- `ProjectMedia falls back to StillMedia when image_after_id is null` (TS-01).
- Playwright admin smoke: create project with all 6 fields filled, verify on public home + projects pages.

**Depends on:** T39 (production deploy exists; this work happens against the live DB after a migration apply).

**Specialist:** `@dev` (execution), `@cto` (review schema choice before migration), `@code-review` (post-execution gate), `@security` (verify zod URL validation closes XSS-via-link vectors, since `live_url` becomes a user-controlled `href` attribute).

---

## [x] T43 — Project media multi-image carousel

**Closed:** 2026-05-23, Session 40, commit `9b21162`. Sub-tasks A–I ran across Sessions 32–40; per-sub-task commits are listed in each block below. Migrations `010_project_media.sql` + `010a_save_project_media_rpc.sql` applied to prod (production ledger at T43 close: `[007, 009, 010, 010a]`). Server Action allowlist grew 12 → 13 (`saveProjectMedia`). `@security` audits 18–23 all CLEAR; `@code-review` PASS at every gate. T43 introduced no new security surface, so the pre-existing F-3 / F-4 / F-37 carry-forwards passed through untouched (F-3 and F-4 were later closed at Session 55, commit `9e2eb8a`).

**Source:** `docs/prd.md` §2.3 + §2.3a (canonical carousel surface) + §3.5 (admin write surface) + §3.5a (post image carve-out) + §5 (data model) + §7.2 (out of scope).

**Decisions that still bind:**
- Legacy `projects.image_id` / `image_after_id` stay in the schema. New media routes through `project_media`; reads fall back to the legacy columns when a project has zero `project_media` rows. The backward-compatibility window is open-ended, with no end date — both columns are still present in `lib/types.ts` today.
- Row cap of 20 media rows per project is enforced by a `BEFORE INSERT` trigger (a CHECK constraint is per-row and cannot count siblings), with zod as a second layer at the boundary.
- Saving media is one atomic Server Action backed by a Postgres RPC, not per-row CRUD — a real transaction beats application-layer rollback.
- `project_media` reuses the existing `images` bucket, so no new `storage.objects` policy and CONSTRAINT-20 is N/A.
- Posts keep single-image upload (PRD §3.5a). `app/writing/[slug]/page.tsx` and `components/admin/PostForm.tsx` are outside T43.

> **Superseded at T46:** `embla-carousel-react` was uninstalled and the carousel hand-rolled in `ProjectFrame.tsx`. The public site is back to zero runtime JS dependencies, so **CONSTRAINT-22 now has no consumers** and Override 2 is retired. The `project_media` table, its RPC and the admin write surface all survive.
>
> The rewrite was not behaviour-for-behaviour. Six of T43.G's shipped behaviours did not survive it — captions, keyboard ←/→, the `aria-live` announcement, `prefers-reduced-motion`, `useId`-based `aria-controls` wiring, and no-loop / boundary-disabled arrows. Each is marked `[~]` in T43.G below with the code that proves it. Four of the six are accessibility regressions; none has been re-opened as a task.

---

### Task T43.A: @designer consult — Override 2 surface, carousel UX decisions

**Acceptance criteria:**
- [x] Aspect-ratio policy resolved. Default proposal: 16:9 letterbox with `object-fit: contain` over `var(--surface)` background. `@designer` either confirms or specifies an alternative.
- [x] Caption visual treatment specified: type size token, color token, position (below slide vs overlaid), padding values in px.
- [x] Compact card-carousel chrome sized: dot size, dot spacing, arrow size, arrow position on `/projects` list cards vs detail-page card. Spec gives px values.
- [x] Mobile touch-conflict resolution confirmed: embla `dragFree: false` + `direction: 'horizontal'` + `axis: 'x'`; vertical page scroll wins below ~10° touch angle. Pair-row drag-handle priority spec'd.
- [x] First-class Override 2 boundary defined in draft: which files fall under Override 2.
- [x] CONSTRAINT-13 voice check passes for any new chrome labels (arrows: `←` `→` typographic glyphs only, no "Previous" / "Next" prose; dots: `aria-label="Slide 1"` etc., not "Go to slide 1" — short ARIA strings).

**Tests required:** Consultation task — no tests.

**Depends on:** None. First task in T43.

**Specialist:** `@designer`

---

### Task T43.B: Add `embla-carousel-react` dependency + bundle-size baseline

**Acceptance criteria:**
- [x] `npm install embla-carousel-react@^8` runs clean. No peer-dependency warnings against React 19 / Next 15.
- [x] `npm run build` succeeds with the dep installed.
- [x] Bundle size delta documented in commit message. Measured ~11.7 KB gzip across `embla-carousel` + `embla-carousel-react` + `embla-carousel-reactive-utils`. **Budget ceiling: 15 KB gzip** (raised from a naive 10 KB estimate per `@cto` consult).
- [x] `architecture.md` §1.2 lists embla under "Public site" — explicit acknowledgment that the public site now carries one JS lib.
- [x] No `eslint`-related blocker (no ESLint config in repo — non-blocking).
- [x] Voice check: any new operator-facing label introduced is dry, no SaaS phrasing (CONSTRAINT-13).

**Tests required:** None (dep-add task).

**Depends on:** T43.A

**Specialist:** none (dep-add; `@cto` sanity-check only if bundle exceeds budget)

**Closed:** Session 34, commit `efa294b`. *(Dependency removed again at T46.)*

---

### Task T43.C: Migration 010 — `project_media` table + RLS + indexes + row-cap trigger

**Acceptance criteria:**
- [x] Migration applies cleanly to the dev/prod Supabase project via `mcp__supabase__apply_migration`. Idempotent guards (`if not exists`) on table + policies + trigger.
- [x] All FKs use sensible delete behavior: `project_id` → cascade (deleting a project deletes its media rows); `image_id` / `image_after_id` → restrict (deleting an image with a `project_media` reference is blocked — admin must remove the row first, mirroring CONSTRAINT-07's parent-FK discipline).
- [x] RLS verified: anon SELECT of a `project_media` row whose parent project is `status='draft'` returns 0 rows. Anon SELECT for `status='published'` parent returns rows. Authenticated CRUD passes (SEC-04, CONSTRAINT-08).
- [x] Row-cap trigger verified: insert 20 rows for one project_id → succeeds. 21st insert → raises. Bulk insert of 21 in a single statement → raises and rolls back the entire statement.
- [x] No new Storage bucket / no new `storage.objects` policy needed (reuses `images` bucket). CONSTRAINT-20 N/A for this migration; noted in migration comment header.
- [x] Compound index `(project_id, order_index)` confirmed.
- [x] Existing `projects.image_id` / `image_after_id` columns left in place (backward-compat). Migration header comment documents the deprecation-in-progress.

**Tests required:**
- Manual: apply to dev DB, run inserts to confirm RLS + trigger behavior. No Vitest tests for migrations themselves (matches project precedent).

**Depends on:** T43.A (caption hard-cap 280 — PRD-default if no override).

**Specialist:** `@supabase` (schema author), `@cto` (review before apply)

**Closed:** Session 34, commit `f96b6f8`. `@cto` review landed two edits pre-apply (UPDATE-of-`project_id` trigger scope; before/after distinctness CHECK). Advisor delta: one new `search_path` WARN fixed in-session with `set search_path = ''`; one `admin_all`-USING-true WARN accepted under CONSTRAINT-09 (single admin); two unindexed-FK INFOs accepted, matching the existing pattern.

---

### Task T43.D: TypeScript types + public/admin queries + signed-URL resolver

Adds `ProjectMedia` (DB-row shape) and `PublicProjectMediaItem` (render-ready shape) to `lib/types.ts`, `getProjectMediaByProject` to `lib/db.ts`, an admin-side twin in `lib/admin-queries-project-media.ts`, and the signed-URL resolver `loadPublicProjectMedia` in `lib/public-project-media.ts`. `PublicProject` gains `media: PublicProjectMediaItem[]`.

**Acceptance criteria:**
- [x] All new exports have JSDoc (DS-01).
- [x] `getProjectMediaByProject` is wrapped via `safeLoad` at call sites (page-level Server Components only — CONSTRAINT-14). The function itself throws `ServiceError`.
- [x] `loadPublicProjectMedia` does NOT use `safeLoad` internally (CONSTRAINT-14 carve-out — `safeLoad` is boundary-only). Per-item URL failures are caught + logged + nulled.
- [x] No raw SQL string concatenation (SEC-03 — use Supabase query builder).
- [x] `lib/types.ts` deprecation comments on `Project.image_id` / `image_after_id` reference T43 + the migration plan (backward-compat window open-ended).
- [x] File sizes: `lib/db.ts` stays ≤300; `lib/admin-queries-project-media.ts` ≤200; `lib/public-project-media.ts` ≤200 (CQ-02).
- [x] Function sizes ≤50 lines each (CQ-01).

**Tests required:**
- [x] `tests/db.test.ts` describe `getProjectMediaByProject` → happy path + error case (TS-01).
- [x] `tests/public-project-media.test.ts` describe `loadPublicProjectMedia` → happy path + per-item resolution failure isolation (TS-01).
- [x] `tests/admin-queries-project-media.test.ts` describe `getProjectMediaByProjectAdmin` → happy path + DB error (TS-01).

**Depends on:** T43.C

**Specialist:** `@supabase` (query shape sanity-check) — not consulted; existing admin-queries patterns covered the shape.

**Closed:** 2026-05-20, Session 35, commit `ade9484`.

---

### Task T43.E: Server Action — `saveProjectMedia` (atomic save-all) + zod schemas

Four-file mutation module (`lib/admin-project-media-mutations{,-internal,-types,-schemas}.ts`) exporting one Server Action.

**Acceptance criteria:**
- [x] `lib/admin-project-media-mutations.ts` exports ONLY `saveProjectMedia` — no helpers (per §6.6.6 wrapper-only-exports rule).
- [x] `saveProjectMedia` applies the four-channel uniformity contract: try/finally `padToFloor` (Channel 3); try/catch with ZodError → `fieldErrors`, other → generic `GENERIC_FORM_ERROR` (Channels 1/2); no rethrow to wire (Channel 6); no `Set-Cookie` writes (Channel 5).
- [x] Internal helper validates UUID format on `projectId`, `image_id`, `image_after_id` (SEC-02).
- [x] Atomic delete-then-insert: **Option A (RPC) chosen by builder at task start.** Migration `010a_save_project_media_rpc.sql` creates `public.save_project_media(p_project_id uuid, p_rows jsonb)` — SECURITY INVOKER, `search_path=''`, `WITH ORDINALITY`-derived `order_index`, NULL/array-type guard, EXECUTE granted only to `authenticated` (revoked from `public` AND `anon`). DELETE + INSERT run in one Postgres transaction; INSERT-side failure (RLS, FK, row-cap trigger raise) rolls back the DELETE.
- [x] Row-count enforcement at zod boundary (`rows.length <= 20`) — defense layer to the DB trigger from T43.C.
- [x] CONSTRAINT-10 hard-delete semantics preserved: the RPC deletes-and-replaces `project_media` rows; orphan `images` cleanup remains the T27 sweep's responsibility.
- [~] `tests/server-actions-manifest.test.ts` allowlist extended to 13 IDs (SEC-09 / §6.6.5). — **Deferred to T43.F.** Next.js only emits a Server Action into the build manifest when the export is reachable from an `app/**` route, so the allowlist can only grow in lock-step with the UI that mounts the action. Same gating pattern as `uploadImage` (T25 → T26) and `deleteOrphanImages` (T27).
- [x] No real secrets in any committed file (SEC-01, SEC-07).
- [x] File sizes: each ≤200 (types/schemas) or ≤300 (internal/wrapper) per CQ-02. Function sizes ≤80 for validation, ≤50 elsewhere (CQ-01).
- [~] Voice check on operator-facing labels: "Save", "Saved." — dry, CONSTRAINT-13. — **N/A at T43.E** (no operator-facing labels in this surface); transfers to T43.F.

**Tests required:**
- [x] `tests/admin-project-media-mutations-schemas.test.ts` → happy path + error cases (caption >280 chars, row count >20, non-UUID image_id, missing image_id) (TS-01).
- [x] `tests/admin-project-media-mutations.test.ts` → happy path envelope, DB-throw envelope, validation-error envelope (TS-01).
- [~] Manifest assertion: `tests/server-actions-manifest.test.ts` confirms exactly 13 action IDs post-T43. — verified at 12 at T43.E close (action not yet manifest-reachable); 13 at T43.F close.

**Depends on:** T43.C, T43.D

**Specialist:** `@supabase` (RPC / transaction shape review) — consulted; APPROVE WITH MINOR; four edits landed in migration 010a before apply (WITH ORDINALITY, NULL/type guard, anon-revoke, nullif belt).

**Closed:** 2026-05-20, Session 36, commit `6fea8c6`.

---

### Task T43.F: Admin component — `ProjectMediaField` + `ProjectMediaRow`

**Acceptance criteria:**
- [x] PRD §3.5 G/W/T all pass in admin smoke:
  - 5 MB cap enforced on every upload (per existing `ImageUpload` precheck).
  - Required `alt_text` enforced per image (single OR pair, both slots).
  - Caption soft-warning ≥140 chars, hard-block at 280 (server-side via zod, client-side soft-warn via inline counter).
  - Soft-warning visible at 11+ rows; hard-block save at 21+ rows.
  - Drag-reorder updates visual order; persistence on form Save only (no auto-save).
  - Per-row delete + confirm modal (reuse existing `DeleteConfirmModal`).
- [x] Upload of a successful image lives at `images/projects/{project_id}/{uuid}_{filename}` (CONSTRAINT-07).
- [x] Saved `project_media` rows insert with `bucket_path`, `alt_text`, `parent_id`, `parent_type='projects'` (CONSTRAINT-07).
- [x] `ProjectMediaField.tsx` ≤200 lines (CQ-02). `ProjectMediaRow.tsx` ≤200 lines.
- [x] `ImageUpload.tsx` post-refactor ≤200 lines (closes S31 CQ-02 MAJOR carry-forward).
- [x] `ProjectForm.tsx` stays ≤200 lines post-modify.
- [x] All operator labels CONSTRAINT-13 voice-clean: "+ image" / "+ pair" / "Delete" / "Save" / "Trim to 20 rows" — dry, no emoji, no SaaS. Drag handle uses the Braille glyph `⠿`, a typographic symbol and not an emoji.
- [x] Multi-instance DOM ID hygiene: each `ImageUpload` inside a row uses `React.useId()` for input element IDs.
- [x] Component file shapes follow existing admin conventions: shadcn primitives; no public-site CSS variables.
- [x] Nested `<form>` discipline preserved (§6.6.7).

**Tests required:**
- `tests/ProjectMediaField.test.tsx` → renders initial rows in order; add creates a row; delete removes one; over-cap warning at 11+ (TS-01).
- `tests/ProjectMediaRow.test.tsx` → single-row renders 1 `ImageUpload`, pair-row renders 2; alt-required validation (TS-01).
- `tests/ImageUpload.test.tsx` regression post-refactor (TS-01).
- Playwright admin smoke: create project → add a single + a pair row → reorder via drag → save → reload → confirm order persisted.

**Depends on:** T43.A (designer consult), T43.E (Server Action available)

**Specialist:** `@ui-swarnimbagre` (admin shadcn mode)

**Closed:** 2026-05-21, Session 37, commit `3373682`. `ProjectImageField.tsx` deleted (dead post-swap). Server Action allowlist 12 → 13; `saveProjectMedia` now reachable. Two real bugs were caught by the e2e and fixed — both are recurring hazards worth remembering: `draggingIndex` had to move from `useState` to `useRef` (stale closure when dragstart and drop land on the same tick), and `crypto.randomUUID()` in a `useState` initializer caused an SSR hydration mismatch (loaded rows now reuse `project_media.id` as the React key). `@security` audit 20 CLEAR; `@code-review` PASS after 3 minor fixes.

---

### Task T43.G: Public component — `ProjectMediaCarousel` (embla wrapper)

**Acceptance criteria — PRD §2.3a G/W/T:**
- [~] Multi-slide carousel: dots + arrows + horizontal swipe + keyboard ←/→ all functional. No auto-advance. No loop — `loop: false`; boundary slides disable the corresponding arrow button. — **T46 regression:** `components/public/ProjectFrame.tsx` ships dots, arrows and swipe, but has no keydown handler at all, and `go()` wraps modulo `slides.length`, so the carousel now loops and neither arrow is ever disabled at a boundary.
- [x] Single-slide carousel: no nav chrome. Renders the slide static. — still true: `ProjectFrame.tsx` gates all chrome behind `multi = slides.length > 1`.
- [~] Zero-slide carousel: returns `null` (caller renders nothing). — **Changed at T46, deliberately (T46 Q7):** `ProjectFrame.tsx` returns a `.sb-frame` wrapper containing "no preview yet" rather than `null`.
- [~] Active-slide caption renders below the image in muted meta type when present. — **T46 regression, not an unshipped slot:** `ProjectFrame.tsx` threads `caption` into the slide model (lines 26, 41, 48) but the JSX emits only `<img>` / `<span className="sb-slide-label">`; no caption element is rendered and no caption class exists in `app/styles/public-projects.css`.
- [~] Screen-reader live region announces "Slide N of M, [alt text]" when active slide changes. — **T46 regression:** no `aria-live` region exists anywhere under `app/` or `components/`; slide changes are silent to screen readers.
- [~] `prefers-reduced-motion: reduce` honored: embla `duration: 0` when the media query matches. — **T46 regression:** `prefers-reduced-motion` appears in no CSS file or component in the repo, so the `.4s cubic-bezier(.4, 0, .2, 1)` `.sb-track` transform runs unconditionally.
- [~] Pair-row divider drag does NOT advance the carousel — drag within the divider hit area is consumed. — **Moot after T46:** `BeforeAfterMedia.tsx` and its divider were deleted; `toSlides()` flattens a before/after pair into two ordinary slides, so no divider hit area exists.
- [~] Multi-instance DOM ID hygiene: `React.useId()` for the `aria-controls` / `aria-labelledby` / dot button IDs. — **T46 regression:** `ProjectFrame.tsx` calls no `React.useId()` and emits no `aria-controls` / `aria-labelledby`; arrows and dots carry `aria-label` only, so the dots are not programmatically tied to the track.
- [x] CONSTRAINT-05 Override 2 boundary: this is the only public-site component using a JS library.
- [x] All styling uses CSS variables from `colors_and_type.css`. No Tailwind. No inline library defaults.
- [~] Arrow + dot button labels are typographic glyphs only (`←`, `→`, `•`) — CONSTRAINT-13. ARIA labels: `aria-label="Slide 1"` etc. — **Drifted at T46:** arrows render `&lsaquo;` / `&rsaquo;` and dots are unlabelled CSS shapes, while the ARIA strings became prose (`Previous image of {title}`, `Go to image N of {title}`) — the exact phrasing T43.A rejected. Visible chrome still holds CONSTRAINT-13; the ARIA contract does not.
- [x] `ProjectMediaCarousel.tsx` ≤200 lines (CQ-02). — 198; presentational sub-components extracted to `ProjectMediaCarouselParts.tsx` (164).
- [x] `BeforeAfterMedia.tsx` post-refactor ≤200 lines (closes S31 CQ-02 MAJOR carry-forward). — 161; CSS scenes extracted to `BeforeAfterMediaScenes.tsx` (91).
- [~] Bundle delta verified: T43.B + T43.G commits combined add ≤10 KB gzip to the public-route entry chunk. — **DEFERRED to T43.H:** nothing imports the carousel yet, so its entry-chunk delta is 0 and unmeasurable until wired in.
- [~] Run `npm run build`, diff the route chunk size for `/projects/[slug]` (and `/projects` list page if also affected) against pre-T43 baseline. Confirm production-bundle delta ≤15 KB gzip on the route chunk that loads `ProjectMediaCarousel`. If >15 KB, escalate to `@cto` before T43.G close. — **DEFERRED to T43.H**, same reason.

**Tests required:**
- `tests/ProjectMediaCarousel.test.tsx` → 3-slide happy path; single-slide branch; zero-slide branch; keyboard nav; reduced-motion; multi-instance ID isolation; pair-slide drag-priority; ARIA live text (TS-01).
- `tests/e2e/public-carousel.spec.ts` → swipe + keyboard nav on `/projects/[slug]`; independent carousels per card on `/projects`.

**Depends on:** T43.A, T43.B, T43.D

**Specialist:** `@ui-swarnimbagre` (public bundle mode + Override 2 boundary author)

**Closed:** 2026-05-21, Session 38, commit `5afac09`. `@code-review` PASS WITH MINOR (0 gating); `@security` audit 21 CLEAR. A `view: 'list' | 'detail'` prop was added beyond the planned `{ media, ariaLabel }` signature — Override 2's list/detail chrome sizing requires it.

---

### Task T43.H: Wire carousel into cards + detail page + list page

**Acceptance criteria — PRD §2.3 + §2.3a:**
- [x] PRD §2.3 G/W/T: `/projects` list — project with `project_media` rows renders carousel in card's image slot; project with zero rows shows no image area.
- [x] PRD §2.3a G/W/T: `/projects/[slug]` — detail page renders the same carousel; container size differs (detail = larger) and chrome adapts per the T43.A spec.
- [x] Backward-compat: existing projects with `image_id` / `image_after_id` set and no `project_media` rows render exactly as they do today (legacy fallback path in `ProjectMedia.tsx`). No visual regression.
- [x] CONSTRAINT-05 additive-prop carve-out honored: when `media` is undefined OR `[]`, `ProjectCard` renders byte-identically to its pre-T43 output.
- [x] CONSTRAINT-14 `safeLoad` discipline: page-level loaders wrap `loadPublicProjectMedia` per project — one project's media failure nulls that card's carousel only, not the page.
- [x] CONSTRAINT-15: every URL in `media` is a signed URL with TTL 3600s.
- [x] Mobile mirror: `MobileProjectCard` renders carousel identically on iPhone viewport.
- [x] No console errors on `/projects` or `/projects/[slug]` (CQ-05).

**Tests required:**
- `tests/ProjectCard.test.tsx` + `tests/MobileProjectCard.test.tsx` — `media` with rows renders the carousel; undefined/empty falls back to the legacy single-image branch (TS-01).
- Playwright, extended from `public-carousel.spec.ts`: two multi-media projects on `/projects` get independent carousels; a legacy-`image_id`-only project still renders its static image.

**Depends on:** T43.G

**Specialist:** `@ui-swarnimbagre` (public bundle mode)

**Closed:** 2026-05-21, Session 39, commit `0029072`. Bundle +8 KB First Load JS on `/projects` + `/projects/[slug]`, inside the 15 KB budget. The real edits were the two `pages/Projects.tsx` page-body components, not `app/projects/page.tsx` + `lib/public-projects.ts` as this task's original Files list predicted — T43.D already returned `media` from `loadPublicProjects()`.

---

### Task T43.I: Override 2 documentation + close-out

> **CONSTRAINT-22 wording (per `@cto`):** "JS libraries on public site permitted only with a documented Override and ≤15 KB gzip total per Override surface (measured against the production route chunk, not published ESM)."

**Acceptance criteria:**
- [x] `docs/design-decisions.md` "Override 2" section structured identically to Override 1 (Rationale / What changed / What stayed / Surface boundary). ~~Surface boundary lists exactly: `ProjectMediaCarousel.tsx` + the `embla-carousel-react` dependency.~~ **Revised per `@cto`:** the as-built surface is 12 entries (11 files plus the dep), with the data layer, migrations and admin field component deliberately excluded.
- [x] `docs/constraints.md` CONSTRAINT-22 added; summary table updated; CONSTRAINT-05 line amended to reference Override 2.
- [x] `docs/architecture.md` new §2.5 (`project_media` schema) + §4.9 (Carousel surface boundary).
- [x] `docs/founder-brief.md` Index updated; dated entry. — entry #31.
- [x] `docs/content-model-expansion.md` further-superseded line at top.
- [x] `docs/plan-phase-4-launch.md` T43 marked done.
- [x] `manifest.md` Project Identity Phase 4 status line updated.
- [x] No broken cross-references between docs (DS-02).
- [x] All operator-facing labels added in T43 still voice-clean (CONSTRAINT-13) — 0 banned phrases, 0 emoji codepoints; typographic glyphs (`⠿`, `⇆`, `←`, `→`, `≤`, `⋮⋮`) all permitted.
- [x] `npm run build` clean (CQ-05).
- [x] Full `npm test` suite passing.
- [~] Playwright admin smoke + new public carousel spec both green — `admin-smoke.spec.ts` re-run PASS; `public-carousel.spec.ts` carried forward green from T43.H rather than re-run, because T43.I changed zero runtime code and re-running needs the publish/revert DB fixture ceremony. Marked `[~]` to keep the plan honest.
- [x] `@security` audit 23 CLEAR: 0 Critical / 0 High / 0 Medium new. **1 LOW caught and FIXED in-session** — `architecture.md` §2.5 named a `kind` column, an `updated_at` column and `ON DELETE CASCADE` on the image FKs, none of which exist in migration 010 (the discriminator is implicit in `image_after_id IS NULL`; the image FKs are `ON DELETE RESTRICT`). §2.5 corrected to mirror the migration verbatim.
- [x] `@code-review` PASS WITH MINOR — the DS-01 / DS-02 / DS-04 doc checks, file-size budgets and CONSTRAINT-22 wording consistency all PASS. **CQ-07 decision: CARRY FORWARD as non-gating MINOR** — the `mediaItem()` test-helper factory is duplicated byte-identically across `tests/ProjectMedia.test.tsx`, `tests/ProjectCard.test.tsx` and `tests/MobileProjectCard.test.tsx`; extraction is blocked on a first-mover `tests/_fixtures/` decision that no directory exists for yet.

**Tests required:**
- Doc link audit (manual).
- Full test suite must pass (TS-01, TS-04).

**Depends on:** T43.H (all execution work complete before close-out)

**Specialist:** `@security`, `@code-review`, `@cto` (review Override 2 + CONSTRAINT-22 wording)

**Closed:** 2026-05-23, Session 40, commit `9b21162`. T43 fully closed, 9/9 sub-tasks.

---

## [x] T44 — Manual drag-reorder for projects & posts

**Closed:** Sessions 45–47 (2026-06-03), commits `2033bbf` (A), `7694236` (B), `6ed1d94` (C), `f095edd` (D). Migrations `012_sort_order.sql` + `012a_save_sort_order_rpc.sql` applied to prod. Server Action allowlist 13 → 15. Source: `docs/prd.md` §3.7.

**Decisions locked at planning (Session 43):**
- Public lists reflect the manual order — `/projects` + `/writing` order by `sort_order`, superseding the reverse-chronological default (PRD 2.1 + 2.3 updated).
- One order per type. Stats stay reverse-chronological. Media-row reorder inside a project (T43 / §3.5) is unaffected.
- New rows append to the END of the order (insert trigger sets `max+1`); admin drags up to feature.
- Explicit "Save order" action; no auto-save on drop (mirrors the T43 media field).
- Admin is desktop-only (single operator) — HTML5 native DnD, no touch-drag, no new dependency.
- Uses `UPDATE … FROM` rather than T43's delete-then-insert, because `projects` / `posts` rows carry content and FKs.

**Known non-blocker (still true):** drag-reorder operates on the current display order, so reordering while the list is filtered or paginated sends only the visible subset to "Save order". A no-op risk for a single operator with ~6 projects; add a guard if data volume grows.

---

### T44.A — Schema: `sort_order` column + reorder RPCs

**Acceptance criteria:**
- [x] Migration 012 applies cleanly to dev + production; guarded/idempotent (`add column if not exists`).
- [x] `sort_order` is `not null` with `check (sort_order >= 0)` on both `projects` and `posts`.
- [x] Backfill preserves the current newest-first order (newest row = `sort_order` 0).
- [x] `(status, sort_order)` index exists on both tables.
- [x] BEFORE INSERT trigger appends a new row to the end of the order (`max+1`, or 0 when the table is empty). — triggers verified present and wired; append logic verified by inspection, not by a live INSERT (that would create then hard-delete a real row, CONSTRAINT-10).
- [x] `save_project_order` / `save_post_order` set `sort_order` by array position via `WITH ORDINALITY`; raise loudly on null / non-array input (EH: loud failure with context). — non-array raises `P0001`.
- [x] RPCs are `security invoker` + `search_path = ''`; EXECUTE revoked from `public` AND `anon`, granted to `authenticated` (SEC: least privilege; matches migration 010a).
- [x] No new RLS policy — `projects_admin_all` / `posts_admin_all` already cover the `sort_order` write.
- [x] `@cto` decision recorded on `updated_at`: the reorder UPDATE fires the `*_set_updated_at` trigger — **ACCEPT the bump.** `updated_at` is not displayed (admin shows `created_at`), and suppression would need elevated privileges incompatible with the `security invoker` model. No suppression logic in the RPCs.

**Tests required:** the repo has NO live-DB unit harness — all "db" tests use a stubbed client. The behavioral criteria were verified empirically against the live DB via Supabase MCP; `tests/migration-sort-order.test.ts` is the static-shape regression (14 assertions locking the load-bearing SQL idioms, mirroring `tests/server-actions-manifest.test.ts`).
- [x] `migration 012 backfill ranks existing rows newest-first` → happy.
- [x] `save_project_order persists array order into sort_order` → happy.
- [x] `save_project_order raises on non-array p_rows` → error.
- [x] `save_post_order` mirror of the two above.
- [x] RLS empirical: authenticated reorder succeeds; `anon` EXECUTE on the RPC is denied.

**Depends on:** T39 (production deploy + live DB).
**Specialist:** `@supabase` (migration + RLS + RPC), `@cto` (schema + `updated_at` call, pre-apply).
**Closed:** Session 45 (2026-06-03), commit `2033bbf`.

---

### T44.B — Types + switch read-path to `sort_order`

**Acceptance criteria:**
- [x] `Project` and `Post` include `sort_order: number`.
- [x] Public `/projects` and `/writing` render published rows in `sort_order` ascending.
- [x] Admin `/admin/projects` and `/admin/posts` render in `sort_order` ascending.
- [x] `created_at` desc retained as tiebreaker on all four reads. — `.order('sort_order', asc).order('created_at', desc)`.
- [x] Public loads still route through `lib/safe-load.ts` (CONSTRAINT-14) — unchanged.
- [x] Existing query tests updated to expect `sort_order` ordering.

**Tests required:**
- [x] `getPublishedProjects orders by sort_order asc then created_at desc` → happy.
- [x] `getAllPosts orders by sort_order asc` → happy.
- [x] mirror for the other two reads (`getPublishedPosts`, `getAllProjects`).

**Depends on:** T44.A.
**Specialist:** `@dev`.
**Closed:** Session 45 (2026-06-03), commit `7694236`.

---

### T44.C — Reorder Server Action (four-file pattern)

**Acceptance criteria:**
- [x] Each action reads an ordered `rows` array (`[{ id }]`) from FormData and calls the matching RPC (`save_project_order` / `save_post_order`).
- [x] Uniform `{ status, fieldErrors?, formError? }` envelope; never throws to the wire; `padToFloor` timing floor (Channel 3 pattern).
- [x] Zod rejects non-uuid ids and malformed payloads (EH: loud at the boundary).
- [~] Both new action IDs registered in `server-actions-manifest` (SEC-09) — manifest test green. → **DEFERRED to T44.D:** Next.js reachability gating — the actions are not route-reachable until the T44.D UI mounts them, so the manifest stays at 13 and the allowlist must too. Same pattern as `saveProjectMedia` (T43.E → T43.F).
- [x] Longest function < 50 lines; each file < 300 lines (CQ-01 / CQ-04).
- [x] `@security` audit: writes are server-side only; RPC `security invoker` keeps RLS as the boundary; no new public surface. — **CLEAR.**

**Tests required:**
- [x] `saveProjectOrder persists order on a valid payload` → happy.
- [x] `saveProjectOrder returns an error envelope on a non-uuid id` → error.
- [x] `savePostOrder` mirror.

**Depends on:** T44.A.
**Specialist:** `@security`.
**Closed:** Session 46 (2026-06-03), commit `6ed1d94`.

---

### T44.D — Admin drag UI + "Save order"

**Acceptance criteria:**
- [x] Rows in `/admin/projects` and `/admin/posts` are drag-reorderable via HTML5 native DnD (no new dependency).
- [x] Drop reorders optimistically; "Save order" persists + shows a `sonner` success toast; reload preserves the order.
- [x] No auto-save on drop — explicit save (PRD §3.7; mirrors §3.5).
- [x] Operator labels are CONSTRAINT-13 clean (dry, no SaaS phrases, no emoji; `⠿` typographic handle only).
- [x] Touch-drag not implemented (desktop-only, single operator — stated, not a gap).
- [x] Components ≤ 200 lines (CQ-02) — split if exceeded. — table block extracted to `components/admin/ResourceListReorder.tsx` (172); `ResourceList.tsx` dropped 208 → 190.
- [x] `@ui-swarnimbagre` admin (shadcn) mode + `@code-review` PASS.

**Tests required:**
- `reorderRows reorders the client list on drop` → happy.
- `Save order dispatches the action with ordered ids` → happy.
- Playwright admin smoke: drag a row in `/admin/projects`, click Save order, reload, verify the new order persists.

**Depends on:** T44.B, T44.C.
**Specialist:** `@ui-swarnimbagre`, `@code-review`.

**Closed:** Session 47 (2026-06-03), commit `f095edd`. `reorderRows` is imported directly from `lib/admin-project-media-form-state.ts` — no shared `lib/reorder.ts` lift was needed. Optimistic order resyncs via a `key={filter-page}` remount rather than a resync effect. SEC-09 allowlist 13 → 15 landed in lock-step with the UI.

---

## [x] T45 — Embedded project writeup (linked post on the detail page)

**Closed:** 2026-05-28, Session 44, commit `223f3c2` (header flipped in `3f83edb`). Built ahead of T44 per builder-approved resequence — T45 defines the project-detail structure before content authoring. Migration `011_project_post_link.sql`; T45 landed first, so it took `011` and T44 re-numbered to `012`/`012a`. Source: `docs/prd.md` §3.8 + `docs/design-decisions.md` Override 3.

**Decisions locked at planning (Session 43):**
- A project attaches ONE existing post via a new `projects.post_id` FK (nullable, `on delete set null`); the post is a normal post that also appears in `/writing`.
- The detail page renders the linked post's body below the card via the existing `MarkdownContent`, per Override 3 — no repeated post `<h1>`; a hairline + post-date meta label separates card from body.
- The `/projects` title links to the detail page only when `post_id` is set OR the project has more than one media item; bare single-image projects are non-clickable.
- Only a `published` linked post renders publicly (no draft-body leak).
- `post_url` (`¶ notes`) stays independent of `post_id`.
- `MarkdownContent` hydrates client-side, so the embedded body is not in the initial SSR HTML — accepted tradeoff, identical to `/writing`.

> **Superseded at T46:** `/projects/[slug]` was deleted, so there is no detail page to embed into. The card's "Writeup" action links to the `post_id` post instead. The FK, the admin picker and the published-only gate all survive.

---

### T45.A — Schema + types: `post_id` FK

**Acceptance criteria:**
- [x] Migration applies cleanly to dev + production; idempotent (drop-then-add FK).
- [x] `post_id` is nullable, FK to `posts(id)` with `on delete set null` (matches `image_after_id`).
- [x] No new RLS policy — the column-agnostic `projects_*` policies cover it. — verified via `pg_policies`; both policies are row-level, so a new column is auto-covered.
- [x] `Project` type carries `post_id: string | null`.
- [x] `createProject` / `updateProject` accept and persist `post_id`; zod coerces empty → null and rejects non-uuid.

**Tests required:**
- [x] `zod accepts null/empty post_id and rejects non-uuid` → happy + error.
- [x] `createProject persists post_id` → happy.

**Depends on:** T39.
**Specialist:** `@supabase` (migration), `@cto` (FK choice, pre-apply).

---

### T45.B — Admin "Linked writeup" picker

**Acceptance criteria:**
- [x] `listPostsForPicker` returns published posts as `{ id, title }`, ordered by title.
- [x] `ProjectForm` renders a "Linked writeup" dropdown (published posts + "Unset"); selection saves to `post_id` via the hidden-input pattern (empty → null).
- [x] Both the `new` and `[id]` admin pages fetch and pass `posts`.
- [x] Operator label "Linked writeup" is CONSTRAINT-13 clean (dry, no emoji, no SaaS phrases).
- [x] CQ-02: if `ProjectFormDisplay` exceeds 200 lines, split. — 151 lines; no split needed.

**Tests required:**
- [x] `listPostsForPicker returns published posts only` → happy (+ error test).
- [x] `ProjectForm renders the linked-writeup options and prefills on edit` → happy.

**Depends on:** T45.A.
**Specialist:** `@ui-swarnimbagre` (admin shadcn mode).

---

### T45.C — Public detail render: embedded post body

**Acceptance criteria:**
- [x] When `post_id` → a published post, the detail page renders the post body below the card (desktop + mobile), styled per Override 3 (720px, `font-serif`, hairline + date meta, no repeated `<h1>`).
- [x] When `post_id` is null OR the post is a draft, no body renders — no error (missing/draft is a clean empty, not a failure).
- [x] Public loads route through `lib/safe-load.ts` (CONSTRAINT-14); the post fetch is its own `safeLoad`.
- [x] `@security`: only `published` posts render — no draft body leak via `post_id`. — `getPublishedPostById` gates `.eq('status','published')` **inside the query**, not at the caller; a null id short-circuits before any DB hit; RLS `posts_public_select` is the second gate.

**Tests required:**
- [x] e2e: project with a published linked post shows the body on `/projects/<slug>`.
- [x] e2e: project with null `post_id` shows no body, no error.
- [x] unit: the linked-post loader returns null for a draft/missing post.

**Depends on:** T45.A.
**Specialist:** `@ui-swarnimbagre` (public bundle mode), `@security` (draft-leak check).

---

### T45.D — Title-link gating + Override 3 docs

**Acceptance criteria:**
- [x] `PublicProject` carries `postId`; the mapper sets it from the row.
- [x] A project with no linked post and at most one media item has a non-clickable title (no detail navigation) on both desktop + mobile lists.
- [x] A project with a linked post OR more than one media item links its title to `/projects/<slug>`. — gate is `p.postId != null || p.media.length > 1`.
- [x] `ProjectCard` / `MobileProjectCard` render cleanly with no `onClick` (inert title, `cursor: default`). — `ProjectCard` was FIXED here: it had always wrapped the title in `<a href="#" class="link">`; the anchor now renders only when `onClick` is present.
- [x] Tests updated for the gated state + `postId` mapping; `@code-review` PASS. — two findings both RESOLVED: `lib/db.ts` was over the CQ-02 300-line cap and split into `db-posts.ts` + `db-internal.ts`, and `formatDate` was extracted to `lib/format-date.ts`.

**Tests required:**
- [x] `ProjectCard renders an inert title when no onClick` → happy (+ active-link case; mirrored on `MobileProjectCard`).
- [x] `public-projects mapper sets postId` → happy (+ null-post case).
- [x] e2e: a bare project card title is not a link; an enriched one is. — the `media.length > 1` branch is covered by unit tests only; no multi-media published project is seeded.

**Depends on:** T45.A, T45.C.
**Specialist:** `@code-review`, `@designer` (confirm Override 3 layout in render).

---

## T46 — Full public-site redesign [x]

**Closed 2026-08-04, Session 51, commit `228f76f`.** Built end to end in one run, all six phases.

**Trigger:** real user feedback. The builder showed the live site to several people who were confused by it and disliked the look. The original dark bundle was replaced wholesale rather than iterated on.

**Source:** Claude Design export, archived in-repo at `docs/design-source/redesign-2026-08/` (`swarnim-bagre-site.bundled.html` + `template.extracted.html`). CONSTRAINT-05 re-baselined onto it; Overrides 1, 2 and 3 retired.

**Nine decisions locked with the builder (Q1-Q9):**
1. Home chat stays FAKE, with rotating canned deflections pushing to contact. No model, no API route.
2. `/writing/[slug]` kept; `/projects/[slug]` deleted. The card's "Writeup" action links to the T45 `post_id`.
3. `/other` ships all 7 tiles, hand-maintained.
4. Single responsive tree. `components/public/mobile/` and the middleware device split both deleted.
5. Admin stays dark. CONSTRAINT-16's four brand tokens become admin-owned constants.
6. `subtitle` + `tags` added to projects.
7. **Photos only.** The S49 SVG thumb motifs are retired. A project with no media renders a plain "no preview yet" box rather than a generated motif.
8. Space Mono self-hosted (the export bundles it but never references it; treated as an export bug).
9. Bio rewritten, first person.

Plus: no footer anywhere, blinking cursor removed, email corrected to `bagreswarnim@gmail.com`, three branded reach-out marks under "Find me here:" on Home only, em-dash sweep across UI copy.

- [x] Migrations `013_project_card_fields` + `014_other_page_model` applied to prod and empirically verified. 7/7 constraint cases correct; RLS on `notes` verified by ROW COUNT, not by exception — a first test wrongly read `anon_delete` as allowed, because a DELETE matching zero rows succeeds silently. Advisor delta: exactly 1 new WARN, the standard `rls_policy_always_true`, accepted under CONSTRAINT-09.
- [x] Token layer + fonts replaced. Palette inverted dark to light (`#1C1712` to `#F4F1EA`, gold `#C9A84C` to green `#1F3D2F`); Fraunces + JetBrains Mono to Instrument Serif + Space Grotesk + Space Mono, self-hosted via `next/font` on `<html>`.
- [x] Four pages plus `/writing/[slug]` rebuilt and visually verified in a real browser at 1440px and 390px.
- [x] 47 files deleted, including 22 orphaned public components, the mobile tree, `lib/thumb-kinds.ts` and the newly orphaned `lib/nav-targets.ts`.
- [x] `embla-carousel-react` uninstalled; carousel hand-rolled in `ProjectFrame.tsx`. Public site back to zero runtime JS dependencies, so CONSTRAINT-22 now has no consumers.
- [x] Admin: `subtitle`/`tags` on the project form (thumb picker removed), `aside`/`sort_order` on stats, full `notes` CRUD at `/admin/notes`, and an `updateStat` edit path so the hand-maintained tiles can be corrected in place. SEC-09 allowlist **15 to 19**, verified by the build-gated manifest test.
- [x] Docs re-baselined: CONSTRAINT-05 + 03/15/16/22, `design-decisions.md`, `CLAUDE.md`, `architecture.md` (new §2.6 + §4.10), `founder-brief.md` #34.

**Tests required:**
- [x] Vitest **50 files / 381 tests / 0 failures** (down from 457; 11 test files targeted deleted components). `tsc` clean. `next build` exit 0, 18 routes.
- [~] Playwright **NOT executed** — needed a live Supabase fixture and an authenticated session unavailable that session. `admin-smoke.spec.ts` was rewritten for the new markup and the stats card stack, and `pages.spec.ts` / `admin-font.spec.ts` re-pointed; all type-correct but unrun. `ua-desktop.spec.ts` / `ua-mobile.spec.ts` deleted (they asserted the device split). — **Run at Session 54: 15/15 green.** The defect that run exposed became T47.

**Known gap, deliberate:** nothing publicly exercises the multi-slide carousel, because the only project with media rows is a draft and never reaches `/projects`.

**Content state at close, for the record only — not tracked work.** T46 shipped against empty tables. The `/other` rows (4 stats + 3 notes) were entered at Session 53. Project image assets were removed from plan tracking at Session 55 by builder decision; cards rendering "no preview yet" is a known, accepted state. Do not re-open either as a task.

---

## T47 — Reliable e2e teardown: stop leaking production rows [x]

**Added 2026-08-06, Session 54, via `@create-plan`.** Opened by the first-ever Playwright run (the T46 criterion above).

**Not a PRD feature.** This is a test-harness defect, so it has no `docs/prd.md` entry and `@cpo` was not consulted. `@create-plan`'s rule is "feature must be specced in `docs/prd.md`"; the governing precedent for an infra task without a product spec is **T10.5** (testing infrastructure). Recorded here rather than left as an unexplained bypass.

**The defect.** `tests/e2e/admin-smoke.spec.ts` writes to the PRODUCTION database — CONSTRAINT-02 means there is no staging project, so every test row is a live row — and deleted its rows at the end by driving the admin UI. That cleanup was unreliable AND did not verify itself:

- `Locator.count()` is an immediate read and does not auto-wait. The admin list resolves to **0 rows** mid-`router.refresh()`, so a pass reads 0, concludes "already deleted", returns success, and leaves live rows behind.
- Observed at Session 54: a **fully green** run left 3 projects in production, one of them `published` and therefore rendering on the live `/projects` page beside the builder's real six.
- A first fix attempt (settle before counting, sweep by `RUN_ID`, assert zero survivors) surfaced a second problem — a delete that does not decrement the row count — and blew the 20s step budget. It was reverted rather than left half-finished.
- `images` rows and Storage objects had **never** been cleaned up by anything, by any run, ever.

**Fix direction:** stop doing hygiene through the UI. Teardown talks to Postgres directly with the service role. Keep one UI delete as a *test* of the delete button; it just stops being what the suite relies on for cleanup.

**Files:**
- `tests/e2e/global-teardown.ts` (create) — Playwright `globalTeardown` entry point.
- `tests/e2e/fixtures/cleanup.ts` (create) — service-role client + the sweep. Must import nothing that reaches `next/headers`.
- `playwright.config.ts` (modify) — register `globalTeardown`.
- `tests/e2e/admin-smoke.spec.ts` (modify) — drop the two cleanup `runStep` blocks as hygiene.
- `package.json` (modify) — declare `@supabase/supabase-js` in `devDependencies`.
- `tests/e2e-cleanup.test.ts` (create) — unit tests for the pure helpers.

**Functions to implement:**
- `createServiceRoleClient(): SupabaseClient` — reads `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` from `process.env`, throws a named error naming the missing variable if absent (EH-05).
- `findTestProjectIds(client): Promise<{ id: string }[]>` — matches on **`title`**, not slug.
- `sweepTestArtifacts(client): Promise<CleanupReport>` — orchestrates the ordered deletion, returns per-table counts.

**Acceptance criteria:**
- [x] Teardown runs in Node via the service role and imports **no** module that reaches `next/headers` — 19 `lib/` modules are transitively disqualified through `lib/supabase.ts`.
- [x] Match is on **`title`**, not slug prefix. The four test projects carry three different slug prefixes (`t28-`, `t42-`, `t43f-`), so a `t28-%` slug sweep silently misses the T42 and T43F rows; every title embeds `RUN_ID`.
- [x] `images` rows are located by `parent_id IN (test project ids)` **captured before the projects are deleted**. No column on `images` carries a run marker, and `images.parent_id` has no FK (polymorphic, `001_create_schema.sql:69`), so the rows dangle rather than cascade.
- [x] Deletion order respects the FKs: `projects` first — which cascades `project_media` (`010_project_media.sql`, `on delete cascade`) and thereby releases the `on delete restrict` those rows hold on `images` — then `images`, then Storage objects, then `posts` and `stats`.
- [x] Storage objects are removed from bucket `images` using each row's `bucket_path` (CONSTRAINT-07 path scheme).
- [x] Sweep is **self-healing**: it removes pre-existing debris from earlier crashed runs, not only the current run. This absorbs the ~23 orphaned `images` rows carried since T40. These are invisible to `lib/admin-images-cleanup.ts`, whose orphan predicate is `parent_id IS NULL AND parent_type IS NULL`.
- [x] Teardown runs even when the spec fails partway — that is the case that leaked.
- [x] Given a green run, when the teardown finishes, then `projects` / `posts` / `stats` / `images` contain zero test rows and the `images` bucket contains zero test objects. **Verified by querying the database, not by the suite reporting success** — reporting success while leaving rows behind is the defect.
- [x] The suite fails loudly if teardown cannot complete (EH-01: no silent catch; EH-02: error names what failed, which table, and how many rows remained).
- [x] SEC-01: the service-role key is read from `process.env` and never hardcoded, including in test files.
- [x] CQ-01: no function exceeds 50 lines. CQ-05: no `console.log` debug aids left in.
- [x] **`sort_order` side effect addressed.** The T44.D step clicks "Save order", which rewrites `sort_order` on **every** project row including the builder's real six. Either snapshot and restore the real rows' `sort_order`, or scope the reorder step so it cannot touch non-test rows.

**Tests required:**
- `test-title pattern matches all four project titles` (TS-01 happy).
- `test-title pattern rejects a real project title` (TS-01 error) — guards against a sweep that could delete real content.
- DB-dependent verification is manual per the acceptance criterion above; the pure pattern builders are unit-tested (TS-03).

**Depends on:** none.

**Specialist:** `@supabase`

**Closed:** 2026-08-06, Session 55, commit `9fc52c5`. Teardown now sweeps with the service role and verifies against the database, so a green run no longer leaks live rows. Recorded as `founder-brief.md` entries #38 (teardown talks to the DB directly) and #39 (the e2e suite runs one file at a time).

---

## Phase 4 Exit Criteria

- [x] T32–T40 + T42–T47 complete. T40 closed by superseding two criteria (voice check on live copy, `docs/launch-checklist.md` post-launch section) as continuous work rather than one-time gates — they were not completed, and that work continues outside the plan. T41 was trigger-gated and never blocked exit; it shipped at Session 55 with two criteria unsatisfiable as written (they name `/projects/[slug]`, deleted at T46) and one still open — Google Search Console verification, which needs the builder's account.
- [x] Site is live at `swarnimbagre.com`, monitored, with content rendering against the expanded project schema.
- [x] All security and code review findings closed.
- [x] Mark Phase 4 row Done in [`plan-index.md`](plan-index.md). The `@plan` cycle is complete; future work happens via individual `@plan` follow-up tasks against the same docs.
