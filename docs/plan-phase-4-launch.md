# Plan — Phase 4: Polish + Launch

**Date:** 2026-05-06
**Status:** Active — T32–T39 done (T38 doc audit complete; 9/10 criteria met, only the DS-05 fresh-clone manual run outstanding — tracked separately. T39 closed 2026-05-19, Session 27: deploy live on apex canonical `swarnimbagre.com`, admin verified end-to-end including CRUD round-trip); **T42 Session A done 2026-05-19, Session 29** (schema + admin write surface — migration 009 applied to prod, zod + Server Actions + ProjectForm wired, 24 new tests); **T42 Session B done 2026-05-19, Session 30** (public render desktop — ProgressRing + ProjectRow/Card/Media + Home + Projects, 259/259 vitest, @code-review APPROVED WITH MINOR); **T42 Session C done 2026-05-19, Session 31** (mobile mirrors + Override 1 docs + Playwright admin smoke + @security audit 18 CLEAR, 304/304 vitest, @code-review APPROVED WITH MINOR; 3 mid-session production bug fixes via Targeted Fix Mode); T40 content-addition criteria UNLOCKED but other T40 criteria still open (24h log review, voice-check, launch-checklist post-launch section, DS-03 launch entry); T41 trigger-gated
**Tasks:** T32–T42 (11 tasks; T41 is trigger-gated and does not block Phase 4 exit — same pattern as Phase 3's T29/T31 operator-gated deferrals; T42 added 2026-05-19 as a pre-T40 schema + render expansion to make the public project card meaningfully render real DB content)
**Predecessor:** [`plan-phase-3-ingestion.md`](plan-phase-3-ingestion.md)
**Successor:** none — final phase

End state: site is live at `swarnimbagre.com`, monitored, the post-launch checklist is closed. Phase 4 is operational and quality work — error monitoring, env-var hygiene, security review, code review, doc audit, production deploy, and post-launch ops.

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

**Option A — deploy now:**
- [ ] Sentry project created. `SENTRY_DSN` set in Vercel production env (server) and `NEXT_PUBLIC_SENTRY_DSN` (client) if needed.
- [ ] Unhandled errors in both browser and server contexts are reported.
- [ ] **PII scrubbing rules:** email addresses, tokens, and request bodies are stripped before send (SEC-05).
- [ ] Error events include: route path, session presence flag (anon vs authenticated), error name, sanitized stack.
- [ ] No `console.log` debug aids left in (CQ-05).

**Option B — defer:**
- [x] `.env.example` lists `SENTRY_DSN` with a comment "deferred — set when monitoring is added".
- [x] `docs/monitoring.md` documents that Sentry is deferred and what the builder should look at instead in the meantime (Vercel logs, Supabase Edge Function logs).

The builder picks A or B at task start. Either choice is valid; record the choice in `docs/session-log.md`.

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
- [ ] DS-05 verification: a fresh checkout, following only the README, reaches a working `npm run dev` state. — **Deferred to builder; manual run on a clean clone.**

**Tests required:**
- Manual: builder runs through README setup on a fresh clone, confirms steps work as written. Logged in `docs/session-log.md`.

**Depends on:** T32

**Specialist:** none

---

## T34 — Environment variables checklist + startup validation [x]

**Decisions (2026-05-15, builder-approved):** (1) `docs/env-vars.md` git-renamed to `docs/env-checklist.md` and made the single authoritative env reference, rather than creating a second doc — error string + test assertion updated to match. (2) `ADMIN_ALLOWED_EMAIL` promoted to startup-required (hard-fails `next build`/`next dev`), previously lazily-validated. `NEXT_PUBLIC_SITE_URL` deliberately NOT promoted (has a Vercel-preview fallback). Rationale in `docs/session-log.md` [2026-05-15 21:38].

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

**Findings:** any failure here blocks launch. Fix and re-run before marking done. — **Audit 16 (2026-05-15): CLEAR.** 0 Critical / 0 High. 2 new Medium (F-29 auth log hygiene, F-30 Storage bucket limit not in migration) + 5 new Low — all documented, tracked, non-blocking. The Markdown criterion is satisfied: sanitization is client-side **by CONSTRAINT-06 mandate**, whitelist matches the locked spec verbatim. F-30 leaves a manual Dashboard-verification line for the launch checklist. See `docs/security-report.md`.

**Tests required:** [review task — assertions captured in checklist above]

**Depends on:** T34

**Specialist:** `@security`

---

## T37 — Code review [x]

**Files:** all code from T1–T34.

**Functions to implement:** [review task]

**Acceptance criteria:**
- [x] All committed code passes ESLint + Prettier (CQ-05). — `npm run build` lint step exit 0.
- [x] Function lengths ≤ 50 lines (security/validation may extend to 80) (CQ-01). — largest `uploadImageInternal` 75 (validation, ≤80 cap).
- [x] File lengths ≤ 300 (services) or ≤ 200 (components) (CQ-02). — 4 over-cap files fixed (see result note).
- [x] Single responsibility per file (CQ-03). Naming is explicit (CQ-06).
- [x] No magic numbers — every threshold is a named constant with a comment (CQ-04).
- [x] No dead code, no commented-out blocks, no `console.log` debug, no `TODO` left from earlier in the project (CQ-05).
- [x] No duplicated logic (CQ-07). — `padToFloor`, log helpers, `loadCurrentImage`, list components all extracted.
- [x] No accidental O(n²) where O(n) is available (CQ-08).
- [x] Error handling: EH-01 visible-handle-or-rethrow, EH-02 context, EH-03 stack traces, EH-04 concise-vs-detailed, EH-05 custom error types — all PASS.
- [x] All public functions have doc comments (DS-01). — `resolveNavPath` fixed; `cn` exempt (shadcn boilerplate).
- [x] All tests pass (`npm test`). Critical paths happy+error (TS-01/04), behavior names (TS-02), no external deps (TS-03), no shared mutable state (TS-05) — all PASS.

**Tests required:** the existing `npm test` suite must pass.

**Depends on:** T36

**Specialist:** `@code-review`

**Result (2026-05-15, Session 24):** `@code-review` run via 4 parallel review sub-agents (security / EH+DS / CQ / TS+arch+build); gating findings verified by main thread against verbatim `rules/code-quality.md`. Initial verdict **FAIL** — CQ-02 (4 files over cap: `admin-queries.ts` 364, `ImageUpload.tsx` 210, `PostsList.tsx` 204, `ProjectsList.tsx` 201) + CQ-07 (4 dup clusters: `padToFloor` ×4+2-inline, log helpers ×3, `ProjectsList`/`PostsList` ~97%, `loadCurrentImage` ×2) + low DS-01. Builder elected fix-all-now. Fixed via 3 parallel `@dev` sub-agents (strict file ownership; `admin-queries.ts` kept as stable re-export barrel). Post-fix re-verification: build exit 0, Vitest 201/201, Deno 12/0, Server Action manifest holds at 12 IDs, render byte-identical. Final verdict **PASS**. Discharges parked cleanup-queue items #1–#4. Item #5 (OrphanCleanup batch-delete grammar) is CONSTRAINT-13 voice scope — still parked for a content pass, not CQ.

---

## T38 — Documentation audit

**Files:** all `docs/*.md` and `README.md`.

**Functions to implement:** [review task]

**Acceptance criteria:**
- [x] `docs/architecture.md` matches the implementation. Reconciled: §2.4 + §5.2 (migration 008 is bucket-limit source of truth), §5.3 (`STATS_INGEST_SECRET` Edge-Function-only carve-out), §6.6.4 (stale "app/api empty" line), new §6.6.8 (T37 query split + `logQueryError`). Paired with `founder-brief.md` (DS-02).
- [x] `docs/founder-brief.md` has an entry for every architectural decision actually present in code. Added Index rows 24–26 + dated 2026-05-15 entries: query split, migration 008/F-30, `/api/admin/*` self-gate (F-17).
- [x] `docs/constraints.md` matches what is enforced. Audited — all 20 constraints respected by code (spot-checked 04/14/15/19/20); no stale constraint.
- [x] `docs/auth-flow.md` describes the actual flow as built. Reconciled: allowlist enforcement location corrected (callback + sign-in helper, not middleware), logout redirect → `/admin/login`, §2 aligned to §2a, cookie naming softened, header reframed spec → as-built.
- [x] `docs/env-checklist.md` lists every var that is actually checked at startup. Verified exact match with `lib/env.ts` `REQUIRED_ENV_VARS` (4 vars); Category 2–5 behavior accurate.
- [x] `docs/monitoring.md` and `docs/openclaw-config.md` are accurate. Fixed: monitoring.md auth-route path (`/admin/auth/callback`, removed nonexistent `/auth/confirm`); openclaw-config.md stale "Edge Function does not yet exist" status + 400-body `field` note.
- [x] `docs/launch-checklist.md` reflects current operational reality. Resolved OpenClaw self-contradiction per builder decision (DECOUPLE — public site/admin deploy independently of OpenClaw; T39 not blocked on OpenClaw live); added migration-008 apply-at-T39 item; corrected test baseline (Vitest 201/201, Deno 12/0); Playwright reality (unverified, re-run isolated).
- [ ] `README.md` is accurate (DS-05). README **content** audited and accurate (commands vs package.json, env vars, paths, versions — all correct). Fresh-clone runtime verification (clone + `npm run dev` serves :3000) remains the outstanding DS-05 / T33 criterion-4 **manual builder action** — tracked separately, not part of the doc audit.
- [x] No broken links between docs. Verified clean post-edit; `env-vars.md`→`env-checklist.md` and `docs/plan.md`→`docs/plan-index.md` stale refs fixed (plan-phase-1-foundation.md, CLAUDE.md, agents/supabase.md).
- [x] No `TODO` or `[Placeholder]` left in any committed doc (CQ-05 applied to docs). Only benign policy prose remains (the CQ-05 criteria themselves).

**Carried-in reconciliation items (surfaced Session 24, T37 fix pass) — RESOLVED at T38 (2026-05-15):**
- [x] T37 query split + `logQueryError` — documented in new architecture.md §6.6.8 and founder-brief.md entry 24 (architecture.md §6.6.6 is the mutation section; §6.6.6 had no query content — added §6.6.8 instead).
- [x] "Deno 12/1 (1 intentional skip)" figure — not present in architecture/founder-brief/constraints (already accurate there); the only stale live instance was `launch-checklist.md` ("Deno 12/12"), corrected to 12/0. Remaining `12/1` strings are benign reconciliation notes that quote the old value to say it was wrong.
- [x] F-30 / migration 008 — architecture.md §2.4 + §5.2 now name migration 008 as source of truth and note migration 005's trailing comment is superseded-but-immutable; founder-brief.md entry 25 added. (Migration 005 file itself intentionally left unedited — applied migrations are immutable.)
- [x] 3 residual `env-vars.md` refs in `docs/plan-phase-1-foundation.md:513,523,524` — fixed to `docs/env-checklist.md`. architecture.md §5.3 reworded to carve out the Edge-Function-only `STATS_INGEST_SECRET` (comment-only by design).

**T38 decision logged:** Builder decided to DECOUPLE launch from OpenClaw — public site + admin deploy to production independently; OpenClaw ingestion (T29/T31) + verification are post-launch; T39 is NOT blocked on OpenClaw being live (its OpenClaw scope narrows to "stats-ingest path deployed + smoke-verifiable"). `docs/launch-checklist.md` updated accordingly; supersedes the prior "T39 hard-block on OpenClaw" framing in session-handoff/manifest (to be reflected at `@end-session`).

**T38 auth follow-up (non-blocking, recorded — not a task yet):** an optional redundant email-allowlist check could be added to `/admin/*` middleware for defense-in-depth. Not required: enforcement at the callback (`getUser()` round-trip) + sign-in helper is already effective. Documented as a non-blocking note in `docs/auth-flow.md` §3.

**Tests required:**
- Manual link check across all `docs/*.md` files (broken-link audit).

**Depends on:** T37

**Specialist:** none

---

## T39 — Production deploy + DNS cutover

**Files:** all code from prior tasks; Vercel production settings; DNS.

**Functions to implement:** [deployment task]

**Acceptance criteria:**
- [x] Final commit on `main`. Vercel auto-deploy succeeds (verify in dashboard). — S26 (2026-05-16): commits `f8181ae` (docs) + `8d02d93` (code) pushed; Vercel deploy green (`ADMIN_ALLOWED_EMAIL` present — no hard-fail).
- [x] DNS for `swarnimbagre.com` apex and `www` cut over to Vercel. TTL is set sensibly (e.g., 300s for cutover, raise to 3600+ once stable). — S26: domain via Cloudflare, **DNS-only (grey cloud)**; resolves to Vercel `76.76.21.21`.
- [x] HTTPS is live; `http://swarnimbagre.com` redirects to `https://swarnimbagre.com`. — S26: HTTPS + HSTS live. S27 (2026-05-19): Vercel apex primary-flip done; `www → apex` chain verified (`www/admin → 307 → apex/admin → 307 → apex/admin/login → 200`). CONSTRAINT-21 satisfied. Minor non-blocking follow-up: `www → apex` returns 307 (temporary); 308 would be more conventional for permanent canonical moves — single-toggle change in Vercel Domains panel.
- [x] All four public pages return 200 with valid HTML at the production URL. — S26: verified on `www.swarnimbagre.com` (Home/Projects/Writing/Other all 200; `<title>Swarnim Bagre</title>`).
- [x] Mobile UA serves the mobile component variant; desktop UA serves the desktop variant. — S26: verified (desktop 24.6 KB vs mobile 15.0 KB; distinct variants per UA).
- [x] Admin login redirects work; magic link to the configured admin email (`ADMIN_ALLOWED_EMAIL`) lands and produces a working session. — S26: NOT verified (rate-limit cooldown). S27 (2026-05-19): verified live — magic link to `bagreswarnim@gmail.com` lands authenticated; user reaches `/admin/projects` directly via the new `/admin → /admin/projects` redirect.
- [x] Projects, Posts, Stats, Images CRUD all work against production (verified by the T28 flow against the live URL). — S27 (2026-05-19): operator CRUD round-trip done on live (create project → publish → confirm visible on public `/projects` → delete). Same for a post. Images-page anomaly from the 2026-05-15 screenshot resolved: live page renders the orphan-images section with "No orphaned images." empty state correctly — the prior screenshot was stale (pre-fix).
- [~] OpenClaw test message produces a row visible at `/admin/stats` and `/other`. — SUPERSEDED by Decision 1 (S25 decouple): post-launch; T39 scope narrows to "stats-ingest path deployed + smoke-verifiable".
- [x] No console errors on any page in production browser DevTools (CQ-05 in production runtime). — S27 (2026-05-19): operator confirmed clean console pass on live URL across the 4 public pages and the admin landing.

**T39 in-session fixes (S27, 2026-05-19):** Three admin UI bugs surfaced during operator smoke and fixed in commit `5b88f24` before T39 closure: (1) `/admin` index was a blank placeholder → now `redirect('/admin/projects')`; (2) no "New project" / "New post" entry point on list pages → added `newLabel` prop + `<Button asChild><Link href={...}>` in shared `ResourceList.tsx` header (create routes/forms already existed, just not linked); (3) shadcn `Select` popover rendered transparent over the table because Radix portals to `document.body` while `--admin-*` CSS variables lived only on `.admin-root` → moved the 8 tokens to `:root` in `app/styles/admin.css` (dark chrome stays scoped to `.admin-root`). Plus: new `app/(admin)/error.tsx` LOUD-failure boundary closes a gap in the admin segment (no segment-level error.tsx previously). E2E auth fixture + smoke heading assertions updated for the new redirect target (admin-smoke + admin-logout PASS serially; parallel-execution fixture race surfaced as non-blocking post-launch follow-up).

**Tests required:**
- Playwright smoke against the live URL covering: each public page renders; admin login redirects; one full admin flow (create project, view in public list after publish, delete) (TS-04).

**Depends on:** T36, T37, T38

**Specialist:** `@qa`, `@cto`

---

## T40 — Post-launch monitoring + sample content

**Files:** Supabase logs (operational); Vercel analytics (operational); admin panel content.

**Functions to implement:** [operational task]

**Acceptance criteria:**
- [ ] First 24h: Supabase Edge Function logs reviewed daily. Any 5xx or unexpected 401 spike triaged.
- [ ] First 24h: Vercel logs reviewed daily. No unhandled errors.
- [ ] OpenClaw is producing real (non-test) stat rows at the expected cadence.
- [ ] 2–3 real projects added via admin so `/projects` is not empty.
- [ ] 1–2 real posts added via admin so `/writing` is not empty.
- [ ] Voice check on all live copy: no SaaS phrases, no emoji, no LinkedIn-motivational tone (CONSTRAINT-13).
- [ ] Any bug found is logged in `docs/session-log.md` with severity and a follow-up task description.
- [ ] `docs/launch-checklist.md` post-launch section is checked off.
- [ ] Auto-Logging entry written to `docs/session-log.md` documenting the launch (DS-03).

**Tests required:** [operational verification — covered by checklist]

**Depends on:** T39

**Specialist:** `@qa`, `@cto`

---

## T41 — Discoverability + public-route resilience (DEFERRED, trigger-gated)

**Status:** Deferred — trigger-gated. Logged 2026-05-19 (Session 27 follow-up). Not a Phase 4 exit blocker.

**Trigger condition (start when ANY of these is true):**
- About to share the production URL publicly for the first time (Twitter / HN / LinkedIn post / job application / portfolio link in a bio). Run T41 **the day before** so OG previews cache correctly on first share.
- A visitor reports they couldn't find the site by Googling "Swarnim Bagre" and you've given Google ≥3 weeks since the apex flip (2026-05-19) to index naturally.
- A render crash on a public route is discovered after the fact (would also re-trigger T32 Sentry reconsideration).

**Rationale for deferral:** Public site has 0 ambient traffic in week 1 post-launch. Discoverability infra (sitemap, GSC submission, OG previews) and public-route resilience (error boundary, 404 page) have no value until there are visitors to discover the site or to crash on it. Building this now is optimizing for users that do not exist — the same trap that bloats SaaS products pre-PMF. Logged here for visibility; will execute when one of the triggers above fires. Aligns with the T32 deferral pattern (Option B, 2026-05-14): defer infra until evidence of need.

**Files:**
- `app/robots.ts` (create)
- `app/sitemap.ts` (create)
- `app/layout.tsx` (modify — extend Metadata with `openGraph` + `twitter` objects + favicon link)
- `app/opengraph-image.tsx` or `app/opengraph-image.png` (create — 1200×630 image with site name in Fraunces, matching the public bundle palette; consult `@designer` for spec)
- `app/icon.svg` or `app/favicon.ico` (create — wire `site/assets/favicon.svg` to the Next.js app root)
- `app/error.tsx` (create — public-route LOUD-failure error boundary, styled to match the public bundle voice and palette; mirrors `app/(admin)/error.tsx` but with public bundle styling, NOT shadcn)
- `app/not-found.tsx` (create — public 404 page styled to match the bundle; voice-rule compliant per CONSTRAINT-13)
- `docs/founder-brief.md` (modify — add entry for the discoverability + resilience decisions)

**Functions to implement:**
- `robots(): MetadataRoute.Robots` — allow all crawlers, point at sitemap.
- `sitemap(): Promise<MetadataRoute.Sitemap>` — emit static routes (`/`, `/projects`, `/writing`, `/other`) + dynamic published project/post URLs queried from Supabase. Honor `published` status; skip drafts.

**Acceptance criteria:**
- [ ] `app/robots.ts` emits a valid `/robots.txt` allowing all crawlers; references the sitemap URL.
- [ ] `app/sitemap.ts` emits a valid `/sitemap.xml` listing all 4 public root routes + every published project + every published post. Drafts excluded.
- [ ] Open Graph + Twitter Card metadata is set in `app/layout.tsx` (site-wide defaults) and overridden per route on `app/projects/[slug]/page.tsx` + `app/writing/[slug]/page.tsx` (title, description, image).
- [ ] OG image is wired and validates via `https://www.opengraph.xyz/url/https%3A%2F%2Fswarnimbagre.com` or equivalent.
- [ ] Favicon visible in browser tab (no more default Next.js icon).
- [ ] `app/error.tsx` catches client-side render crashes on public routes; styled to match the bundle (no shadcn); message follows voice rules (CONSTRAINT-13: dry, no SaaS phrases, no emoji).
- [ ] `app/not-found.tsx` renders for unknown public URLs; styled to match the bundle; same voice rules.
- [ ] Site verified in Google Search Console (DNS TXT or HTML meta tag method); sitemap submitted via Search Console.
- [ ] `docs/founder-brief.md` has a new entry covering the discoverability decisions (DS-02).
- [ ] No console errors on `/error` or `/not-found` test routes (CQ-05).

**Tests required:**
- `robots() emits expected User-agent and Sitemap directives` (TS-01).
- `sitemap() includes published items and excludes drafts` (TS-01 happy + error).
- Manual: paste production URL into Twitter compose / iMessage / Slack — preview card renders with image, title, description.
- Manual: visit a known-bad URL like `/projects/this-does-not-exist` — `not-found.tsx` renders with bundle styling, not the default Next.js 404.

**Depends on:** T40 (sample content exists, so sitemap has actual rows)

**Specialist:** `@cto`, `@designer` (OG image spec only), `@content-writer` (error + not-found copy per voice rules)

---

## T42 — Project content-model expansion + public-card redesign

**Status:** Sessions A + B + C complete 2026-05-19 (Sessions 29 + 30 + 31). Migration 009 to prod (S29), public render desktop (S30), public render mobile + Override 1 docs + Playwright admin smoke + `@security` audit 18 CLEAR (S31). `@code-review` APPROVED WITH MINOR (2 MAJOR CQ-02 carry-forwards, 3 new MINOR all under Override 1 scope or scaffold). 3 mid-session production bug fixes shipped via Targeted Fix Mode (ProjectImageField duplicate-id, Footer SSR hydration, TypoIcon dead-links). 304/304 vitest. Build clean. Supersedes the parked `docs/content-model-expansion.md` (which proposed a heavier Option C schema with new tables + JSONB — T42 ships a lighter "6 nullable columns, zero new tables" variant after Session 28 brainstorm closed scope; @cto pre-migration consult on 2026-05-19 confirmed Shape A over Shape C).

**Decisions locked in brainstorm (Session 28):**
- Progress: integer percent (0–100), ring visual with auto "full circle + subtle glow" done state at 100. No lifecycle vocabulary.
- Links: 3 fixed nullable URL columns (`github_url`, `live_url`, `post_url`). No `project_links` table.
- Demo image: static images only for v1 (clips deferred post-launch). One project will use before/after slider — handled by new `image_after_id` FK + existing `BeforeAfterMedia.tsx` component.
- Home thumbnail: 6 hand-tuned SVG motifs already in `ProjectThumb.tsx` (`disc | coin | nodes | bars | racquet | dots`). New motifs added in code over time — no migration cost (no CHECK constraint on `thumb_kind`).
- Projects page demo: real screenshots via `image_id`. Bundle's animated `DemoLoop` variants (`rings | bars | wave | agent`) dropped from the data path; code stays in case revived later.
- CONSTRAINT-05 override approved. Documented as Override 1 in `docs/design-decisions.md` + `docs/founder-brief.md`.

**Files:**

*Schema + types:*
- `supabase/migrations/009_projects_content_model.sql` (create) — 6 ALTER TABLE ADD COLUMN statements, all nullable, with CHECK on `progress_percent` only.
- `lib/types.ts` (modify) — extend `Project` interface with 6 new optional fields.

*Server Actions + validation:*
- `lib/admin-projects-mutations.ts` (modify) — `createProject` + `updateProject` accept the 6 new fields.
- `lib/admin-projects-mutations-types.ts` (modify) — extend `ProjectMutationState` `fieldErrors` to cover new fields.
- Zod schema for project mutations (currently inline; locate and extend) — validates URL format (HTTPS only for external; relative path allowed for `post_url`), percent bounds, `thumb_kind` against a code-side enum.

*Admin form:*
- `components/admin/ProjectForm.tsx` (modify) — add 6 inputs: 3 URL fields, 1 number input (percent), 1 Select dropdown (thumb_kind), 1 ImageUpload for `image_after_id`. **If file exceeds CQ-02 200-line cap, split into sub-components** (`ProjectFormUrls`, `ProjectFormVisuals`).
- `lib/thumb-kinds.ts` (create) — exports `THUMB_KIND_OPTIONS` array used by both admin dropdown and render-side fallback logic. Source of truth so adding a motif is a 1-line array push + `ProjectThumb.tsx` motif addition.

*Public render — components:*
- `components/public/ProgressRing.tsx` (create) — SVG with two strokes: faint background ring + accent-colored arc via `stroke-dasharray`. Auto-renders done glow when percent = 100. ~80 lines.
- `components/public/ProjectRow.tsx` (modify) — render `ProgressRing` (replacing bundle's `StatusPill`), render 3 conditional buttons (github / live / post), keep `ProjectThumb` thumbnail.
- `components/public/ProjectMedia.tsx` (modify) — switch logic: use `image_id` for still kind, use `image_id` + `image_after_id` for before-after slider via existing `BeforeAfterMedia.tsx`. Remove DemoLoop integration from the data path.

*Public render — pages:*
- `components/public/pages/Home.tsx` (modify) — replace hardcoded `featured` array with DB-driven props from `getPublishedProjects()`; pass `thumb_kind` to `ProjectRow`.
- `components/public/pages/Projects.tsx` (modify) — same; remove DemoLoop usage; use real screenshots.
- `components/public/mobile/MobileProjectCard.tsx` (modify) — mirror desktop ProjectRow changes.
- `components/public/mobile/MobileProjectRow.tsx` (modify) — mirror desktop changes.
- `components/public/mobile/pages/Home.tsx` (modify) — mirror desktop Home.
- `components/public/mobile/pages/Projects.tsx` (modify) — mirror desktop Projects.

*Public data loader:*
- `lib/safe-load.ts` and/or `lib/public-projects.ts` (locate + modify) — extend the project loader to SELECT the 6 new columns. Respect CONSTRAINT-14 (must go through `safe-load`).

*Docs:*
- `docs/design-decisions.md` (modify) — add "Override 1: project card redesign" entry: rationale, what changed, what stayed (palette, typography, voice).
- `docs/founder-brief.md` (modify) — add architectural entry for the decision (DS-02 compliance).
- `docs/architecture.md` (modify) — update §2 (data model) with new columns.
- `docs/constraints.md` (modify) — note CONSTRAINT-05 has Override 1 (link).
- `docs/content-model-expansion.md` (modify) — mark as SUPERSEDED by T42 with a pointer to this task.

**Functions to implement:**
- `ProgressRing({ percent, size }): JSX.Element` (~80 lines, CQ-01) — SVG ring with two strokes; done-state glow when `percent === 100`; `null` percent renders nothing.
- `getPublishedProjects(): Promise<Project[]>` (extended) — SELECT including new columns; respects CONSTRAINT-14.
- Zod schema extensions — URL validation (must start `https://` or `/` for relative `post_url`), percent bounds (`int().min(0).max(100).nullable()`), thumb_kind against code-side enum.

**Acceptance criteria:**

*Schema:* — **Session A complete**
- [x] Migration 009 applies cleanly to dev + production Supabase projects. Idempotent (uses `add column if not exists` or guard). — applied 2026-05-19 via `mcp__supabase__apply_migration` to project `oosretprveorrjzjcbxb`.
- [x] All 6 columns nullable; only `progress_percent` has a CHECK constraint (`between 0 and 100`).
- [x] `image_after_id` FK references `images(id) on delete set null` (matches existing `image_id` pattern).
- [x] RLS policies on `projects` already cover read access to all columns — no new policies needed (verified against migration 002).

*Admin form:* — **Session A complete** except Playwright smoke (Session C)
- [x] All 6 new fields render in `ProjectForm.tsx` (image fields edit-only, matching `image_id` precedent).
- [x] Zod validation catches: invalid URL format on the 3 URL fields, percent out of range, unknown thumb_kind value. (20 schema tests in `tests/admin-projects-mutations-schemas.test.ts`.)
- [x] `ImageUpload` for `image_after_id` uses the same `parentType: 'projects'` + `parentId` binding as primary image — via new shared `ProjectImageField.tsx`.
- [x] `ProjectForm.tsx` stays ≤200 lines (CQ-02) — split into `ProjectFormLinks.tsx` + `ProjectFormDisplay.tsx` + `ProjectImageField.tsx`. Final: 200 lines exactly.
- [x] Save round-trip works for all new fields (verified via Playwright admin smoke test). — **Session C.** Verified 2026-05-19 via T42 desktop home + /projects + /projects/[slug] + mobile /projects + mobile /projects/[slug] Playwright steps in `tests/e2e/admin-smoke.spec.ts`.

*Public render — desktop:* — **Session B complete (Session 30, 2026-05-19)**
- [x] Home page renders DB-driven projects (not hardcoded `featured` array) — verify by adding a test project via admin and seeing it on home. (Wiring done; admin-add Playwright verification = Session C.)
- [x] Projects page renders real screenshot (from `image_id`) instead of `DemoLoop` animation.
- [x] `ProgressRing` renders correctly at 0, 25, 50, 75, 100. Done glow visible only at 100. (12 tests in `tests/ProgressRing.test.tsx`.)
- [x] 3 buttons (github / live / post) render only when their URL column is non-null. Hidden otherwise. (TypoIcon bundle labels `{ } code` / `↗ site` / `¶ notes` kept per Session 30 builder decision; CONSTRAINT-05 honored without Override 2.)
- [x] Bundle's `StatusPill` no longer renders on project cards.

*Public render — mobile:*
- [x] All desktop changes mirrored on mobile components. Mobile project-card surface (`MobileProjectCard`, `MobileProjectRow`) shipped with ProgressRing + 3 TypoIcon buttons + ProjectThumb. Mobile pages `Home` (project-card region absent per bundle design) + `Projects` (DB-driven). Decision logged in session-log.
- [x] Mobile-specific layout regression-checked via Playwright. iPhone-UA context test verifies MobileProjectCard render on `/projects` + `/projects/[slug]`.

*Before/after slider:* — **Session B complete (Session 30, 2026-05-19)**
- [x] When `image_after_id` is non-null, `BeforeAfterMedia` renders the slider with both images. (`beforeUrl` + `afterUrl` props added; bundle CSS fallback scenes retained for design-source consistency, pushed file to 226 lines — CQ-02 MINOR carry-forward.)
- [x] When `image_after_id` is null, falls back to static image. (Implementation deviation: bundle's `StillMedia` had no image input slot, so the still path uses a direct `<img>` matching `renderRealImage` styling in BeforeAfterMedia. Per @code-review: falls under Override 1, no new deviation. `StillMedia` file retained, not in data path on desktop.)

*Docs:*
- [x] `docs/design-decisions.md` Override 1 entry written with rationale.
- [x] `docs/founder-brief.md` architectural entry added (DS-02). Recorded as entry #28 (next sequential slot).
- [x] `docs/architecture.md` §2 updated. §2.1 schema rows for 6 new columns + new §5.4 Reproducibility-debt section.
- [x] `docs/content-model-expansion.md` marked SUPERSEDED with link to T42.

*Quality gates:* — **Session A green; will re-verify after Sessions B + C land render code**
- [x] `npm run build` clean (CQ-05). No console errors in production runtime. — Session A gate.
- [x] `npm test` 100% passing — Session A gate. 223/223 vitest. (Also caught + fixed a T39 admin-home test regression that pre-dated Session A.)
- [x] Voice check on any new operator-facing labels (CONSTRAINT-13). — Session A labels: "GitHub URL / Live URL / Post URL / Progress / Thumbnail / After image (before/after slider) / Saved." — all dry, no SaaS phrases, no emoji.

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

**Blocks:** T40 content-addition criteria — projects added before T42 ships will render with the schema gaps (StatusPill instead of ring, no buttons, bundle DemoLoop instead of real image). T40's other criteria (24h log review, voice-check, launch-checklist post-launch section, DS-03 launch entry) are NOT blocked by T42.

**Specialist:** `@dev` (execution), `@cto` (review schema choice before migration), `@code-review` (post-execution gate), `@security` (verify zod URL validation closes XSS-via-link vectors, since `live_url` becomes a user-controlled `href` attribute).

**Estimated effort:** 2–3 focused sessions.
- Session A: migration + types + Server Actions + zod + admin form + form tests
- Session B: ProgressRing + ProjectRow desktop + Home desktop + Projects desktop + their tests
- Session C: mobile mirrors + docs + Playwright smoke + final review

If a session ends mid-task, the schema migration (Session A) must complete before any render work; rendering against missing columns is a known fail mode.

---

## T43 — Project media multi-image carousel

**Source:** `docs/prd.md` §2.3 + §2.3a (canonical carousel surface) + §3.5 (admin write surface) + §3.5a (post image carve-out) + §5 (data model) + §7.2 (out of scope).

**Files:**

*Schema:*
- `supabase/migrations/010_project_media.sql` (create)

*Types + queries:*
- `lib/types.ts` (modify) — add `ProjectMedia` + `PublicProjectMediaItem` interfaces; deprecation comment on `Project.image_id` / `image_after_id`.
- `lib/db.ts` (modify) — add public-side `getProjectMediaByProject(projectId)` returning ordered rows; respects `images_public_select` RLS.
- `lib/admin-queries-project-media.ts` (create) — admin-side read with the same shape; uses authenticated client.
- `lib/admin-queries.ts` (modify) — re-export new `admin-queries-project-media` symbols (barrel).
- `lib/admin-queries-projects.ts` (modify) — extend admin-side read to optionally include media count for list view warning indicator.
- `lib/public-project-media.ts` (create) — public resolver `loadPublicProjectMedia(projectId)` with signed URLs, per-row failure isolation mirroring `lib/public-projects.ts`.
- `lib/public-projects.ts` (modify) — extend `PublicProject` with `media: PublicProjectMediaItem[]`; backfill `imageUrl` / `imageAfterUrl` from legacy columns when `media.length === 0` (fallback).

*Server Actions + validation:*
- `lib/admin-project-media-mutations.ts` (create — `'use server'` wrapper module per `architecture.md` §6.6.6 trio, exports `saveProjectMedia` only).
- `lib/admin-project-media-mutations-internal.ts` (create — throwing helpers, zod parse, slot writes).
- `lib/admin-project-media-mutations-types.ts` (create — client-safe state envelope + field-name union).
- `lib/admin-project-media-mutations-schemas.ts` (create — zod schemas).
- `lib/admin-images-mutations-internal.ts` (modify) — extend `uploadImageInternal` to accept optional `attachToProjectMediaRow` parameter (or document path: still upload independently, then bind via `addProjectMedia`).

*Admin form:*
- `components/admin/ProjectMediaField.tsx` (create — multi-row controller, replaces the two `ProjectImageField` slots inside `ProjectForm`).
- `components/admin/ProjectMediaRow.tsx` (create — single row: caption, alt, "single" / "pair" image slots, drag handle, delete).
- `components/admin/ProjectForm.tsx` (modify) — replace the two `ProjectImageField` blocks with one `ProjectMediaField`; keep image FK fields on `projects` row as legacy/deprecated (do NOT remove yet — backward-compat).
- `components/admin/ImageUpload.tsx` (modify) — CQ-02 MAJOR refactor opportunity (227 lines). Split into `ImageUpload.tsx` (orchestration ≤200) + `ImageUploadPreview.tsx` + `ImageUploadFileInput.tsx`.

*Public render — components:*
- `components/public/ProjectMediaCarousel.tsx` (create — `'use client'`, embla wrapper, first JS lib on public site).
- `components/public/BeforeAfterMedia.tsx` (modify) — CQ-02 MAJOR refactor opportunity (226 lines). Split bundle-fallback CSS scenes from real-image path; carousel uses real-image path only.
- `components/public/ProjectMedia.tsx` (modify) — accept new `media: PublicProjectMediaItem[]` prop; when present, render `ProjectMediaCarousel`; when empty, fall back to current legacy single-image branching.
- `components/public/ProjectCard.tsx` (modify) — pass `media` through to `ProjectMedia`; backward-compatible additive prop per CONSTRAINT-05's additive-prop carve-out (when `media` undefined, render legacy).
- `components/public/mobile/MobileProjectCard.tsx` (modify) — mirror desktop changes.

*Public render — pages:*
- `app/projects/page.tsx` (modify) — extend list loader to include `media` per project; pass through.
- `app/projects/[slug]/page.tsx` (modify) — extend detail loader to include `media`; pass through to `ProjectCard` / `MobileProjectCard`.

*Tests:*
- `tests/ProjectMediaCarousel.test.tsx` (create).
- `tests/admin-project-media-mutations-schemas.test.ts` (create).
- `tests/server-actions-manifest.test.ts` (modify) — extend the 12-ID allowlist by 1 (new `saveProjectMedia` Server Action; total 13).

*Docs:*
- `docs/design-decisions.md` (modify) — add Override 2 entry (drafted at T43.A, finalized at T43.I).
- `docs/constraints.md` (modify) — add CONSTRAINT-22; amend CONSTRAINT-05 with Override 2 cross-link.
- `docs/architecture.md` (modify) — §1.2 dep line (T43.B); §2.5 new `project_media` schema subsection + §4.9 Carousel surface boundary subsection (T43.I).
- `docs/founder-brief.md` (modify) — Index row + dated entry for the project media carousel + first public-site JS library decision.
- `docs/content-model-expansion.md` (modify) — T43-furthered-by line at top (already SUPERSEDED by T42).
- `manifest.md` (modify) — update Phase 4 status row at T43.I.

**New dependency:** `embla-carousel-react` ^8 — NOT currently in `package.json`. Confirmed via dependency check. T43.B installs it.

**Migration number:** 010 (last applied: 009).

**Risks:**

1. First JS library on the public site (Override 2). Embla becomes the precedent for "when is a public-site JS dep acceptable." Override 2 docs need a JS-lib-on-public-site policy boundary (tree-shakeable, no global styles, runtime size budget under ~10 KB gzipped — embla core+react is ~5 KB). Defer Override 2 docs to T43-close mirroring Override 1 → T42-close pattern.

2. CQ-02 carry-forward refactor scope creep. `ImageUpload.tsx` (227) and `BeforeAfterMedia.tsx` (226) are flagged in S31 handoff. They are touched naturally by T43. Recommend: include the splits as discrete acceptance criteria inside T43.F / T43.G rather than letting them bloat. Risk if not split discretely: T43 commits become large and reviewable-only-in-aggregate.

3. Multi-instance carousel DOM ID collisions on `/projects` list view (carried-from-S31 framework-issues note). N project cards = N embla instances on one page. Each needs `React.useId()`-scoped `aria-controls` / `aria-labelledby` / dot button IDs. Concretely flagged in `tests/ProjectMediaCarousel.test.tsx` acceptance criteria.

4. Migration 010 + `projects.image_id` deprecation. New uploads route through `project_media`; reads fall back to legacy `image_id` / `image_after_id` when no `project_media` rows exist. The legacy columns stay in the schema (don't drop in 010) — admin form keeps them as the "single primary image" path until all existing projects are migrated. Backward-compatibility window is intentional; no end-date set.

5. Storage bucket. T43 reuses the existing `images` bucket per `architecture.md` §2.4. No new bucket → no new `storage.objects` policy needed → CONSTRAINT-20 is N/A for this migration. The new `project_media` table itself gets default-deny RLS + admin-all + public-select-when-parent-published.

6. DB CHECK constraint for ≤20 rows per project_id. PostgreSQL CHECK constraints are per-row, not per-FK-count. Resolution: enforce via a `BEFORE INSERT` trigger that counts rows on that `project_id` and raises if `>= 20`. App-level zod also enforces 20 as a defense layer.

7. In-flight `@designer` decisions (4 from S32 handoff). Aspect-ratio (PRD default: 16:9 letterbox `object-fit: contain`), caption visual treatment, compact card chrome (dot/arrow sizing), mobile touch-conflict (embla direction-lock). These are CONSULT-blocking work; if `@designer` overrides the PRD default aspect-ratio, slot-render code rewires. Mitigation: T43.A `@designer` consult runs BEFORE T43.F (admin) and BEFORE T43.G (carousel).

8. Client-component boundary. `ProjectMediaCarousel` MUST be `'use client'` (embla requires it). `ProjectCard` is already `'use client'`. The chain is uniform.

9. Server Action atomicity. PRD §3.5 G/W/T says reorder persists on form Save (not auto-save). Decision: one atomic Server Action `saveProjectMedia(projectId, mediaRows[])` rather than per-row CRUD actions. Inner helper does delete-then-insert-all inside a single Postgres transaction. The wire-level allowlist grows by exactly 1 action ID.

10. Detail-page boundary with posts. PRD §3.5a clarifies posts keep single-image upload. `app/writing/[slug]/page.tsx` and `components/admin/PostForm.tsx` are untouched by T43.

**Architectural questions:** None blocking.

**Critical assumptions to flag:**
- `embla-carousel-react` v8+ is stable, tree-shakeable, MIT-licensed, with React 19 / Next 15 support. Well-established library; not formalized as a critical assumption. Bundle-size check is part of T43.B acceptance.

---

### Task T43.A: @designer consult — Override 2 surface, carousel UX decisions

**Files:**
- `docs/design-decisions.md` — modify (add "Override 2: Public site JS library + carousel chrome" draft section, pre-execution; final Override 2 entry lands at T43.I)
- No code files.

**Functions to implement:** Consultation task — no code.

**Acceptance criteria:**
- [x] Aspect-ratio policy resolved. Default proposal: 16:9 letterbox with `object-fit: contain` over `var(--surface)` background. `@designer` either confirms or specifies an alternative.
- [x] Caption visual treatment specified: type size token (PRD says "muted meta type" — pick from `colors_and_type.css`), color token, position (below slide vs overlaid), padding values in px.
- [x] Compact card-carousel chrome sized: dot size, dot spacing, arrow size, arrow position on `/projects` list cards (smaller container) vs detail-page card (larger container). Spec gives px values.
- [x] Mobile touch-conflict resolution confirmed: embla `dragFree: false` + `direction: 'horizontal'` + `axis: 'x'`; vertical page scroll wins below ~10° touch angle (embla default). Pair-row drag-handle priority spec'd.
- [x] First-class Override 2 boundary defined in draft: which files fall under Override 2 (list mirrors Override 1's surface boundary block). Anchors are `ProjectMediaCarousel.tsx` + the embla dependency itself.
- [x] CONSTRAINT-13 voice check passes for any new chrome labels (arrows: `←` `→` typographic glyphs only, no "Previous" / "Next" prose; dots: `aria-label="Slide 1"` etc., not "Go to slide 1" — short ARIA strings).

**Tests required:** Consultation task — no tests.

**Depends on:** None. First task in T43.

**Specialist:** `@designer`

---

### Task T43.B: Add `embla-carousel-react` dependency + bundle-size baseline

**Files:**
- `package.json` — modify (add `embla-carousel-react` ^8 to `dependencies`)
- `package-lock.json` — modify (install)
- `docs/architecture.md` §1.2 — modify (add embla to "Frontend libraries — Public site" subsection; one line)

**Functions to implement:** None (dep-add task).

**Acceptance criteria:**
- [ ] `npm install embla-carousel-react@^8` runs clean. No peer-dependency warnings against React 19 / Next 15.
- [ ] `npm run build` succeeds with the dep installed (sanity check: addition itself doesn't break the build).
- [ ] Bundle size delta documented in the T43.B commit message: `embla-carousel-core` + `embla-carousel-react` baseline (~5 KB gzip expected). If >10 KB gzipped, stop and revisit Override 2 budget with `@cto`.
- [ ] `architecture.md` §1.2 lists embla under "Public site" — explicit acknowledgment that the public site now carries one JS lib (was: "raw React + custom components, no library").
- [ ] No `eslint`-related blocker (no ESLint config in repo — non-blocking).
- [ ] Voice check: any new operator-facing label introduced is dry, no SaaS phrasing (CONSTRAINT-13). Dep-add itself has no labels.

**Tests required:** None (dep-add task).

**Depends on:** T43.A

**Specialist:** none (dep-add; `@cto` sanity-check only if bundle exceeds budget)

---

### Task T43.C: Migration 010 — `project_media` table + RLS + indexes + row-cap trigger

**Files:**
- `supabase/migrations/010_project_media.sql` — create

**Functions to implement:** SQL only.

**SQL surface (the migration creates):**
- `create table public.project_media (id uuid primary key default gen_random_uuid(), project_id uuid not null references projects(id) on delete cascade, image_id uuid not null references images(id) on delete restrict, image_after_id uuid null references images(id) on delete restrict, caption text null check (caption is null or char_length(caption) <= 280), order_index integer not null check (order_index >= 0), created_at timestamptz not null default now())`
- Compound index: `(project_id, order_index)` for ordered fetches.
- `alter table public.project_media enable row level security;`
- Policy `project_media_public_select` — role `anon`, FOR SELECT, USING `(exists (select 1 from projects where projects.id = project_media.project_id and projects.status = 'published'))` (mirrors `images_public_select` join shape).
- Policy `project_media_admin_all` — role `authenticated`, FOR ALL, USING `true`, WITH CHECK `true`.
- `BEFORE INSERT` trigger `project_media_rowcap_trigger`: counts existing rows for `NEW.project_id`; if `>= 20`, raise exception `project_media row cap exceeded`.

**Acceptance criteria:**
- [ ] Migration applies cleanly to the dev/prod Supabase project via `mcp__supabase__apply_migration`. Idempotent guards (`if not exists`) on table + policies + trigger.
- [ ] All FKs use sensible delete behavior: `project_id` → cascade (deleting a project deletes its media rows); `image_id` / `image_after_id` → restrict (deleting an image with a `project_media` reference is blocked — admin must remove the row first, mirroring CONSTRAINT-07's parent-FK discipline).
- [ ] RLS verified: anon SELECT of a `project_media` row whose parent project is `status='draft'` returns 0 rows. Anon SELECT for `status='published'` parent returns rows. Authenticated CRUD passes (SEC-04, CONSTRAINT-08).
- [ ] Row-cap trigger verified: insert 20 rows for one project_id → succeeds. 21st insert → raises. Bulk insert of 21 in a single statement → raises and rolls back the entire statement.
- [ ] No new Storage bucket / no new `storage.objects` policy needed (reuses `images` bucket). CONSTRAINT-20 N/A for this migration; noted in migration comment header.
- [ ] Compound index `(project_id, order_index)` confirmed via `\d project_media` or `pg_indexes`.
- [ ] Existing `projects.image_id` / `image_after_id` columns left in place (backward-compat). Migration header comment documents the deprecation-in-progress.

**Tests required:**
- Manual: apply to dev DB, run inserts to confirm RLS + trigger behavior. Logged in `docs/session-log.md`.
- No Vitest tests for migrations themselves (matches project precedent — migration 009 had none).

**Depends on:** T43.A (caption hard-cap 280 — PRD-default if no override).

**Specialist:** `@supabase` (schema author), `@cto` (review before apply — mirroring T42 pre-migration consult)

---

### Task T43.D: TypeScript types + public/admin queries + signed-URL resolver

**Files:**
- `lib/types.ts` — modify (add `ProjectMedia` interface, `PublicProjectMediaItem` interface; deprecation comment on `Project.image_id` / `image_after_id`)
- `lib/db.ts` — modify (add `getProjectMediaByProject(projectId: string, client?: SupabaseClient): Promise<ProjectMedia[]>`)
- `lib/admin-queries-project-media.ts` — create (admin-side read with the same shape; uses authenticated client)
- `lib/admin-queries.ts` — modify (re-export `getProjectMediaByProjectAdmin` from the new module — barrel pattern per §6.6.8)
- `lib/public-project-media.ts` — create (`loadPublicProjectMedia(projectId): Promise<PublicProjectMediaItem[]>` — fetches rows + resolves signed URLs per item; per-row failure isolation mirroring `lib/public-projects.ts::resolveImageUrl`)
- `lib/public-projects.ts` — modify (extend `PublicProject` with `media: PublicProjectMediaItem[]`; populate via `loadPublicProjectMedia` per project; preserve legacy `imageUrl` / `imageAfterUrl` for the empty-media fallback path)

**Functions to implement:**
- `getProjectMediaByProject(projectId: string, client?: SupabaseClient): Promise<ProjectMedia[]>` — `lib/db.ts`. Returns ordered by `order_index ASC`. Throws `ServiceError` on DB error. Mirrors `getPublishedProjects` shape.
- `getProjectMediaByProjectAdmin(projectId: string, client?: SupabaseClient): Promise<ProjectMedia[]>` — `lib/admin-queries-project-media.ts`. Same shape; uses admin client. Uses shared `logQueryError` per §6.6.8.
- `loadPublicProjectMedia(projectId: string): Promise<PublicProjectMediaItem[]>` — `lib/public-project-media.ts`. Resolves signed URLs for `image_id` + `image_after_id` per row (TTL 3600s, CONSTRAINT-15). Returns `[]` (not throw) when project has zero rows.

**`ProjectMedia` interface (snake_case to mirror DB row):**
```
interface ProjectMedia {
  id: string;
  project_id: string;
  image_id: string;
  image_after_id: string | null;
  caption: string | null;
  order_index: number;
  created_at: string;
}
```

**`PublicProjectMediaItem` interface (render-ready):**
```
interface PublicProjectMediaItem {
  id: string;
  imageUrl: string | null;
  imageAlt: string;
  imageAfterUrl: string | null;
  imageAfterAlt: string | null;
  caption: string | null;
  orderIndex: number;
}
```

**Acceptance criteria:**
- [ ] All new exports have JSDoc (DS-01).
- [ ] `getProjectMediaByProject` is wrapped via `safeLoad` at call sites (page-level Server Components only — CONSTRAINT-14). The function itself throws `ServiceError`.
- [ ] `loadPublicProjectMedia` does NOT use `safeLoad` internally (CONSTRAINT-14 carve-out — `safeLoad` is boundary-only). Per-item URL failures are caught + logged + nulled (mirror existing `resolveImageUrl` pattern in `lib/public-projects.ts`).
- [ ] No raw SQL string concatenation (SEC-03 — use Supabase query builder).
- [ ] `lib/types.ts` deprecation comments on `Project.image_id` / `image_after_id` reference T43 + the migration plan (backward-compat window open-ended).
- [ ] File sizes: `lib/db.ts` stays ≤300; `lib/admin-queries-project-media.ts` ≤200; `lib/public-project-media.ts` ≤200 (CQ-02).
- [ ] Function sizes ≤50 lines each (CQ-01).

**Tests required:**
- `tests/db.test.ts` describe `getProjectMediaByProject` → happy path (returns ordered media for a project with rows) + error case (Supabase error throws `ServiceError`) (TS-01).
- `tests/public-project-media.test.ts` describe `loadPublicProjectMedia` → happy path (rows resolve to signed URLs in order) + per-item resolution failure (one bad image_id nulls only that item's URL, other items unaffected) (TS-01).
- `tests/admin-queries-project-media.test.ts` describe `getProjectMediaByProjectAdmin` → happy path + DB error (logged via `logQueryError`, returns empty/typed result per §6.6.8) (TS-01).

**Depends on:** T43.C

**Specialist:** `@supabase` (query shape sanity-check)

---

### Task T43.E: Server Action — `saveProjectMedia` (atomic save-all) + zod schemas

**Files:**
- `lib/admin-project-media-mutations.ts` — create (`'use server'`, exports `saveProjectMedia` only — 1 new action ID)
- `lib/admin-project-media-mutations-internal.ts` — create (throwing helpers, transaction wrapper)
- `lib/admin-project-media-mutations-types.ts` — create (`ProjectMediaMutationState`, `ProjectMediaFieldName` union, initial state)
- `lib/admin-project-media-mutations-schemas.ts` — create (zod schemas: per-row + payload-level row count ≤20)
- `tests/server-actions-manifest.test.ts` — modify (add `saveProjectMedia` to the allowlist; baseline goes from 12 → 13 IDs)

**Functions to implement:**
- `saveProjectMedia(prevState: ProjectMediaMutationState, formData: FormData): Promise<ProjectMediaMutationState>` — Server Action. Reads `projectId` + serialized `rows` (JSON array string in a hidden field; client builds it from form state). Wraps `saveProjectMediaInternal` in the four-channel uniformity contract (try/catch, `padToFloor`, ZodError → fieldErrors, other → `formError`).
- `saveProjectMediaInternal(projectId: string, raw: unknown): Promise<void>` — `lib/admin-project-media-mutations-internal.ts`. Zod-parses raw payload. Runs delete-all-then-insert-all for `projectId` inside a single Supabase RPC or sequential transaction. On any failure, throws — wrapper catches.
- `parseProjectMediaPayload(raw: unknown): { projectId: string; rows: ProjectMediaInput[] }` — `lib/admin-project-media-mutations-schemas.ts`. Validates: each row has valid UUID `image_id`, optional UUID `image_after_id`, optional caption ≤280 chars, valid integer `order_index`; total `rows.length <= 20`; row `order_index` values are unique 0..N-1 dense.

**`ProjectMediaMutationState` envelope:**
```
interface ProjectMediaMutationState {
  status: 'idle' | 'ok' | 'error';
  fieldErrors?: Partial<Record<string, string>>;
  formError?: string;
}
```

**Acceptance criteria:**
- [ ] `lib/admin-project-media-mutations.ts` exports ONLY `saveProjectMedia` — no helpers (per §6.6.6 wrapper-only-exports rule).
- [ ] `saveProjectMedia` applies the four-channel uniformity contract: try/finally `padToFloor` (Channel 3); try/catch with ZodError → `fieldErrors`, other → generic `GENERIC_FORM_ERROR` (Channels 1/2); no rethrow to wire (Channel 6); no `Set-Cookie` writes (Channel 5).
- [ ] Internal helper validates UUID format on `projectId`, `image_id`, `image_after_id` (SEC-02).
- [ ] Atomic delete-then-insert: if the insert phase fails after the delete, the helper must throw a clear error AND restore prior state. Implementation: Supabase RPC function `save_project_media(p_project_id uuid, p_rows jsonb)` in migration 010 (or extracted to a follow-on migration 010a) wraps both in one Postgres transaction. Decision point: if the RPC route adds complexity, sequential-with-rollback-on-error is acceptable as long as the failure case is documented + tested. Builder picks at T43.E start.
- [ ] Row-count enforcement at zod boundary (`rows.length <= 20`) — defense layer to the DB trigger from T43.C.
- [ ] CONSTRAINT-10 hard-delete semantics preserved: this Server Action deletes-and-replaces `project_media` rows; orphan `images` rows from removed media are cleaned up by the existing `/admin/images` orphan sweep (T27, no changes here).
- [ ] `tests/server-actions-manifest.test.ts` allowlist extended to 13 IDs (SEC-09 / §6.6.5).
- [ ] No real secrets in any committed file (SEC-01, SEC-07).
- [ ] File sizes: each ≤200 (types/schemas) or ≤300 (internal/wrapper) per CQ-02. Function sizes ≤80 for validation, ≤50 elsewhere (CQ-01).
- [ ] Voice check on operator-facing labels: "Save", "Saved." — dry, CONSTRAINT-13.

**Tests required:**
- `tests/admin-project-media-mutations-schemas.test.ts` → happy path (valid payload), error cases (caption >280 char, row count >20, non-UUID image_id, non-dense order_index, missing image_id on a row) (TS-01).
- `tests/admin-project-media-mutations.test.ts` → describe `saveProjectMedia` → happy path (envelope returns `{status: 'ok'}`), error case (DB throw → `{status: 'error', formError}`), validation error (returns `{status: 'error', fieldErrors}`) (TS-01).
- Manifest assertion: `tests/server-actions-manifest.test.ts` confirms exactly 13 action IDs post-T43.

**Depends on:** T43.C, T43.D

**Specialist:** `@supabase` (RPC / transaction shape review)

---

### Task T43.F: Admin component — `ProjectMediaField` + `ProjectMediaRow`

**Files:**
- `components/admin/ProjectMediaField.tsx` — create (orchestrates the rows array; "+ image" / "+ pair" buttons; drag-reorder; hidden `rows` JSON field; over-cap warning)
- `components/admin/ProjectMediaRow.tsx` — create (single row UI: caption input, alt input(s), 1 or 2 `ImageUpload` slots, drag handle, delete button)
- `components/admin/ProjectForm.tsx` — modify (replace the two `ProjectImageField` blocks with one `<ProjectMediaField ...>`; keep `id` hidden input + `status` etc unchanged)
- `components/admin/ImageUpload.tsx` — refactor for CQ-02 (split into `ImageUpload.tsx` ≤200 + `ImageUploadPreview.tsx` + `ImageUploadFileInput.tsx`). In-scope opportunity per S31 handoff CQ-02 MAJOR carry-forward.

**Functions to implement:**
- `ProjectMediaField({ projectId, initialMedia }: ProjectMediaFieldProps): React.ReactElement` — top-level field component. Owns `rows` state. Renders header buttons + map of `ProjectMediaRow`. Serializes rows to hidden `<input name="rows" type="hidden" value={JSON.stringify(rows)}>`. Renders soft-warning when `rows.length > 10` and hard-block save when `>20`.
- `ProjectMediaRow({ row, index, onChange, onDelete, onDragStart, onDrop }: ProjectMediaRowProps): React.ReactElement` — single-row UI. For a "single" row: one `ImageUpload` + alt input + caption. For a "pair" row: two `ImageUpload`s + two alt inputs + caption.
- Drag-reorder helper: HTML5 drag-and-drop API (no new dependency). Each row is `draggable`; `onDrop` recomputes `order_index` densely.

**Acceptance criteria:**
- [ ] PRD §3.5 G/W/T all pass in admin smoke:
  - 5 MB cap enforced on every upload (per existing `ImageUpload` precheck).
  - Required `alt_text` enforced per image (single OR pair, both slots).
  - Caption soft-warning ≥140 chars, hard-block at 280 (server-side via zod, client-side soft-warn via inline counter).
  - Soft-warning visible at 11+ rows; hard-block save at 21+ rows.
  - Drag-reorder updates visual order; persistence on form Save only (no auto-save).
  - Per-row delete + confirm modal (reuse existing `DeleteConfirmModal`).
- [ ] Upload of a successful image lives at `images/projects/{project_id}/{uuid}_{filename}` (CONSTRAINT-07).
- [ ] Saved `project_media` rows insert with `bucket_path`, `alt_text`, `parent_id`, `parent_type='projects'` (CONSTRAINT-07).
- [ ] `ProjectMediaField.tsx` ≤200 lines (CQ-02). `ProjectMediaRow.tsx` ≤200 lines.
- [ ] `ImageUpload.tsx` post-refactor ≤200 lines (closes S31 CQ-02 MAJOR carry-forward).
- [ ] `ProjectForm.tsx` stays ≤200 lines post-modify.
- [ ] All operator labels CONSTRAINT-13 voice-clean: "+ image" / "+ pair" / "Delete" / "Save" / "Trim to 20 rows" — dry, no emoji, no SaaS.
- [ ] Multi-instance DOM ID hygiene: each `ImageUpload` inside a row uses `React.useId()` for input element IDs.
- [ ] Component file shapes follow existing admin conventions: shadcn primitives (Label, Input, Textarea, Select, Button); no public-site CSS variables.
- [ ] Nested `<form>` discipline preserved (§6.6.7) — `ProjectMediaField` is rendered inside `ProjectForm`'s `<form>` element; `ImageUpload` instances stay `<div>`-wrapped per existing pattern.

**Tests required:**
- `tests/ProjectMediaField.test.tsx` describe → happy path (renders initial rows in order; add image button creates new row; delete button removes row; over-cap warning renders at 11+) (TS-01).
- `tests/ProjectMediaRow.test.tsx` describe → happy path (single-row shape renders 1 ImageUpload; pair-row shape renders 2) + alt-required validation (TS-01).
- `tests/ImageUpload.test.tsx` regression — existing tests must still pass post-refactor (TS-01); add: split components render the same DOM shape (no behavior change).
- Playwright admin smoke (extend `tests/e2e/admin-smoke.spec.ts`): create project → add a single + a pair row → reorder via drag → save → reload → confirm order persisted.

**Depends on:** T43.A (designer consult), T43.E (Server Action available)

**Specialist:** `@ui-swarnimbagre` (admin shadcn mode)

---

### Task T43.G: Public component — `ProjectMediaCarousel` (embla wrapper)

**Files:**
- `components/public/ProjectMediaCarousel.tsx` — create (`'use client'`, wraps `embla-carousel-react`)
- `components/public/BeforeAfterMedia.tsx` — modify / CQ-02 refactor (split bundle-fallback CSS scenes into `BeforeAfterMediaScenes.tsx`; the real-image path stays in `BeforeAfterMedia.tsx` ≤200 lines). Closes S31 CQ-02 MAJOR carry-forward.

**Functions to implement:**
- `ProjectMediaCarousel({ media, ariaLabel }: ProjectMediaCarouselProps): React.ReactElement | null` — carousel wrapper. `media: PublicProjectMediaItem[]`. Returns `null` when `media.length === 0` (skip carousel section, PRD §2.3a G/W/T). When `media.length === 1`, renders a single static slide with no nav chrome (no dots, no arrows). When `media.length > 1`, renders embla with: dots row, left/right arrow buttons, swipe (embla default), keyboard ←/→ handlers, ARIA live region announcing "Slide N of M, [alt text]", `prefers-reduced-motion` honored (skips slide transition animation).
- Per-slide render branch: `image_after_url` non-null → `<BeforeAfterMedia ...>`; otherwise `<img src={imageUrl} alt={imageAlt} ...>`.
- Pair-slide drag-priority: `BeforeAfterMedia`'s divider drag must take priority over embla swipe within its hit area. Implementation: stop-propagation on `pointerdown` inside the divider handle.
- Caption render: when active slide has a `caption`, render below the slide in muted meta type per `@designer` spec from T43.A.

**Acceptance criteria — PRD §2.3a G/W/T:**
- [ ] Multi-slide carousel: dots + arrows + horizontal swipe + keyboard ←/→ all functional. No auto-advance. No loop — `loop: false` in embla options; boundary slides disable the corresponding arrow button.
- [ ] Single-slide carousel: no nav chrome. Renders the slide static.
- [ ] Zero-slide carousel: returns `null` (caller renders nothing).
- [ ] Active-slide caption renders below the image in muted meta type when present.
- [ ] Screen-reader live region announces "Slide N of M, [alt text]" when active slide changes. Implementation: `aria-live="polite"` element keyed off the embla `select` event.
- [ ] `prefers-reduced-motion: reduce` honored: embla `duration: 0` when the media query matches.
- [ ] Pair-row divider drag does NOT advance the carousel — drag within the divider hit area is consumed.
- [ ] Multi-instance DOM ID hygiene: `React.useId()` for the `aria-controls` / `aria-labelledby` / dot button IDs.
- [ ] CONSTRAINT-05 Override 2 boundary: this is the only public-site component using a JS library. The verbatim-bundle rule applies everywhere outside `ProjectMediaCarousel` + the embla dep.
- [ ] All styling uses CSS variables from `colors_and_type.css`. No Tailwind. No inline library defaults.
- [ ] Arrow + dot button labels are typographic glyphs only (`←`, `→`, `•`) — CONSTRAINT-13. ARIA labels: `aria-label="Slide 1"` etc. (short, no prose).
- [ ] `ProjectMediaCarousel.tsx` ≤200 lines (CQ-02).
- [ ] `BeforeAfterMedia.tsx` post-refactor ≤200 lines (closes S31 CQ-02 MAJOR carry-forward).
- [ ] Bundle delta verified: T43.B + T43.G commits combined add ≤10 KB gzip to the public-route entry chunk.

**Tests required:**
- `tests/ProjectMediaCarousel.test.tsx` describe →
  - happy path: 3-slide carousel renders 3 dots + both arrows + first slide visible (TS-01).
  - single-slide branch: 0 dots, 0 arrows rendered (TS-01).
  - zero-slide branch: returns null, container empty (TS-01).
  - keyboard nav: pressing `ArrowRight` advances; `ArrowLeft` at slide 0 does nothing (TS-01).
  - reduced-motion: when matchMedia mocks `prefers-reduced-motion: reduce`, embla constructed with `duration: 0` (TS-01).
  - multi-instance: two carousels on one page have non-overlapping DOM IDs (TS-01).
  - pair-slide drag-priority: pointerdown on divider stops propagation (TS-01).
  - ARIA: `aria-live` region text matches "Slide N of M, [alt]" on slide change (TS-01).
- Playwright public-route extension (`tests/e2e/public-carousel.spec.ts` — create): visit `/projects/[slug]` with a multi-media project; verify swipe (mobile viewport via Playwright touch emulation) + keyboard nav; verify mobile vertical-scroll-wins-over-horizontal-swipe at low angles (Playwright touch simulator); verify cards on `/projects` each have an independent carousel.

**Depends on:** T43.A, T43.B, T43.D

**Specialist:** `@ui-swarnimbagre` (public bundle mode + Override 2 boundary author)

---

### Task T43.H: Wire carousel into cards + detail page + list page

**Files:**
- `components/public/ProjectMedia.tsx` — modify (accept `media: PublicProjectMediaItem[]` prop; when present, render `<ProjectMediaCarousel media={...} ariaLabel={...} />`; when empty, fall back to current legacy single-image branching)
- `components/public/ProjectCard.tsx` — modify (accept `media` prop; pass to `ProjectMedia`; backward-compat additive prop — when `media` undefined, render unchanged per CONSTRAINT-05 additive-prop carve-out)
- `components/public/mobile/MobileProjectCard.tsx` — modify (mirror desktop changes)
- `app/projects/page.tsx` — modify (loader extends per-project to include `media: await loadPublicProjectMedia(project.id)`; pass through)
- `app/projects/[slug]/page.tsx` — modify (loader extends to include `media`; pass through to both Desktop + Mobile detail wrappers)
- `lib/public-projects.ts` — modify (already touched in T43.D; verify call sites updated)

**Functions to implement:** No new functions — additive prop wiring + page-loader call updates.

**Acceptance criteria — PRD §2.3 + §2.3a:**
- [ ] PRD §2.3 G/W/T: `/projects` list — project with `project_media` rows renders carousel in card's image slot; project with zero rows shows no image area.
- [ ] PRD §2.3a G/W/T: `/projects/[slug]` — detail page renders same carousel above the card content (or in the card's image slot, matching the list-card layout). Container size differs (detail = larger); carousel chrome size adapts per `@designer` spec from T43.A.
- [ ] Backward-compat: existing projects with `image_id` / `image_after_id` set and no `project_media` rows render exactly as they do today (legacy fallback path in `ProjectMedia.tsx`). No visual regression.
- [ ] CONSTRAINT-05 additive-prop carve-out honored: when `media` prop is undefined OR `[]`, ProjectCard renders byte-identically to its pre-T43 output.
- [ ] CONSTRAINT-14 `safeLoad` discipline: page-level loaders wrap `loadPublicProjectMedia` calls in `safeLoad` per project — a failure for one project's media nulls the carousel for that card only, not the whole page.
- [ ] CONSTRAINT-15: every URL in `media` is a signed URL with TTL 3600s (already guaranteed by `loadPublicProjectMedia` from T43.D).
- [ ] Mobile mirror: `MobileProjectCard` renders carousel identically on iPhone viewport. Touch-emulation Playwright assertion in T43.G covers this.
- [ ] No console errors on `/projects` or `/projects/[slug]` (CQ-05).

**Tests required:**
- `tests/ProjectCard.test.tsx` — extend existing tests: `media` prop with rows renders carousel; `media` undefined or empty falls back to legacy single-image branch (regression for backward-compat) (TS-01).
- `tests/MobileProjectCard.test.tsx` — mirror.
- Playwright (extended from T43.G's `public-carousel.spec.ts`): visit `/projects` with 2 multi-media projects → both cards have independent functioning carousels; visit `/projects/[slug]` with a multi-media project → carousel renders + works; visit `/projects/[slug]` with a project having only legacy `image_id` → static image still renders (no regression).

**Depends on:** T43.G

**Specialist:** `@ui-swarnimbagre` (public bundle mode)

---

### Task T43.I: Override 2 documentation + close-out

**Files:**
- `docs/design-decisions.md` — modify (finalize "Override 2: Public site JS library + carousel chrome" section; mirror Override 1 structure: Rationale, What changed, What stayed, Surface boundary)
- `docs/constraints.md` — modify (add CONSTRAINT-22: "JS libraries on public site permitted only with documented Override and ≤10 KB gzip budget"; amend CONSTRAINT-05 with Override 2 cross-link)
- `docs/architecture.md` — modify (§1.2 already updated in T43.B with the dep line; now add §4.9 "Carousel surface — Override 2" subsection documenting the public-site JS-lib boundary policy + multi-instance DOM ID requirement; §2.5 new subsection for the `project_media` table mirroring §2.1's level of detail)
- `docs/founder-brief.md` — modify (add Index row for "Project media carousel + first public-site JS library" decision; dated entry)
- `docs/content-model-expansion.md` — modify (further superseded note — already marked SUPERSEDED by T42; add a T43-furthered-by line at the top)
- `docs/plan-phase-4-launch.md` — modify (mark T43 done, log final session-count + commit list; mirror T42 closure pattern)
- `manifest.md` — modify (update Phase row 4 status; T43 done)

**Functions to implement:** Documentation only.

**Acceptance criteria:**
- [ ] `docs/design-decisions.md` "Override 2" section structured identically to Override 1 (Rationale / What changed / What stayed / Surface boundary). Surface boundary lists exactly: `ProjectMediaCarousel.tsx` + the `embla-carousel-react` dependency.
- [ ] `docs/constraints.md` CONSTRAINT-22 added; summary table updated; CONSTRAINT-05 line amended to reference Override 2.
- [ ] `docs/architecture.md` new §2.5 (`project_media` schema) + §4.9 (Carousel surface boundary). Cross-references to `founder-brief.md` entry.
- [ ] `docs/founder-brief.md` Index updated; dated entry under standard heading shape (mirroring entries 23 + 28 from T32/T42).
- [ ] `docs/content-model-expansion.md` further-superseded line at top.
- [ ] `docs/plan-phase-4-launch.md` T43 marked `[x]`; all sub-session checkboxes confirmed.
- [ ] `manifest.md` Project Identity Phase 4 status line updated.
- [ ] No broken cross-references between docs (DS-02). Manual link audit.
- [ ] All operator-facing labels added in T43 still voice-clean (CONSTRAINT-13) — final pass.
- [ ] `npm run build` clean (CQ-05).
- [ ] Full `npm test` suite passing.
- [ ] Playwright admin smoke + new public carousel spec both green.
- [ ] `@security` audit pass: no new XSS vectors (alt text + captions are plain text, not Markdown — confirmed at PRD §7.2 carve-out; rendered as text content, never `dangerouslySetInnerHTML`). No new auth surface. Server Action manifest matches 13 IDs.
- [ ] `@code-review` pass: file size budgets met across all new files; ImageUpload + BeforeAfterMedia CQ-02 MAJOR carry-forward closed.

**Tests required:**
- Doc link audit (manual).
- Full test suite must pass (TS-01, TS-04).

**Depends on:** T43.H (all execution work complete before close-out)

**Specialist:** `@security`, `@code-review`, `@cto` (review Override 2 + CONSTRAINT-22 wording)

---

**Estimated effort:** 7–9 focused sessions / ~28–40h total.

| Sub-task | Hours |
|---|---|
| T43.A | 1–2 |
| T43.B | 0.5–1 |
| T43.C | 2–3 |
| T43.D | 3–4 |
| T43.E | 4–6 |
| T43.F | 6–8 |
| T43.G | 6–8 |
| T43.H | 3–4 |
| T43.I | 3–4 |
| **Total** | **~28–40h / 7–9 focused sessions** |

Suggested session slicing (mirrors T42 Session A/B/C precedent):
- Session 33 — T43.A + T43.B (consult + dep add)
- Session 34 — T43.C + T43.D (schema + types)
- Session 35 — T43.E (Server Action)
- Session 36 — T43.F (admin component) — half
- Session 37 — T43.F finish + T43.G start
- Session 38 — T43.G finish (public carousel)
- Session 39 — T43.H (wire-in)
- Session 40 — T43.I (close-out) + Override 2 docs + final reviews

---

## Phase 4 Exit Criteria

- T32–T40 + T42 + T43 complete (T41 is a trigger-gated deferred follow-up and does not block Phase 4 exit, same pattern as Phase 3's T29/T31 OpenClaw-operator-gated deferrals).
- Site is live at `swarnimbagre.com`, monitored, with content rendering against the expanded project schema.
- All security and code review findings closed.
- Mark Phase 4 row Done in [`plan-index.md`](plan-index.md). The `@plan` cycle is complete; future work happens via individual `@plan` follow-up tasks against the same docs.
