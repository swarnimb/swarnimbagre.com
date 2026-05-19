# Plan — Phase 4: Polish + Launch

**Date:** 2026-05-06
**Status:** Active — T32–T39 done (T38 doc audit complete; 9/10 criteria met, only the DS-05 fresh-clone manual run outstanding — tracked separately. T39 closed 2026-05-19, Session 27: deploy live on apex canonical `swarnimbagre.com`, admin verified end-to-end including CRUD round-trip); T42 + T40 next (T42 blocks T40 content-addition criteria); T41 added 2026-05-19 as trigger-gated deferred follow-up (not a Phase 4 exit blocker)
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

**Status:** Planned 2026-05-19. Brainstorm complete (Session 28). Approved by builder. Supersedes the parked `docs/content-model-expansion.md` (which proposed a heavier Option C schema with new tables + JSONB — T42 ships a lighter "6 nullable columns, zero new tables" variant after Session 28 brainstorm closed scope).

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

*Schema:*
- [ ] Migration 009 applies cleanly to dev + production Supabase projects. Idempotent (uses `add column if not exists` or guard).
- [ ] All 6 columns nullable; only `progress_percent` has a CHECK constraint (`between 0 and 100`).
- [ ] `image_after_id` FK references `images(id) on delete set null` (matches existing `image_id` pattern).
- [ ] RLS policies on `projects` already cover read access to all columns — no new policies needed (verified against migration 002).

*Admin form:*
- [ ] All 6 new fields render in `ProjectForm.tsx` for both create and edit modes.
- [ ] Zod validation catches: invalid URL format on the 3 URL fields, percent out of range, unknown thumb_kind value.
- [ ] `ImageUpload` for `image_after_id` uses the same `parentType: 'projects'` + `parentId` binding as primary image.
- [ ] `ProjectForm.tsx` stays ≤200 lines (CQ-02) — split into sub-components if needed.
- [ ] Save round-trip works for all new fields (verified via Playwright admin smoke test).

*Public render — desktop:*
- [ ] Home page renders DB-driven projects (not hardcoded `featured` array) — verify by adding a test project via admin and seeing it on home.
- [ ] Projects page renders real screenshot (from `image_id`) instead of `DemoLoop` animation.
- [ ] `ProgressRing` renders correctly at 0, 25, 50, 75, 100. Done glow visible only at 100.
- [ ] 3 buttons (github / live / post) render only when their URL column is non-null. Hidden otherwise.
- [ ] Bundle's `StatusPill` no longer renders on project cards.

*Public render — mobile:*
- [ ] All desktop changes mirrored on mobile components.
- [ ] Mobile-specific layout regression-checked via Playwright.

*Before/after slider:*
- [ ] When `image_after_id` is non-null, `BeforeAfterMedia` renders the slider with both images.
- [ ] When `image_after_id` is null, falls back to static image via existing `StillMedia` path.

*Docs:*
- [ ] `docs/design-decisions.md` Override 1 entry written with rationale.
- [ ] `docs/founder-brief.md` architectural entry added (DS-02).
- [ ] `docs/architecture.md` §2 updated.
- [ ] `docs/content-model-expansion.md` marked SUPERSEDED with link to T42.

*Quality gates:*
- [ ] `npm run build` clean (CQ-05). No console errors in production runtime.
- [ ] `npm test` 100% passing. New tests added per "Tests required" below.
- [ ] Voice check on any new operator-facing labels (CONSTRAINT-13).

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

## Phase 4 Exit Criteria

- T32–T40 + T42 complete (T41 is a trigger-gated deferred follow-up and does not block Phase 4 exit, same pattern as Phase 3's T29/T31 OpenClaw-operator-gated deferrals).
- Site is live at `swarnimbagre.com`, monitored, with content rendering against the expanded project schema.
- All security and code review findings closed.
- Mark Phase 4 row Done in [`plan-index.md`](plan-index.md). The `@plan` cycle is complete; future work happens via individual `@plan` follow-up tasks against the same docs.
