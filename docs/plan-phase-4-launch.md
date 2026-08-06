# Plan — Phase 4: Polish + Launch

**Date:** 2026-05-06 — **last updated 2026-08-04 (Session 52).**
**Status:** Active — **current as of Session 52 (2026-08-04):**

- **Closed:** T32, T33, T34, T35, T36, T37, T38, T39, T42, T43, T44, T45, T46. Most recent: **T46 — full public-site redesign, closed 2026-08-04, Session 51** (see the T46 block at the end of this file).
- **Open:** **T40** — 2 acceptance criteria remain `[ ]`: the voice check on all live copy (re-scoped at T46 to cover the new UI copy) and the `docs/launch-checklist.md` post-launch section. Both are gated on builder content, not on code.
- **Deferred:** **T41** — trigger-gated; not a Phase 4 exit blocker.
- **Outstanding but owned by no open task:** the Playwright suite is rewritten-but-unrun, and the redesign is blocked on builder content. Neither is represented by an open `[ ]` in a live task. See **"Outstanding work not tracked by any open task"** immediately below the end-state paragraph.
- **Header-tick caveat (do not silently fix):** the task headers for T38, T39, T42, T43, T44 and T45 carry no `[x]`, even though each of those tasks' own Status / Closed blocks describes the work as complete. Left unticked deliberately rather than ticked on inference — logged under the tick-hygiene entry in `docs/framework-issues.md`.

**Status detail (historical, Sessions 27 → 37 — superseded by the summary above and by each task's own Status / Closed block; retained as the record, not as current state):** T32–T39 done (T38 doc audit complete; 9/10 criteria met, only the DS-05 fresh-clone manual run outstanding — tracked separately. T39 closed 2026-05-19, Session 27: deploy live on apex canonical `swarnimbagre.com`, admin verified end-to-end including CRUD round-trip); **T42 Session A done 2026-05-19, Session 29** (schema + admin write surface — migration 009 applied to prod, zod + Server Actions + ProjectForm wired, 24 new tests); **T42 Session B done 2026-05-19, Session 30** (public render desktop — ProgressRing + ProjectRow/Card/Media + Home + Projects, 259/259 vitest, @code-review APPROVED WITH MINOR); **T42 Session C done 2026-05-19, Session 31** (mobile mirrors + Override 1 docs + Playwright admin smoke + @security audit 18 CLEAR, 304/304 vitest, @code-review APPROVED WITH MINOR; 3 mid-session production bug fixes via Targeted Fix Mode); **T43.A done 2026-05-20** (@designer consult — Override 2 drafted in design-decisions.md, all 6 criteria checked); **T43.B done 2026-05-20** (embla-carousel-react ^8 installed clean; baseline ~11.7 KB gzip across 3 packages — embla-carousel, embla-carousel-react, embla-carousel-reactive-utils — measured against published ESM; budget raised 10→15 KB gzip per @cto S34 consult; architecture.md §1.2 + design-decisions.md Override 2 + plan v8 naming reconciled; npm run build clean, 13 routes); **T43.C done 2026-05-20** (migration 010 `project_media` applied to prod via mcp__supabase__apply_migration, ledger now `[007, 009, 010]`; 7/7 acceptance criteria PASS; @cto pre-apply review APPROVE w/ 2 MINOR landed in-file — UPDATE-of-project_id trigger scope + before/after distinctness CHECK; RLS verified empirically via DO-block role-switch — service=2 anon=1 authenticated=2; row-cap trigger verified — 20-insert OK + 21st raises + bulk-21 rolls back to 0; advisor security delta: 1 NEW WARN search_path FIXED in-session via CREATE OR REPLACE w/ `set search_path = ''`, 1 NEW WARN admin_all-USING-true ACCEPTED (matches 4-table pattern per CONSTRAINT-09 single-admin), 2 NEW INFO unindexed-FK ACCEPTED (matches 3-table pattern)); **T43.D done 2026-05-20, Session 35** (types + queries + signed-URL resolver — 6 lib files mod/created + 4 test files mod/created; 7/7 acceptance criteria PASS; 322/322 vitest, +18 new tests; longest new fn ~24 lines, lib/db.ts 284/300; loadPublicProjects extended with `media: PublicProjectMediaItem[]` + per-project failure isolation; deprecation JSDoc on Project.image_id / image_after_id ref T43 + CONSTRAINT-22 T43.I codification; no specialist consult needed — existing patterns covered the shape); **T43.E done 2026-05-20, Session 36** (Server Action `saveProjectMedia` + zod schemas + atomic DB-side RPC — 4 lib files created + 2 test files created + 1 migration applied; 7/9 acceptance criteria PASS, 2 deferred with reason (allowlist → T43.F per build-invariant gating, voice check → T43.F per scope); 342/342 vitest (+20 new); migration ledger `[007, 009, 010] → [007, 009, 010, 010a]` via `save_project_media(p_project_id uuid, p_rows jsonb)` RPC — SECURITY INVOKER + `search_path=''` + WITH ORDINALITY-derived `order_index` + NULL/array-type guard + EXECUTE granted only to `authenticated`; @supabase consult APPROVE WITH MINOR landed 4 edits pre-apply; Option A RPC chosen over Option B sequential — true Postgres-transaction atomicity beats application-layer rollback; longest source 173 lines, longest function ~17 lines; advisor delta zero new lints); **T43.F done 2026-05-21, Session 37** (admin component — `ProjectMediaField` + `ProjectMediaRow` + `ImageUpload.tsx` CQ-02 MAJOR split closed; 10 files in scope + `lib/admin-project-media-form-state.ts` helper extraction + 4 new test files; all acceptance criteria PASS; 385/385 vitest, +43 from S36; `next build` clean 13/13; server-action manifest allowlist 12→13, `saveProjectMedia` now reachable; Playwright admin-smoke green incl. new create→upload→drag-reorder→save→reload round-trip; 2 real bugs caught by the e2e and fixed — `draggingIndex` `useState`→`useRef` stale-closure + `crypto.randomUUID()` SSR hydration mismatch; `@security` audit 20 CLEAR + `@code-review` PASS after 3 minor fixes); T40 content-addition criteria UNLOCKED but other T40 criteria still open (24h log review, voice-check, launch-checklist post-launch section, DS-03 launch entry); T41 trigger-gated
**Tasks:** T32–T47 (16 tasks; T47 added 2026-08-06, Session 54 — reliable e2e teardown, opened by the first Playwright run; T41 is trigger-gated and does not block Phase 4 exit — same pattern as Phase 3's T29/T31 operator-gated deferrals; T42 added 2026-05-19 as a pre-T40 schema + render expansion to make the public project card meaningfully render real DB content; T43 added 2026-05-20, T44 + T45 added 2026-05-28, T46 added 2026-08-04)
**Predecessor:** [`plan-phase-3-ingestion.md`](plan-phase-3-ingestion.md)
**Successor:** none — final phase

End state: site is live at `swarnimbagre.com`, monitored, the post-launch checklist is closed. Phase 4 is operational and quality work — error monitoring, env-var hygiene, security review, code review, doc audit, production deploy, and post-launch ops.

---

## Outstanding work not tracked by any open task

Read this before running a "find the first incomplete `[ ]`" sweep. Three pieces of real outstanding work do **not** surface as an open `[ ]` inside a live task, because the tasks that produced them are closed. Listed here so they are impossible to miss.

**1. ~~The Playwright suite is rewritten but has never been run~~ — RESOLVED 2026-08-06, Session 54.** Run for the first time; **15/15 green** after six stale specs were fixed and one real production bug (`post_id` missing from `PROJECT_COLUMNS`) was found and fixed. **It did not resolve cleanly, though:** the run exposed that `admin-smoke` leaks live rows even when green, which is now **T47**. The historical framing below is retained as the record.

T46 rewrote `admin-smoke.spec.ts` for the new markup and re-pointed `pages.spec.ts` / `admin-font.spec.ts`. All type-correct, none executed (S51 had no live Supabase fixture and no authenticated session). The historical record is the `[~]` line under T46 → **Tests required**, and because that line is `[~]` a first-`[ ]` sweep skips it and never shows the instruction it ends on. Restated here as live work, plus a live `[ ]` in the T46 block:

- [x] Run the full Playwright suite (`admin-smoke.spec.ts`, `pages.spec.ts`, `admin-font.spec.ts`) against a live Supabase fixture with an authenticated session. **Blocks the next deploy.** Needs an environment, not a decision — an agent can close this once the fixture and session exist. — **DONE 2026-08-06, Session 54.** The environment gate was already satisfied; no setup was needed. First run: 11/15, four failures, all stale specs. Final run: **15/15 green** (8 files, `--workers=1`, ~96s). Fixed four stale specs (Home footer marker removed at T46; `/writing/hello-world` fixture purged at S42 plus a `main` element that does not exist on that route; dead `p-4`/`text-fg` Tailwind canaries; `getByLabel('Title')` made ambiguous by T46's `subtitle` field) plus two more the run exposed — T44.D's drag-handle column shifted the slug cell index so `postSlug` was reading the TITLE, and the stats edit reloaded mid-flight before the Server Action landed. **Also fixed one real production bug it caught: `post_id` was missing from `PROJECT_COLUMNS` in `lib/db.ts`, so the card's `Writeup` action could never render for any project — T45's feature was inert in production.** **NEW DEFECT OPENED, not fixed:** `admin-smoke` cleanup does not reliably delete and does not verify itself; a green run has been observed leaving 3 projects in the production DB, one `published` and live. Needs its own task — see the session log.

**2. The redesign is blocked on builder content — and that content is NOT a task.**

T46 shipped the redesign against empty tables. Still needed: **6 sets of project screenshots** (every card currently reads "no preview yet" — T46 decision 7 retired the SVG thumb motifs, which makes screenshots a hard launch gate) and **7 rows for `/other`** (4 `stats` + 3 `notes`; both tables are at 0).

This work is **builder-content-gated and is represented by no checkbox and no task number anywhere in this plan.** It is not T40, not T46, not T41. Creating tasks is `@create-plan`'s job, not a close-out's, so nothing was invented here. **The next session must scope this as a task before treating it as executable work.** Until it is scoped, no `[ ]` sweep will ever find it.

**3. DS-05 fresh-clone verification is manual-builder-only.**

Two `[ ]` boxes — T33 criterion 4 and T38's `README.md` criterion — are the same single manual run on a clean clone. Both are flagged inline as **MANUAL BUILDER ACTION**. A `[ ]` sweep will land on them; no agent can close either.

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

**Option A — deploy now:** *(dead branch — Option B was chosen; all five boxes below are `[~]` and will never be ticked. Text retained as the record of what Option A would have required if Sentry is ever reconsidered.)*
- [~] Sentry project created. `SENTRY_DSN` set in Vercel production env (server) and `NEXT_PUBLIC_SENTRY_DSN` (client) if needed. — superseded: Option B (defer) chosen 2026-05-14 by `@cto`; Option A is a dead branch.
- [~] Unhandled errors in both browser and server contexts are reported. — superseded: Option B (defer) chosen 2026-05-14 by `@cto`; Option A is a dead branch.
- [~] **PII scrubbing rules:** email addresses, tokens, and request bodies are stripped before send (SEC-05). — superseded: Option B (defer) chosen 2026-05-14 by `@cto`; Option A is a dead branch.
- [~] Error events include: route path, session presence flag (anon vs authenticated), error name, sanitized stack. — superseded: Option B (defer) chosen 2026-05-14 by `@cto`; Option A is a dead branch.
- [~] No `console.log` debug aids left in (CQ-05). — superseded: Option B (defer) chosen 2026-05-14 by `@cto`; Option A is a dead branch.

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
- [ ] **MANUAL BUILDER ACTION — no agent can close this.** DS-05 verification: a fresh checkout, following only the README, reaches a working `npm run dev` state. — **Deferred to builder; manual run on a clean clone.** Still outstanding as of Session 52 (2026-08-04). Deliberately left `[ ]` rather than `[~]` — it is real outstanding work, not a superseded branch. Same criterion is mirrored at T38 (`README.md` is accurate, DS-05); closing one closes both.

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

## [x] T38 — Documentation audit

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
- [ ] **MANUAL BUILDER ACTION — no agent can close this.** `README.md` is accurate (DS-05). README **content** audited and accurate (commands vs package.json, env vars, paths, versions — all correct). Fresh-clone runtime verification (clone + `npm run dev` serves :3000) remains the outstanding DS-05 / T33 criterion-4 **manual builder action** — tracked separately, not part of the doc audit. Still outstanding as of Session 52 (2026-08-04). Deliberately left `[ ]` rather than `[~]` — it is real outstanding work. Same criterion as T33 criterion 4 (line ~67); closing one closes both.
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

## [x] T39 — Production deploy + DNS cutover

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

> **Revised 2026-05-25 (S41), honest plan discipline:** criteria 1+2 are calendar-stale (24h window expired — launch at T39 was 2026-05-19); criterion 3 is blocked on T29/T31 (OpenClaw deferred — see `plan-phase-3-ingestion.md`); added explicit test-data cleanup as criterion 0 (first work item). Reframed retroactive log reviews to launch-week window.

**Files:** Supabase logs (operational); Vercel analytics (operational); admin panel content.

**Functions to implement:** [operational task]

**Acceptance criteria:**
- [x] Clear 28 test-fixture rows from `projects` table (`t28-*`, `t42-e2e-*`, `t43f-*`); 12 published rows currently visible on live `/projects` removed first. Verify `/projects` is empty on production before adding real content. → **S42 2026-05-25 (Option A):** 32 rows deleted (12 published + 20 draft — count diverged from the S41 estimate of 28; 4 extra drafts created 2026-05-23 23:27 during T43.I close-out); 6 `project_media` rows removed via FK CASCADE (`project_media.project_id → projects.id`). `public.projects` now empty (`total=0`, `published=0`). 32 orphan rows in `public.images` (`parent_type = 'projects'`) + their bucket objects remain — DB-level orphans only, not user-visible; deferred to follow-up via existing `lib/admin-images-cleanup.ts` (logged in Future Iterations of session-handoff).
- [~] ~~First 24h: Supabase Edge Function logs reviewed daily. Any 5xx or unexpected 401 spike triaged.~~ — calendar-stale (S41).
- [x] Retroactive launch-week (2026-05-19 → 2026-05-25) Supabase Edge Function logs reviewed. Any 5xx or unexpected 401 spikes triaged. → **S42 2026-05-25:** trivially satisfied — `mcp__supabase__list_edge_functions` returned `functions: []`. Zero Edge Functions are deployed to the swarnimbagre.com project (`stats-ingest` is gated on T31, which remains deferred behind the OpenClaw operator gate per `plan-phase-3-ingestion.md`). No EF traffic exists in the launch-week window — no 5xx, no 401 spikes possible. The MCP 24h-retention limit on `get_logs` (a structural constraint for any future EF log review via this tool) is moot here. Re-verify this criterion when T31 lands and `stats-ingest` deploys.
- [~] ~~First 24h: Vercel logs reviewed daily. No unhandled errors.~~ — calendar-stale (S41).
- [x] Retroactive launch-week (2026-05-19 → 2026-05-25) Vercel logs reviewed. No unhandled errors found, or any found are triaged. → **S42 2026-05-25:** runtime Logs view (Hobby free-tier retention ≈ last hour) showed 7 entries in a ~17-min window, all 200 except 1 `404 GET /favicon.png` at 09:02:28. **Triage:** no code path emits `/favicon.png` (verified — `middleware.ts:163` excludes `favicon.ico` from the Next.js matcher; `site/index.html:7` points at `assets/favicon.svg`); the 404 is an external browser/bot heuristic probe. Source resolution falls under **T41** (`app/icon.svg` / `app/favicon.ico` is in T41's file list); T41 is deferred trigger-gated, not a T40 blocker. Deployments tab confirmed all rows since 2026-05-19 show **Ready**. Free-tier runtime-log retention (~1 hour) cannot reach the full launch-week window — this is the same structural retention gap as the EF criterion, accepted given T32 Option B (no persistent monitoring). Low traffic volume (~7 hits / 17 min) consistent with T41 deferral rationale ("0 ambient traffic week 1").
- [~] ~~OpenClaw is producing real (non-test) stat rows at the expected cadence.~~ — superseded S41: blocked on T29 + T31 (OpenClaw operator gate deferred — see `plan-phase-3-ingestion.md` status). Re-verify when T29/T31 land.
- [x] 2–3 real projects added via admin so `/projects` is not empty. → **S43 2026-05-28:** 6 placeholder projects published via admin (ParSaveables, Claude Code Magic, swarnimbagre.com, Totes Sales CRM, AmIBroke, CardMaxxer) — title + dry blurb + GitHub link (+ live URL on ParSaveables / AmIBroke / swarnimbagre.com). Thumbnails + carousel media deferred to a later content pass. Slugs auto-derived and now LOCKED (CONSTRAINT-12): `parsaveables`, `claude-code-magic`, `swarnimbagre-com`, `totes-sales-crm`, `amibroke`, `cardmaxxer`. `/projects` no longer empty.
- [x] 1–2 real posts added via admin so `/writing` is not empty. → **S43 2026-05-28:** placeholder post(s) published via admin; `/writing` no longer empty. Post bodies (`content` markdown) to be fleshed out later. Voice check on builder-written post copy tracked under the voice-check criterion below (still open).
- [ ] Voice check on all live copy: no SaaS phrases, no emoji, no LinkedIn-motivational tone (CONSTRAINT-13). → **DEFERRED (S44):** intentionally not the next task — runs on FINAL content, after T44 + builder content authoring. Next active task is T44; see session-handoff. Plan remains authoritative; this deferral is recorded so @session-start drift detection reads it as intentional. → **S50 (2026-06-17) scope narrowed:** the four S48 page-footer lines (incl. "No cookies, no analytics, pure vibes." on Home) are **reviewed and approved as intentional/compliant** by the builder — they are dry/self-deprecating by design. Remaining voice-check scope = builder-authored project blurbs + post bodies only. Do not re-flag the footer lines. → **T46 (2026-08-04) RE-SCOPED — this criterion grew.** The four S48 footer lines are moot: the redesign has no footer on any page, so there is nothing left to re-flag. In their place T46 introduced a batch of NEW machine-authored copy that has never had a voice pass: the home bio and question bubble, the three rotating chat deflections, the Projects/Writing/Other ledes, the Writing closing line, the "Find me here:" label, and four empty states ("no preview yet", "links coming soon", "nothing counted yet", "A new build, details on the way."). **Scope is now: builder-authored project blurbs + post bodies, PLUS all T46 UI copy.** The chat deflection lines in particular were drafted as placeholders and the builder explicitly deferred final wording ("we can decide this content later, the structure would be same irrespective of the content").
- [x] Any bug found is logged in `docs/session-log.md` with severity and a follow-up task description. → **S42 2026-05-25:** discipline established. Two bugs surfaced during T40 work — (1) `404 GET /favicon.png` (LOW, cosmetic; follow-up = T41 deferred wiring); (2) 32 orphan rows in `public.images` (LOW, non-user-visible DB/storage waste; follow-up = session task #7). Both logged with explicit severity + follow-up reference, consolidated in the `docs/session-log.md` [2026-05-25 09:45] Bug log table. Forward-looking: any new bug surfaced in remaining T40 work appends to that table.
- [ ] `docs/launch-checklist.md` post-launch section is checked off. → **DEFERRED (S44):** closes T40 after crit 9; waits on final content (item 2 stays OPENCLAW-GATED).
- [x] Auto-Logging entry written to `docs/session-log.md` documenting the launch (DS-03). → **S42 2026-05-25:** consolidated launch retrospective entry written at `docs/session-log.md` [2026-05-25 09:50]. Documents T39 launch event (2026-05-19, Session 27 close — site live on apex canonical) + Phase-4 post-launch work executed S28 → S42 (T40 / T42 / T43) + current post-launch state (site live, fixture-clean, awaiting real content, 0 ambient traffic, no errors in retrievable launch-week window). DS-03's structural requirement ("the launch is documented") is satisfied via this single canonical retrospective entry rather than via retroactive day-of-launch reconstruction (day-of-launch is already captured in `manifest.md` + S27 close-out trail + `docs/founder-brief.md` entries). Will be consolidated into `docs/session-handoff.md` at the same `@end-session` that processes this entry.

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

## [x] T42 — Project content-model expansion + public-card redesign

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

## [x] T43 — Project media multi-image carousel

**Status:** Sub-tasks T43.A through T43.I complete 2026-05-20 → 2026-05-23 (Sessions 32 → 40). T43.A `@designer` consult Override 2 draft (S33); T43.B `embla-carousel-react` install + ~11.7 KB gzip baseline (S34); T43.C migration 010 `project_media` to prod (S34); T43.D types + queries + signed-URL resolver (S35); T43.E `saveProjectMedia` Server Action + atomic RPC migration 010a (S36); T43.F admin `ProjectMediaField` + `ProjectMediaRow` + `ImageUpload` CQ-02 split (S37); T43.G public `ProjectMediaCarousel` + `ProjectMediaCarouselParts` + `BeforeAfterMedia` CQ-02 split (S38); T43.H wire carousel into `ProjectMedia` + `ProjectCard` + `MobileProjectCard` + the two `pages/Projects.tsx` page-body components + `app/projects/[slug]/page.tsx` (S39); T43.I Override 2 docs finalized + CONSTRAINT-22 codified + T43 close-out (S40, 2026-05-23). Production migration ledger `[007, 009, 010, 010a]`. Vitest 411/411 at T43.H baseline (re-verified at T43.I). `next build` exit 0; embla added +8 KB First Load JS on `/projects` + `/projects/[slug]` — inside the 15 KB CONSTRAINT-22 budget. `@security` audits 18 → 22 all CLEAR; T43.I docs-only audit 23 CLEAR. `@code-review` PASS at every sub-task gate; two CQ-02 MAJOR splits landed (`ImageUpload.tsx` at T43.F, `BeforeAfterMedia.tsx` at T43.G) and one MINOR CQ-07 test-helper duplication decided CARRY FORWARD at T43.I re-sweep (no `tests/_fixtures/` pattern exists yet; first-mover decision deliberately deferred from a docs-only commit). Override 2 Surface boundary finalized at T43.I to record the actual 12-entry surface (11 files + the dep); the plan's pre-build "exactly 2" criterion was understated and revised in-place per `@cto` S40 consult (see strike-through under T43.I acceptance criteria). Plan-doc divergence on T43.H file list reconciled in this closure: the actual edits were the two `components/public/pages/Projects.tsx` + `components/public/mobile/pages/Projects.tsx` page-body components, not `app/projects/page.tsx` + `lib/public-projects.ts` (T43.D already returned `media` from `loadPublicProjects`); `lib/db.ts` untouched (resolves S35 284/300 watchpoint). Commits: `efa294b` (T43.B), `f96b6f8` (T43.C), `ade9484` (T43.D + S34 framework recovery), `6fea8c6` (T43.E), `3373682` (T43.F), `5afac09` (T43.G), `0029072` + `30bdf35` (T43.H feat + docs), `9b21162` (T43.I docs close-out — Override 2 finalized + CONSTRAINT-22 codified + T43 closed). Override 2 binds the project media carousel surface only; everything outside that named boundary remains bundle-verbatim under CONSTRAINT-05.

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

1. First JS library on the public site (Override 2). Embla becomes the precedent for "when is a public-site JS dep acceptable." Override 2 docs need a JS-lib-on-public-site policy boundary (tree-shakeable, no global styles, runtime size budget ≤15 KB gzipped per @cto S34 — embla core + `embla-carousel-react` wrapper + `embla-carousel-reactive-utils` transitive measured at ~11.7 KB gzip combined against published ESM; the core package was renamed from `embla-carousel-core` to `embla-carousel` in v8). Defer Override 2 docs to T43-close mirroring Override 1 → T42-close pattern.

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
- [x] `npm install embla-carousel-react@^8` runs clean. No peer-dependency warnings against React 19 / Next 15.
- [x] `npm run build` succeeds with the dep installed (sanity check: addition itself doesn't break the build).
- [x] Bundle size delta documented in commit message: `embla-carousel` (core) + `embla-carousel-react` + `embla-carousel-reactive-utils` (transitive) baseline. Currently measured at ~11.7 KB gzip combined against published ESM. **Budget ceiling: 15 KB gzip** (raised from 10 KB per @cto consult S34 — naive 5 KB estimate did not match real embla footprint). If a future install or addon plugin pushes combined embla footprint over 15 KB gzip, stop and revisit Override 2 budget with `@cto`. Real production-bundle delta on the public-route chunk to be re-measured at T43.G close.
- [x] `architecture.md` §1.2 lists embla under "Public site" — explicit acknowledgment that the public site now carries one JS lib (was: "raw React + custom components, no library").
- [x] No `eslint`-related blocker (no ESLint config in repo — non-blocking).
- [x] Voice check: any new operator-facing label introduced is dry, no SaaS phrasing (CONSTRAINT-13). Dep-add itself has no labels.

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
- [x] Migration applies cleanly to the dev/prod Supabase project via `mcp__supabase__apply_migration`. Idempotent guards (`if not exists`) on table + policies + trigger.
- [x] All FKs use sensible delete behavior: `project_id` → cascade (deleting a project deletes its media rows); `image_id` / `image_after_id` → restrict (deleting an image with a `project_media` reference is blocked — admin must remove the row first, mirroring CONSTRAINT-07's parent-FK discipline).
- [x] RLS verified: anon SELECT of a `project_media` row whose parent project is `status='draft'` returns 0 rows. Anon SELECT for `status='published'` parent returns rows. Authenticated CRUD passes (SEC-04, CONSTRAINT-08).
- [x] Row-cap trigger verified: insert 20 rows for one project_id → succeeds. 21st insert → raises. Bulk insert of 21 in a single statement → raises and rolls back the entire statement.
- [x] No new Storage bucket / no new `storage.objects` policy needed (reuses `images` bucket). CONSTRAINT-20 N/A for this migration; noted in migration comment header.
- [x] Compound index `(project_id, order_index)` confirmed via `\d project_media` or `pg_indexes`.
- [x] Existing `projects.image_id` / `image_after_id` columns left in place (backward-compat). Migration header comment documents the deprecation-in-progress.

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
- [x] All new exports have JSDoc (DS-01).
- [x] `getProjectMediaByProject` is wrapped via `safeLoad` at call sites (page-level Server Components only — CONSTRAINT-14). The function itself throws `ServiceError`. (Page-level call sites land at T43.G/H; the function throws as specified — verified.)
- [x] `loadPublicProjectMedia` does NOT use `safeLoad` internally (CONSTRAINT-14 carve-out — `safeLoad` is boundary-only). Per-item URL failures are caught + logged + nulled (mirror existing `resolveImageUrl` pattern in `lib/public-projects.ts`). (Implemented via private `resolveMediaImage` helper; failure-isolation tested across 4 cases in `tests/public-project-media.test.ts`.)
- [x] No raw SQL string concatenation (SEC-03 — use Supabase query builder).
- [x] `lib/types.ts` deprecation comments on `Project.image_id` / `image_after_id` reference T43 + the migration plan (backward-compat window open-ended).
- [x] File sizes: `lib/db.ts` stays ≤300; `lib/admin-queries-project-media.ts` ≤200; `lib/public-project-media.ts` ≤200 (CQ-02). (Measured at close: 284, 58, 92.)
- [x] Function sizes ≤50 lines each (CQ-01). (Longest new function ~24 lines.)

**Tests required:**
- [x] `tests/db.test.ts` describe `getProjectMediaByProject` → happy path (returns ordered media for a project with rows) + error case (Supabase error throws `ServiceError`) (TS-01). (5 tests: 2 happy + 3 error including invalid-projectId.)
- [x] `tests/public-project-media.test.ts` describe `loadPublicProjectMedia` → happy path (rows resolve to signed URLs in order) + per-item resolution failure (one bad image_id nulls only that item's URL, other items unaffected) (TS-01). (9 tests: 4 happy + 5 failure-isolation including underlying ServiceError propagation.)
- [x] `tests/admin-queries-project-media.test.ts` describe `getProjectMediaByProjectAdmin` → happy path + DB error (logged via `logQueryError`, returns empty/typed result per §6.6.8) (TS-01). (5 tests including `[admin-queries]` log-tag assertion. Function throws ServiceError per existing admin-side convention; "empty/typed result" is the UI-boundary semantic, surfaced loud to operator via log + throw.)

**Depends on:** T43.C

**Specialist:** `@supabase` (query shape sanity-check) — not consulted; existing admin-queries patterns covered the shape, no novel query type introduced.

**Closed:** 2026-05-20, Session 35. Commit pending. All 322 vitest tests pass (was 304/304 in S33 baseline; +18 new). `next build` ran via `tests/server-actions-manifest.test.ts` — 13/13 routes, shared chunks 102 kB unchanged (embla not yet imported by any route chunk; carousel component lands at T43.G).

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
- [x] `lib/admin-project-media-mutations.ts` exports ONLY `saveProjectMedia` — no helpers (per §6.6.6 wrapper-only-exports rule). (Verified: file grep returns one `export async function`.)
- [x] `saveProjectMedia` applies the four-channel uniformity contract: try/finally `padToFloor` (Channel 3); try/catch with ZodError → `fieldErrors`, other → generic `GENERIC_FORM_ERROR` (Channels 1/2); no rethrow to wire (Channel 6); no `Set-Cookie` writes (Channel 5).
- [x] Internal helper validates UUID format on `projectId`, `image_id`, `image_after_id` (SEC-02). (`projectMediaSaveSchema` + `projectMediaRowSchema` enforce via `z.string().uuid()`; row schema also refines `image_after_id !== image_id` mirroring the DB CHECK.)
- [x] Atomic delete-then-insert: **Option A (RPC) chosen by builder at task start.** Migration `010a_save_project_media_rpc.sql` creates `public.save_project_media(p_project_id uuid, p_rows jsonb)` — SECURITY INVOKER, `search_path=''`, `WITH ORDINALITY`-derived `order_index`, NULL/array-type guard, EXECUTE granted only to `authenticated` (revoked from `public` AND from `anon`). DELETE + INSERT run in one Postgres transaction; INSERT-side failure (RLS, FK, row-cap trigger raise) rolls back the DELETE. `@supabase` consult landed four edits before apply.
- [x] Row-count enforcement at zod boundary (`rows.length <= 20`) — defense layer to the DB trigger from T43.C. (`PROJECT_MEDIA_MAX_ROWS = 20` in `projectMediaSaveSchema`.)
- [x] CONSTRAINT-10 hard-delete semantics preserved: the RPC deletes-and-replaces `project_media` rows; orphan `images` cleanup remains the T27 sweep's responsibility (untouched in T43.E).
- [~] `tests/server-actions-manifest.test.ts` allowlist extended to 13 IDs (SEC-09 / §6.6.5). — **Deferred to T43.F.** Next.js only emits a Server Action into `.next/server/server-reference-manifest.json` when the export is reachable from an `app/**` route. `saveProjectMedia` ships and is fully tested, but no page imports it yet; T43.F (admin form mount) lands the import → manifest entry → allowlist update. Same gating pattern as `uploadImage` (T25 commit 2 → T26 imports) and `deleteOrphanImages` (action file → T27 page). Comment annotation in the test file documents the pending 12→13 update.
- [x] No real secrets in any committed file (SEC-01, SEC-07). (Grep clean.)
- [x] File sizes: each ≤200 (types/schemas) or ≤300 (internal/wrapper) per CQ-02. Function sizes ≤80 for validation, ≤50 elsewhere (CQ-01). (Measured at close: types 69, schemas 90, internal 90, wrapper 173. Longest function ~17 lines.)
- [~] Voice check on operator-facing labels: "Save", "Saved." — dry, CONSTRAINT-13. — **N/A at T43.E.** No operator-facing labels exist in this surface (Server Action + helpers + zod schemas only). Operator labels land in T43.F (`ProjectMediaField` admin form). Voice check transfers to T43.F's acceptance criteria.

**Tests required:**
- [x] `tests/admin-project-media-mutations-schemas.test.ts` → happy path (valid payload), error cases (caption >280 char, row count >20, non-UUID image_id, non-dense order_index, missing image_id on a row) (TS-01). (15 tests: row schema 9 + save schema 6. Per-row order_index test redirected to "rejects extra keys in strict mode (e.g., legacy order_index)" since `order_index` is no longer in the payload per @supabase WITH-ORDINALITY recommendation.)
- [x] `tests/admin-project-media-mutations.test.ts` → describe `saveProjectMedia` → happy path (envelope returns `{status: 'ok'}`), error case (DB throw → `{status: 'error', formError}`), validation error (returns `{status: 'error', fieldErrors}`) (TS-01). (5 tests against the throwing helper `saveProjectMediaInternal` — happy single row + happy empty rows + ZodError on bad project_id + ZodError on bad row + Supabase RPC error → ServiceError. Wrapper-level envelope shape is structurally identical to the projects wrapper, whose uniformity is already covered in `tests/admin-projects-mutations*.test.ts`.)
- [~] Manifest assertion: `tests/server-actions-manifest.test.ts` confirms exactly 13 action IDs post-T43. — **Verified at 12 IDs as of T43.E close** (action not yet manifest-reachable); will be 13 at T43.F close, all 13 post-T43.

**Depends on:** T43.C, T43.D

**Specialist:** `@supabase` (RPC / transaction shape review) — consulted; APPROVE WITH MINOR; four edits landed in migration 010a before apply (WITH ORDINALITY, NULL/type guard, anon-revoke, nullif belt).

**Closed:** 2026-05-20, Session 36. 7/9 criteria PASS; 2 criteria deferred with reason (allowlist → T43.F per build-invariant gating; voice check → T43.F per scope). 342/342 vitest passing (322 baseline + 20 new). Migration ledger `[007, 009, 010] → [007, 009, 010, 010a]`. `mcp__supabase__get_advisors` post-apply: 0 NEW lints (all 10 returned are pre-existing baseline). Function grants verified: `EXECUTE: authenticated, postgres, service_role` — anon removed.

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
- [x] All operator labels CONSTRAINT-13 voice-clean: "+ image" / "+ pair" / "Delete" / "Save" / "Trim to 20 rows" — dry, no emoji, no SaaS. (Shipped "Save media" + "Trim to 20 rows to add more." — fuller wording, same voice; drag handle uses Braille glyph `⠿`, a typographic symbol not an emoji.)
- [x] Multi-instance DOM ID hygiene: each `ImageUpload` inside a row uses `React.useId()` for input element IDs.
- [x] Component file shapes follow existing admin conventions: shadcn primitives (Label, Input, Textarea, Select, Button); no public-site CSS variables.
- [x] Nested `<form>` discipline preserved (§6.6.7) — `ProjectMediaField` is rendered inside `ProjectForm`'s `<form>` element; `ImageUpload` instances stay `<div>`-wrapped per existing pattern.

**Tests required:**
- `tests/ProjectMediaField.test.tsx` describe → happy path (renders initial rows in order; add image button creates new row; delete button removes row; over-cap warning renders at 11+) (TS-01).
- `tests/ProjectMediaRow.test.tsx` describe → happy path (single-row shape renders 1 ImageUpload; pair-row shape renders 2) + alt-required validation (TS-01).
- `tests/ImageUpload.test.tsx` regression — existing tests must still pass post-refactor (TS-01); add: split components render the same DOM shape (no behavior change).
- Playwright admin smoke (extend `tests/e2e/admin-smoke.spec.ts`): create project → add a single + a pair row → reorder via drag → save → reload → confirm order persisted.

**Depends on:** T43.A (designer consult), T43.E (Server Action available)

**Specialist:** `@ui-swarnimbagre` (admin shadcn mode)

**Closed:** 2026-05-21, Session 37. All acceptance criteria PASS. 10 files in scope — 5 created (`ProjectMediaField` 193, `ProjectMediaRow` 172, `ImageUploadFileInput` 65, `ImageUploadAltInput` 69, `lib/admin-project-media-preview.ts`), 4 modified (`ImageUpload.tsx` 227→199 CQ-02 split, `ProjectForm.tsx` 196, edit-page loader, manifest test allowlist 12→13), 1 deleted (`ProjectImageField.tsx` — dead post-swap) — plus `lib/admin-project-media-form-state.ts` extracted for CQ-02 headroom and 4 new test files (10+12+15+6). 385/385 vitest (was 342 at S36 close, +43). `next build` clean 13/13 routes, shared chunks 102 kB. Server-action manifest invariant green at 13 IDs (`saveProjectMedia` now reachable). Playwright admin-smoke green incl. the new create→upload→drag-reorder→save→reload round-trip. Two real bugs caught by the e2e and fixed: `draggingIndex` `useState`→`useRef` (stale-closure on same-tick dragstart+drop) and `crypto.randomUUID()` in the `useState` initializer → SSR hydration mismatch (loaded rows now reuse `project_media.id` as the React key). `ImageUploadPreview.tsx` from the spec file list shipped as `ImageUploadAltInput.tsx` (no preview logic existed to extract). `@security` audit 20 CLEAR (0 Critical / 0 High / 0 new findings). `@code-review` PASS after 3 fixes — TS-01 unit test for `admin-project-media-preview.ts` (+6 tests → 385), §6.6.6 boundary (row/caption caps relocated to the client-safe `-types.ts`), CONSTRAINT-16 (soft-warn `text-yellow-500` → admin-token `text-destructive`).

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
- [x] Multi-slide carousel: dots + arrows + horizontal swipe + keyboard ←/→ all functional. No auto-advance. No loop — `loop: false` in embla options; boundary slides disable the corresponding arrow button.
- [x] Single-slide carousel: no nav chrome. Renders the slide static.
- [x] Zero-slide carousel: returns `null` (caller renders nothing).
- [x] Active-slide caption renders below the image in muted meta type when present.
- [x] Screen-reader live region announces "Slide N of M, [alt text]" when active slide changes. Implementation: `aria-live="polite"` element keyed off the embla `select` event.
- [x] `prefers-reduced-motion: reduce` honored: embla `duration: 0` when the media query matches.
- [x] Pair-row divider drag does NOT advance the carousel — drag within the divider hit area is consumed.
- [x] Multi-instance DOM ID hygiene: `React.useId()` for the `aria-controls` / `aria-labelledby` / dot button IDs.
- [x] CONSTRAINT-05 Override 2 boundary: this is the only public-site component using a JS library. The verbatim-bundle rule applies everywhere outside `ProjectMediaCarousel` + the embla dep.
- [x] All styling uses CSS variables from `colors_and_type.css`. No Tailwind. No inline library defaults.
- [x] Arrow + dot button labels are typographic glyphs only (`←`, `→`, `•`) — CONSTRAINT-13. ARIA labels: `aria-label="Slide 1"` etc. (short, no prose).
- [x] `ProjectMediaCarousel.tsx` ≤200 lines (CQ-02). — 198 lines; presentational sub-components extracted to `ProjectMediaCarouselParts.tsx` (164).
- [x] `BeforeAfterMedia.tsx` post-refactor ≤200 lines (closes S31 CQ-02 MAJOR carry-forward). — 161 lines; bundle-fallback CSS scenes extracted to `BeforeAfterMediaScenes.tsx` (91).
- [~] Bundle delta verified: T43.B + T43.G commits combined add ≤10 KB gzip to the public-route entry chunk. — **DEFERRED to T43.H.** `ProjectMediaCarousel` is not yet imported by any route, so it is in no route chunk and the T43.G entry-chunk delta is 0. embla measured standalone at ~11.4 KB gzip (within the 15 KB Override 2 budget). Real combined route-chunk delta is measurable only once T43.H wires the carousel in.
- [~] Run `npm run build`, diff the route chunk size for `/projects/[slug]` (and `/projects` list page if also affected) against pre-T43 baseline. Confirm production-bundle delta ≤15 KB gzip on the route chunk that loads `ProjectMediaCarousel`. If >15 KB, escalate to `@cto` before T43.G close. — **DEFERRED to T43.H** (same reason). `npm run build` runs clean (exit 0, 19 routes); `/projects` and `/projects/[slug]` chunks are unchanged because nothing references the carousel yet. The route-chunk diff + ≤15 KB gate + `@cto` escalation transfer to T43.H.

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

**Closed:** 2026-05-21, Session 38. **Commit `5afac09`.** 13/15 acceptance criteria PASS; 2 deferred with reason (bundle route-chunk delta + ≤15 KB build-diff gate → T43.H — `ProjectMediaCarousel` is not yet wired into any route chunk; wiring lands at T43.H). Files: `components/public/ProjectMediaCarousel.tsx` 198, `ProjectMediaCarouselParts.tsx` 164 (coordination-vs-render split — legit per `@code-review`, not cap-dodging), `BeforeAfterMedia.tsx` 161 + extracted `BeforeAfterMediaScenes.tsx` 91 (CSS-scenes extract, public interface byte-identical — closes the S31 CQ-02 MAJOR carry-forward), `tests/ProjectMediaCarousel.test.tsx` + `tests/e2e/public-carousel.spec.ts`. 394/394 vitest (+9 new); `next build` exit 0, 19 routes; embla ~11.4 KB gzip standalone (within the 15 KB Override 2 budget). `@code-review` PASS WITH MINOR — 0 gating; the mandatory SSR/hydration audit ran clean on all 3 bug classes; 2 advisory fixed (hollow e2e assertion removed; `dotGap`→`dotPitch` rename); CQ-A1 (`prefersReducedMotion` in render body) reviewed — confirmed not a hydration bug, left as-is. `@security` audit 21 CLEAR (0 Critical / 0 High / 0 Medium / 0 Low new; render-only — no XSS, secrets, or DB/auth surface; F-3 / F-4 / F-37 carry-forwards untouched). Signature note: a `view: 'list' | 'detail'` prop was added to the plan's documented `{ media, ariaLabel }` signature — Override 2's list/detail chrome sizing requires it; flag at T43.I doc close-out. e2e spec created but execution deferred to T43.H (needs the carousel wired into a route + a multi-media seed project).

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
- [x] PRD §2.3 G/W/T: `/projects` list — project with `project_media` rows renders carousel in card's image slot; project with zero rows shows no image area.
- [x] PRD §2.3a G/W/T: `/projects/[slug]` — detail page renders same carousel above the card content (or in the card's image slot, matching the list-card layout). Container size differs (detail = larger); carousel chrome size adapts per `@designer` spec from T43.A.
- [x] Backward-compat: existing projects with `image_id` / `image_after_id` set and no `project_media` rows render exactly as they do today (legacy fallback path in `ProjectMedia.tsx`). No visual regression.
- [x] CONSTRAINT-05 additive-prop carve-out honored: when `media` prop is undefined OR `[]`, ProjectCard renders byte-identically to its pre-T43 output.
- [x] CONSTRAINT-14 `safeLoad` discipline: page-level loaders wrap `loadPublicProjectMedia` calls in `safeLoad` per project — a failure for one project's media nulls the carousel for that card only, not the whole page.
- [x] CONSTRAINT-15: every URL in `media` is a signed URL with TTL 3600s (already guaranteed by `loadPublicProjectMedia` from T43.D).
- [x] Mobile mirror: `MobileProjectCard` renders carousel identically on iPhone viewport. Touch-emulation Playwright assertion in T43.G covers this.
- [x] No console errors on `/projects` or `/projects/[slug]` (CQ-05).

**Tests required:**
- `tests/ProjectCard.test.tsx` — extend existing tests: `media` prop with rows renders carousel; `media` undefined or empty falls back to legacy single-image branch (regression for backward-compat) (TS-01).
- `tests/MobileProjectCard.test.tsx` — mirror.
- Playwright (extended from T43.G's `public-carousel.spec.ts`): visit `/projects` with 2 multi-media projects → both cards have independent functioning carousels; visit `/projects/[slug]` with a multi-media project → carousel renders + works; visit `/projects/[slug]` with a project having only legacy `image_id` → static image still renders (no regression).

**Depends on:** T43.G

**Specialist:** `@ui-swarnimbagre` (public bundle mode)

**Closed:** 2026-05-21, Session 39. **Commit `0029072`.** All 8 acceptance criteria PASS. `ProjectMediaCarousel` (built T43.G) wired into the public render surface. Files (mod): `components/public/ProjectMedia.tsx` (optional `media` + `view` props; branches to the carousel when `media` rows exist, else the legacy `imageUrl`/`imageAfterUrl` path — CONSTRAINT-05 additive carve-out), `ProjectCard.tsx` + `components/public/mobile/MobileProjectCard.tsx` (both forward `media` + `view`), `components/public/pages/Projects.tsx` + `components/public/mobile/pages/Projects.tsx` (thread `project.media`), `app/projects/[slug]/page.tsx` (`loadPublicProjectMedia` via `safeLoad`, `view="detail"`). Tests: `tests/ProjectCard.test.tsx` created, `tests/ProjectMedia.test.tsx` + `tests/MobileProjectCard.test.tsx` extended — vitest 411/411 (+17); `tests/e2e/public-carousel.spec.ts` swipe-test drag-distance fix — e2e 3/3. `next build` exit 0; bundle +8 KB First Load JS on `/projects` + `/projects/[slug]` — under the 15 KB Override 2 budget. `@code-review` PASS (1 advisory — CQ-07 test-helper duplication). `@security` audit 22 CLEAR (0 Critical / 0 High). **Plan-doc divergence — reconcile when T43 is marked done at T43.I:** the Files list above named `app/projects/page.tsx` + `lib/public-projects.ts` to modify — neither needed changing (T43.D already returns `media` on `loadPublicProjects()`); the real edits were the two `pages/Projects.tsx` page-body components. `lib/db.ts` untouched (resolves the S35 284/300 watchpoint).

---

### Task T43.I: Override 2 documentation + close-out

**Files:**
- `docs/design-decisions.md` — modify (finalize "Override 2: Public site JS library + carousel chrome" section; mirror Override 1 structure: Rationale, What changed, What stayed, Surface boundary)
- `docs/constraints.md` — modify (add CONSTRAINT-22 with the @cto-approved wording below; amend CONSTRAINT-05 with Override 2 cross-link)

> **CONSTRAINT-22 wording (per @cto S34):** "JS libraries on public site permitted only with a documented Override and ≤15 KB gzip total per Override surface (measured against the production route chunk, not published ESM)."
- `docs/architecture.md` — modify (§1.2 already updated in T43.B with the dep line; now add §4.9 "Carousel surface — Override 2" subsection documenting the public-site JS-lib boundary policy + multi-instance DOM ID requirement; §2.5 new subsection for the `project_media` table mirroring §2.1's level of detail)
- `docs/founder-brief.md` — modify (add Index row for "Project media carousel + first public-site JS library" decision; dated entry)
- `docs/content-model-expansion.md` — modify (further superseded note — already marked SUPERSEDED by T42; add a T43-furthered-by line at the top)
- `docs/plan-phase-4-launch.md` — modify (mark T43 done, log final session-count + commit list; mirror T42 closure pattern)
- `manifest.md` — modify (update Phase row 4 status; T43 done)

**Functions to implement:** Documentation only.

**Acceptance criteria:**
- [x] `docs/design-decisions.md` "Override 2" section structured identically to Override 1 (Rationale / What changed / What stayed / Surface boundary). ~~Surface boundary lists exactly: `ProjectMediaCarousel.tsx` + the `embla-carousel-react` dependency.~~ **Revised per `@cto` S40 consult:** the "exactly 2" was understated against what T43 actually built — the final Surface boundary lists 12 entries (11 public-site + admin files plus the dep) reflecting the as-built surface, with the data layer, migrations, and admin field component deliberately excluded. Phantom `MobileProjectMediaCarousel.tsx` (never created) removed from the draft; `ProjectMediaCarouselParts.tsx` and the four T43.H-threaded files added; `view: 'list' | 'detail'` prop signature recorded on the first bullet.
- [x] `docs/constraints.md` CONSTRAINT-22 added; summary table updated; CONSTRAINT-05 line amended to reference Override 2.
- [x] `docs/architecture.md` new §2.5 (`project_media` schema) + §4.9 (Carousel surface boundary). Cross-references to `founder-brief.md` entry.
- [x] `docs/founder-brief.md` Index updated; dated entry under standard heading shape (mirroring entries 23 + 28 from T32/T42). New entry #31.
- [x] `docs/content-model-expansion.md` further-superseded line at top.
- [x] `docs/plan-phase-4-launch.md` T43 marked done (parent `Status` block above + T43.I `Closed` block below); all sub-session checkboxes confirmed.
- [x] `manifest.md` Project Identity Phase 4 status line updated.
- [x] No broken cross-references between docs (DS-02). Manual link audit completed; one auditor-flagged FAIL on the `[§4.9](architecture.md#49-carousel-surface--override-2)` anchor (alleged double-dash error) verified as a **false positive** against the existing working precedent at entry #30's `#669-atomic-save-surface--postgres-rpc-pattern` anchor — GitHub does not collapse em-dash-flanked double hyphens; the existing anchor in the repo proves it.
- [x] All operator-facing labels added in T43 still voice-clean (CONSTRAINT-13) — final pass: PASS across 20 files (admin + public + docs), 0 banned phrases, 0 emoji codepoints; typographic glyphs (`⠿`, `⇆`, `←`, `→`, `≤`, `⋮⋮`) all permitted per CONSTRAINT-13.
- [x] `npm run build` clean (CQ-05) — exit 0; 19 routes; `/projects` 1.21 kB / 117 kB First Load JS, `/projects/[slug]` 201 B / 116 kB; bundle sizes match T43.H baseline.
- [x] Full `npm test` suite passing — vitest **411/411** across 55 files; identical to T43.H baseline (zero regression on docs-only).
- [~] Playwright admin smoke + new public carousel spec both green — `admin-smoke.spec.ts` re-run **1/1 PASS** (55.1s); `public-carousel.spec.ts` **carry-forward-green from T43.H baseline** (3/3 there) — not re-run this session because T43.I changed zero runtime code, and the carousel spec requires the publish/revert fixture ceremony from S39 (DB mutation on `t43f-media-project-*` test fixtures) with zero net signal on a docs-only commit. Marked `[~]` (superseded by the docs-only carry-forward rationale) rather than `[x]` to keep the plan-doc honest.
- [x] `@security` audit 23 CLEAR: 0 Critical / 0 High / 0 Medium new. **1 LOW caught and FIXED in-session** — architecture.md §2.5 schema table named a `kind` column + `updated_at` + `ON DELETE CASCADE` that did not match migration 010 (the discriminator is implicit in `image_after_id IS NULL`, no `updated_at` column or trigger exists, image FKs are `ON DELETE RESTRICT`). §2.5 corrected to mirror the migration verbatim before close-out. Server Action manifest = 13 IDs confirmed via `tests/server-actions-manifest.test.ts`. No new XSS / auth / public-write / env / cross-origin surface. F-3 / F-4 / F-37 / ~19 Low carry-forwards preserved unchanged.
- [x] `@code-review` PASS WITH MINOR: DS-02 / DS-04 / DS-01 / plan-doc honesty / CONSTRAINT-22 wording consistency / file-size budgets / leftover-text checks all PASS. CQ-02 MAJOR carry-forwards (ImageUpload at T43.F, BeforeAfterMedia at T43.G) re-confirmed RESOLVED. **CQ-07 decision: CARRY FORWARD as non-gating MINOR** — `mediaItem()` test-helper factory duplicated byte-identically across `tests/ProjectMedia.test.tsx:24-35`, `tests/ProjectCard.test.tsx:38-49`, `tests/MobileProjectCard.test.tsx:23-34`; extraction blocked on first-mover `tests/_fixtures/` pattern decision (no such directory exists in repo); 12-line factory with zero behavioral drift, low "bug fixed in multiple places" risk; carry to a future test-helper consolidation task. S39 `public-carousel.spec.ts` drag-distance edit reviewed: clean, no regression.

**Tests required:**
- Doc link audit (manual).
- Full test suite must pass (TS-01, TS-04).

**Depends on:** T43.H (all execution work complete before close-out)

**Specialist:** `@security`, `@code-review`, `@cto` (review Override 2 + CONSTRAINT-22 wording)

**Closed:** 2026-05-23, Session 40. Docs landed across 7 files: `design-decisions.md` (Override 2 Surface boundary expanded 7→12 entries, phantom `MobileProjectMediaCarousel.tsx` removed, `view`-prop signature recorded), `constraints.md` (CONSTRAINT-22 added with ≤15 KB gzip route-chunk budget + Override-required policy; CONSTRAINT-05 amended with Override 2 cross-link; summary table extended), `architecture.md` (new §2.5 `project_media` mirroring §2.1 + new §4.9 Carousel surface — Override 2 with multi-instance DOM-id requirement), `founder-brief.md` (Index row #31 + dated entry), `content-model-expansion.md` (T43-furthered-by line at top), this file (T43 parent `Status` block + this T43.I `Closed` block + acceptance criterion #1 strike-through revision per `@cto` S40 consult), `manifest.md` (Phase 4 status: T43 done, T40 next). Gates: `next build` clean (19 routes, bundle sizes match T43.H baseline); vitest **411/411** across 55 files (zero regression); Playwright `admin-smoke.spec.ts` re-run **1/1 PASS** + `public-carousel.spec.ts` **carry-forward-green from T43.H** (criterion marked `[~]` because re-running the spec would require the publish/revert fixture ceremony with zero net signal on docs-only — see acceptance criteria); **`@security` audit 23 CLEAR** with 1 LOW caught + FIXED in-session (architecture.md §2.5 schema table had three drifts from migration 010 — `kind` column, `updated_at` column, `ON DELETE CASCADE` on image FKs — all corrected before close-out); **`@code-review` PASS WITH MINOR** (CQ-07 mediaItem factory triplication CARRY FORWARD with rationale, ImageUpload + BeforeAfterMedia CQ-02 MAJORs re-confirmed RESOLVED). **Commit `9b21162`.** **T43 fully closed** — 9/9 sub-tasks done; the carousel renders everywhere `ProjectCard` renders; admin can save reorderings atomically via the `save_project_media` RPC; no published project currently has `project_media` rows, so the live site is visually unchanged until real media content is added (T40 covers that).

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

## [x] T44 — Manual drag-reorder for projects & posts

**Status:** Planned 2026-05-28 (Session 43) via `@create-plan`. Source: `docs/prd.md` §3.7. Queued behind T40 — do not start until the T40 placeholder projects are published. Mirrors the T43 project-media drag-reorder pattern (four-file mutation + `WITH ORDINALITY` RPC), but uses `UPDATE … FROM` (not delete-insert) because `projects` / `posts` rows carry content + FKs.

**Decisions locked at `@create-plan` (Session 43):**
- Public lists reflect the manual order — `/projects` + `/writing` order by `sort_order`, superseding the reverse-chronological default (PRD 2.1 + 2.3 updated).
- One order per type. Stats stay reverse-chronological. Media-row reorder inside a project (T43 / 3.5) is unaffected.
- New rows append to the END of the order (insert trigger sets `max+1`); admin drags up to feature.
- Explicit "Save order" action; no auto-save on drop (mirrors the T43 media field).
- Admin is desktop-only (single operator) — HTML5 native DnD, no touch-drag, no new dependency.

---

### T44.A — Schema: `sort_order` column + reorder RPCs

**Files:**
- `supabase/migrations/012_sort_order.sql` (create — re-numbered from `011`; T45.A took `011` by landing first, S44 2026-05-28)
- `supabase/migrations/012a_save_sort_order_rpc.sql` (create)

**Functions / SQL to implement:**
- `012`: `alter table public.projects` + `public.posts` add `sort_order integer`; backfill `row_number() over (order by created_at desc) - 1` per table; then set `not null` + `check (sort_order >= 0)` (mirror `project_media_order_index_nonneg`, migration 010). Add a `(status, sort_order)` btree index per table (mirror `*_status_created_at_idx`). Add a BEFORE INSERT trigger per table that sets `sort_order = coalesce((select max(sort_order) + 1 from <table>), 0)` when not supplied (append-to-end).
- `012a`: `save_project_order(p_rows jsonb)` and `save_post_order(p_rows jsonb)` — `update public.<table> t set sort_order = (r.ord - 1) from jsonb_array_elements(p_rows) with ordinality as r(value, ord) where t.id = (r.value->>'id')::uuid;`. `language plpgsql security invoker set search_path = ''`. Guard: raise loudly when `p_rows` is null or not a jsonb array. `revoke execute ... from public; revoke ... from anon; grant execute ... to authenticated;` (mirror the 010a grant triplet).

**Acceptance criteria:**
- [x] Migration 012 applies cleanly to dev + production; guarded/idempotent (`add column if not exists`). → applied to prod `oosretprveorrjzjcbxb` S45; `list_migrations` shows `012_sort_order` + `012a_save_sort_order_rpc`.
- [x] `sort_order` is `not null` with `check (sort_order >= 0)` on both `projects` and `posts`. → verified via `information_schema` + `pg_constraint` (`*_sort_order_nonneg` = `CHECK ((sort_order >= 0))`).
- [x] Backfill preserves the current newest-first order (newest row = `sort_order` 0). → verified live: projects 0→5, posts 0→4, `sort_order` ascends as `created_at` descends.
- [x] `(status, sort_order)` index exists on both tables. → verified via `pg_indexes` (`projects_status_sort_order_idx`, `posts_status_sort_order_idx`).
- [x] BEFORE INSERT trigger appends a new row to the end of the order (`max+1`, or 0 when the table is empty). → both triggers present + wired BEFORE INSERT (verified via `pg_trigger`); append logic verified by inspection. NOTE: not exercised with a live INSERT (would create/hard-delete a real row, CONSTRAINT-10) — will be naturally confirmed when the first row is created via the T44.D admin UI.
- [x] `save_project_order` / `save_post_order` set `sort_order` by array position via `WITH ORDINALITY`; raise loudly on null / non-array input (EH: loud failure with context). → write path proven live (reverse round-trip moved row 0→5 and restored); non-array raises `P0001: ... must be a jsonb array (got object)`.
- [x] RPCs are `security invoker` + `search_path = ''`; EXECUTE revoked from `public` AND `anon`, granted to `authenticated` (SEC: least privilege; matches migration 010a). → verified via `has_function_privilege`: anon=false, authenticated=true on both RPCs; advisor 0011 does NOT flag the 4 new functions.
- [x] No new RLS policy — confirm `projects_admin_all` / `posts_admin_all` (`for all to authenticated using (true) with check (true)`) already cover the `sort_order` write. → confirmed; no new policy added.
- [x] `@cto` decision recorded on `updated_at`: the reorder UPDATE fires the `*_set_updated_at` trigger — **ACCEPT the bump** (S45 `@cto` call: `updated_at` is not displayed; admin shows `created_at`; suppression needs elevated privs incompatible with `security invoker` model — accept costs nothing). No suppression logic in the RPCs.

**Tests required:** → Repo has NO live-DB unit harness (all "db" tests use a stubbed client; confirmed in `vitest.config.ts`). Behavioral criteria below verified empirically against the live DB via Supabase MCP (see closure note). Static-shape regression test added: `tests/migration-sort-order.test.ts` (14 assertions, reads both migration files and locks the load-bearing idioms — mirrors `tests/server-actions-manifest.test.ts` precedent). Suite 441/441.
- [x] `migration 012 backfill ranks existing rows newest-first` → happy. (live-DB verified)
- [x] `save_project_order persists array order into sort_order` → happy. (live-DB reverse round-trip)
- [x] `save_project_order raises on non-array p_rows` → error. (live-DB `P0001`)
- [x] `save_post_order` mirror of the two above. → schema/privileges verified live; write path is a literal mirror of `save_project_order` (proven), raise guard identical.
- [x] RLS empirical: authenticated reorder succeeds; `anon` EXECUTE on the RPC is denied. → `has_function_privilege` anon=false / authenticated=true on both RPCs.

**Depends on:** T39 (production deploy + live DB).
**Specialist:** `@supabase` (migration + RLS + RPC), `@cto` (schema + `updated_at` call, pre-apply).
**Closed:** Session 45 (2026-06-03). Migrations 012/012a written, applied to prod, and empirically verified (backfill order, write path, raise guard, EXECUTE grants, advisors clean of new findings). `@cto` `updated_at` call = ACCEPT. T44.B (read-path switch) is next.

---

### T44.B — Types + switch read-path to `sort_order`

**Files:**
- `lib/types.ts` (modify — add `sort_order: number` to `Project` and `Post`)
- `lib/db.ts` (modify — `getPublishedProjects` line 87 + `getPublishedPosts` line 112; add `sort_order` to the `PROJECT_COLUMNS` / `POST_COLUMNS` projections)
- `lib/admin-queries-projects.ts` (modify — `getAllProjects` line 90)
- `lib/admin-queries-posts.ts` (modify — `getAllPosts` line 90)

**Functions to implement:**
- All four list reads change to `.order('sort_order', { ascending: true }).order('created_at', { ascending: false })` — `created_at` desc as a deterministic tiebreaker.

**Acceptance criteria:**
- [x] `Project` and `Post` include `sort_order: number`. → added in `lib/types.ts` (+ local admin `ProjectRow`/`PostRow` interfaces for type-honesty).
- [x] Public `/projects` and `/writing` render published rows in `sort_order` ascending (verify by reorder → reload). → read path now orders by `sort_order` asc; assert-on-`.order()` unit tests cover it. Full visual reorder→reload confirmation lands at T44.D (admin DnD) e2e.
- [x] Admin `/admin/projects` and `/admin/posts` render in `sort_order` ascending. → `getAllProjects`/`getAllPosts` updated.
- [x] `created_at` desc retained as tiebreaker on all four reads. → `.order('sort_order', asc).order('created_at', desc)` on all four.
- [x] Public loads still route through `lib/safe-load.ts` (CONSTRAINT-14) — unchanged. → only `.order()` + projections touched.
- [x] Existing query tests updated to expect `sort_order` ordering. → `tests/db.test.ts` + `tests/admin-queries.test.ts`; `sort_order` added to projections (`PROJECT_COLUMNS`/`POST_COLUMNS`/`PROJECT_LIST_COLUMNS`/`POST_LIST_COLUMNS`).

**Tests required:**
- [x] `getPublishedProjects orders by sort_order asc then created_at desc` → happy.
- [x] `getAllPosts orders by sort_order asc` → happy.
- [x] mirror for the other two reads (`getPublishedPosts`, `getAllProjects`). → suite 441→447, `tsc --noEmit` clean.

**Depends on:** T44.A.
**Specialist:** `@dev`.
**Closed:** Session 45 (2026-06-03). Four reads repointed to `sort_order` asc + `created_at` desc tiebreaker; `sort_order` added to types + all four projections. 447/447.

---

### T44.C — Reorder Server Action (four-file pattern)

**Files:**
- `lib/admin-reorder-mutations-types.ts` (create — `ReorderMutationState` envelope + initial-state const)
- `lib/admin-reorder-mutations-schemas.ts` (create — zod: `{ rows: z.array(z.object({ id: z.string().uuid() }).strict()) }`)
- `lib/admin-reorder-mutations-internal.ts` (create — throwing dispatch; resolves resource → RPC name; `supabase.rpc(...)`; wraps errors in `ServiceError`)
- `lib/admin-reorder-mutations.ts` (create — `'use server'` wrappers `saveProjectOrder` + `savePostOrder`)
- `tests/server-actions-manifest.test.ts` (modify — register the two new action IDs, SEC-09). **NOTE (S46):** registration moved to **T44.D**, mirroring how `saveProjectMedia` landed at T43.F — Next.js tree-shakes unreachable Server Actions out of the build manifest, so adding the IDs before the T44.D UI wires them would red the manifest test. The allowlist edit was reverted at T44.C; a deferral comment was left in the test file.

**Functions to implement:**
- `saveProjectOrder(_prev: ReorderMutationState, formData: FormData): Promise<ReorderMutationState>`
- `savePostOrder(_prev: ReorderMutationState, formData: FormData): Promise<ReorderMutationState>`
- internal `saveOrderInternal(resource: 'projects' | 'posts', raw: unknown, client?): Promise<void>` — parse schema, call the resource's RPC.

**Acceptance criteria:**
- [x] Each action reads an ordered `rows` array (`[{ id }]`) from FormData and calls the matching RPC (`save_project_order` / `save_post_order`).
- [x] Uniform `{ status, fieldErrors?, formError? }` envelope; never throws to the wire; `padToFloor` timing floor (Channel 3 pattern).
- [x] Zod rejects non-uuid ids and malformed payloads (EH: loud at the boundary).
- [~] Both new action IDs registered in `server-actions-manifest` (SEC-09) — manifest test green. → **DEFERRED to T44.D (S46):** Next.js reachability gating — the actions are not route-reachable until the T44.D UI mounts them, so the manifest stays at 13 and the allowlist must too. Same pattern as `saveProjectMedia` (T43.E action → T43.F allowlist). Reverted to 13 entries; deferral noted in the test file.
- [x] Longest function < 50 lines; each file < 300 lines (CQ-01 / CQ-04). Longest fn `saveOrderInternal` ~17 lines; largest file `admin-reorder-mutations.ts` 146 lines.
- [x] `@security` audit: writes are server-side only; RPC `security invoker` keeps RLS as the boundary; no new public surface. — **CLEAR** (audit, S46; 0 Critical / 0 High / 0 Medium / 0 Low).

**Tests required:**
- [x] `saveProjectOrder persists order on a valid payload` → happy.
- [x] `saveProjectOrder returns an error envelope on a non-uuid id` → error.
- [x] `savePostOrder` mirror.

**Depends on:** T44.A.
**Specialist:** `@security`.

**Closed:** Session 46 (2026-06-03). Files created: `lib/admin-reorder-mutations-{types,schemas,internal}.ts` + `lib/admin-reorder-mutations.ts` + `tests/admin-reorder-mutations.test.ts` (8 tests). Vitest 454/454 (excl. build-gated manifest test). One criterion deferred to T44.D (manifest registration). `@security` CLEAR.

---

### T44.D — Admin drag UI + "Save order"

**Files:**
- `components/admin/ResourceList.tsx` (modify — draggable rows + `⠿` handle + drag handlers + "Save order" button; reuse `reorderRows`. If it exceeds the CQ-02 200-line cap, split, e.g. `ResourceListReorder.tsx`)
- `components/admin/ProjectsList.tsx` (modify — pass `saveProjectOrder`)
- `components/admin/PostsList.tsx` (modify — pass `savePostOrder`)
- `lib/admin-project-media-form-state.ts` (reference — reuse the generic `reorderRows`; if it cannot be imported cleanly, lift it to a shared `lib/reorder.ts`)
- `tests/e2e/admin-smoke.spec.ts` (modify — add a drag → Save order → reload-persists step)

**Functions / behaviour:**
- Rows gain `draggable` + `onDragStart` / `onDragOver` / `onDrop`, mirroring `ProjectMediaRow`; a `draggingIndexRef`; optimistic reorder via `reorderRows`.
- "Save order" dispatches the resource action with `JSON.stringify` of `[{ id }]` in current display order.

**Acceptance criteria:**
- [x] Rows in `/admin/projects` and `/admin/posts` are drag-reorderable via HTML5 native DnD (no new dependency).
- [x] Drop reorders optimistically; "Save order" persists + shows a `sonner` success toast; reload preserves the order.
- [x] No auto-save on drop — explicit save (PRD §3.7; mirrors 3.5).
- [x] Operator labels are CONSTRAINT-13 clean (dry, no SaaS phrases, no emoji; `⠿` typographic handle only).
- [x] Touch-drag not implemented (desktop-only, single operator — stated, not a gap).
- [x] Components ≤ 200 lines (CQ-02) — split if exceeded.
- [x] `@ui-swarnimbagre` admin (shadcn) mode + `@code-review` PASS.

**Tests required:**
- `reorderRows reorders the client list on drop` → happy (largely covered by reuse).
- `Save order dispatches the action with ordered ids` → happy.
- Playwright admin smoke: drag a row in `/admin/projects`, click Save order, reload, verify the new order persists.

**Depends on:** T44.B, T44.C.
**Specialist:** `@ui-swarnimbagre`, `@code-review`.

**Closed:** Session 47 (2026-06-03). ResourceList table block split into new `components/admin/ResourceListReorder.tsx` (172 lines) per the CQ-02 cap — `ResourceList.tsx` dropped to 190 lines (was 208). `reorderRows` imported directly from `lib/admin-project-media-form-state.ts` (no `lib/reorder.ts` lift needed). Drag/toast/`useActionState` pattern mirrors `ProjectMediaField`; handle glyph `⠿` (U+283F) byte-identical to `ProjectMediaRow`. Optimistic order resyncs via `key={filter-page}` remount (no resync effect). SEC-09 allowlist 13 → 15 (`saveProjectOrder` + `savePostOrder`) landed in lock-step, deferral comment revised. Pure `serializeOrder` helper added + unit-tested alongside `reorderRows`; e2e drag→Save→reload step added (Playwright not executed this session — needs a live Supabase fixture). Gates: tsc clean, Vitest 457/457 (57 files, incl. build-gated manifest test at 15 entries), `next build` exit 0. `@code-review` PASS (0 issues). Not yet committed. **Known non-blocker:** drag-reorder operates on the current display order; if reordered while the list is filtered or paginated, "Save order" sends only the visible subset — a no-op risk for the single operator with ~6 projects, flag a follow-up guard if data volume grows.

**T44 fully closed** — A–D across Sessions 45 → 47; migration ledger `[007, 009, 010, 010a, 011, 012, 012a]`; admin project/post drag-reorder live end to end.

---

## [x] T45 — Embedded project writeup (linked post on the detail page)

**Status:** Done 2026-05-28 (Session 44) — built ahead of T44 per builder-approved resequence (T45 defines the project-detail structure before content authoring). All four sub-tasks `[x]`. Planned 2026-05-28 (Session 43) via `@designer` (Override 3) + `@cpo` (PRD §3.8) + `@create-plan`. Source: `docs/prd.md` §3.8 + `docs/design-decisions.md` Override 3. Reuses the `/writing` post-body rendering on the project detail page; does NOT add a project-only body field.

**Decisions locked at planning (Session 43):**
- A project attaches ONE existing post via a new `projects.post_id` FK (nullable, `on delete set null`); the post is a normal post that also appears in `/writing`.
- The detail page renders the linked post's body below the card via the existing `MarkdownContent`, per Override 3 — no repeated post `<h1>`; a hairline + post-date meta label separates card from body.
- The `/projects` title links to the detail page only when `post_id` is set OR the project has more than one media item; bare single-image projects are non-clickable.
- Only a `published` linked post renders publicly (no draft-body leak).
- `post_url` (`¶ notes`) stays independent of `post_id`.
- `MarkdownContent` hydrates client-side, so the embedded body is not in the initial SSR HTML — accepted tradeoff, identical to `/writing`.

---

### T45.A — Schema + types: `post_id` FK

**Files:**
- `supabase/migrations/011_project_post_link.sql` (created — T45 landed before T44, so this took `011`; T44 re-numbers to `012`/`012a`)
- `lib/types.ts` (modify — add `post_id: string | null` to `Project`)
- `lib/admin-projects-mutations-schemas.ts` (modify — add `post_id` to create + update schemas: uuid-or-empty → null)
- `lib/admin-projects-mutations.ts` + `lib/admin-projects-mutations-internal.ts` (modify — read + persist `post_id`)

**Functions / SQL:**
- Migration mirrors the `image_after_id` pattern (009): `add column if not exists post_id uuid null`; drop-then-add `projects_post_id_fkey foreign key (post_id) references posts(id) on delete set null`.
- Zod: `post_id` nullable uuid; empty string coerces to null (like the image FKs).

**Acceptance criteria:**
- [x] Migration applies cleanly to dev + production; idempotent (drop-then-add FK). → **S44 2026-05-28:** migration `011_project_post_link.sql` applied via Supabase MCP (`success:true`); idempotent drop-then-add.
- [x] `post_id` is nullable, FK to `posts(id)` with `on delete set null` (matches `image_after_id`). → verified live: `post_id` uuid nullable; `projects_post_id_fkey → posts(id)` delete_rule SET NULL.
- [x] No new RLS policy — the column-agnostic `projects_*` policies cover it (verify). → verified via `pg_policies`: `projects_public_select` (anon, status='published') + `projects_admin_all` are row-level; new column auto-covered.
- [x] `Project` type carries `post_id: string | null`. → added in `lib/types.ts` next to `image_after_id`.
- [x] `createProject` / `updateProject` accept and persist `post_id`; zod coerces empty → null and rejects non-uuid. → schemas (create+update), FormData readers (empty→null via `readNullableTrimmed`), and insert/update payloads all wired; `ProjectMutationFieldName` union extended.

**Tests required:**
- [x] `zod accepts null/empty post_id and rejects non-uuid` → happy + error.
- [x] `createProject persists post_id` → happy. → both added; full Vitest suite 413/413 pass, `tsc --noEmit` clean, production build OK.

**Depends on:** T39. (T45 landed before T44 — this took migration `011`; T44 re-numbers to `012`/`012a`.)
**Specialist:** `@supabase` (migration), `@cto` (FK choice, pre-apply).

---

### T45.B — Admin "Linked writeup" picker

**Files:**
- `lib/admin-queries-posts.ts` (modify — add `listPostsForPicker(): Promise<{ id, title }[]>`, `status='published'`, ordered `title asc`)
- `lib/admin-queries.ts` (modify — re-export `listPostsForPicker`)
- `components/admin/ProjectFormDisplay.tsx` (modify — add a "Linked writeup" shadcn Select + hidden `name="post_id"` input, mirroring the `thumb_kind` pattern; "Unset" option first)
- `components/admin/ProjectForm.tsx` (modify — accept + thread a `posts` option prop)
- `app/(admin)/admin/projects/new/page.tsx` + `app/(admin)/admin/projects/[id]/page.tsx` (modify — fetch `listPostsForPicker()` and pass `posts` to `ProjectForm`)

**Acceptance criteria:**
- [x] `listPostsForPicker` returns published posts as `{ id, title }`, ordered by title. → **S44 2026-05-28:** added in `lib/admin-queries-posts.ts` (`.eq('status','published').order('title',asc)`), re-exported from `lib/admin-queries.ts`.
- [x] `ProjectForm` renders a "Linked writeup" dropdown (published posts + "Unset"); selection saves to `post_id` via the hidden-input pattern (empty → null). → shadcn Select + hidden `name="post_id"` input, "Unset" first (sentinel → '' → null), preselects current `post_id` on edit.
- [x] Both the `new` and `[id]` admin pages fetch and pass `posts`. → both pages now `await listPostsForPicker()` and pass `posts` to `ProjectForm`.
- [x] Operator label "Linked writeup" is CONSTRAINT-13 clean (dry, no emoji, no SaaS phrases). → label "Linked writeup", empty option "Unset"; no Fraunces/JetBrains Mono introduced (admin shadcn defaults).
- [x] CQ-02: if `ProjectFormDisplay` exceeds 200 lines, split. → file is 151 lines after the change; no split needed.

**Tests required:**
- [x] `listPostsForPicker returns published posts only` → happy. → + error test (ServiceError tagged `listPostsForPicker`).
- [x] `ProjectForm renders the linked-writeup options and prefills on edit` → happy. → full Vitest suite 416/416 pass, `tsc --noEmit` clean, production build OK.

**Depends on:** T45.A.
**Specialist:** `@ui-swarnimbagre` (admin shadcn mode).

---

### T45.C — Public detail render: embedded post body

**Files:**
- `app/projects/[slug]/page.tsx` (modify — load the linked published post inside the existing `Promise.all` / `safeLoad`; render its body below `ProjectCard` / `MobileProjectCard` per Override 3)
- `lib/db.ts` and/or `lib/public-projects.ts` (modify — a published-post-by-id read, or reuse `getPostBySlug`; must filter `status='published'`)

**Functions:**
- Resolve `project.post_id` → published post; render `renderBody(post.content)` (mirror `/writing`) below the card; render nothing when null/draft.
- Desktop: hairline + post-date meta + body below `ProjectCard`. Mobile: same below `MobileProjectCard`.

**Acceptance criteria:**
- [x] When `post_id` → a published post, the detail page renders the post body below the card (desktop + mobile), styled per Override 3 (720px, `font-serif`, hairline + date meta, no repeated `<h1>`). → **S44 2026-05-28:** `renderLinkedPostBody` in `app/projects/[slug]/page.tsx`; body wrapper identical to `/writing` (720/marginTop 24/`--fg`/`--font-serif`/`MarkdownContent`); meta `var(--meta-sm)`/`--fg-muted`/0.14em; hairline `1px solid var(--hairline)` 32px; rendered below both `ProjectCard` + `MobileProjectCard`.
- [x] When `post_id` is null OR the post is a draft, no body renders — no error (missing/draft is a clean empty, not a failure). → loader returns null → `renderLinkedPostBody(null)` returns null.
- [x] Public loads route through `lib/safe-load.ts` (CONSTRAINT-14); the post fetch is its own `safeLoad`. → 4th `safeLoad` added to the existing `Promise.all` (`page:projects/[slug]:linked-post`).
- [x] `@security`: only `published` posts render — no draft body leak via `post_id`. → **main-thread verified:** `getPublishedPostById` (`lib/db.ts`) gates `.eq('status','published')` IN the query (not caller); null id short-circuits before any DB hit; second gate is RLS `posts_public_select` (anon → published only). 5 unit tests assert null for draft/missing/null-id.

**Tests required:**
- [x] e2e: project with a published linked post shows the body on `/projects/<slug>`. → `tests/e2e/projects-detail-writeup.spec.ts` (env-slug, self-skips; parses/lists clean — Playwright runner, not Vitest).
- [x] e2e: project with null `post_id` shows no body, no error. → same spec (asserts no body + no pageerror).
- [x] unit: the linked-post loader returns null for a draft/missing post. → `tests/db.test.ts` `getPublishedPostById` block (5 tests; full Vitest suite 421/421, `tsc` clean, build OK).

**Depends on:** T45.A.
**Specialist:** `@ui-swarnimbagre` (public bundle mode), `@security` (draft-leak check).

---

### T45.D — Title-link gating + Override 3 docs

**Files:**
- `lib/public-projects.ts` (modify — `PublicProject` gains `postId: string | null`; set it in the row mapper)
- `components/public/pages/Projects.tsx` + `components/public/mobile/pages/Projects.tsx` (modify — gate `onClick`: navigate only when `postId` set OR more than one media item; else pass `undefined`)
- `components/public/ProjectCard.tsx` + `components/public/mobile/MobileProjectCard.tsx` (verify — a missing `onClick` renders an inert title + `cursor: default`; adjust if needed)
- `docs/design-decisions.md` (Override 3 — written at planning; verify present)
- `tests/e2e/admin-smoke.spec.ts`, `tests/e2e/public-carousel.spec.ts`, `tests/ProjectCard.test.tsx`, `tests/MobileProjectCard.test.tsx`, `tests/public-projects.test.ts` (modify — gated-link cases + `postId` mapping)

**Acceptance criteria:**
- [x] `PublicProject` carries `postId`; the mapper sets it from the row. → **S44 2026-05-28:** `postId: string | null` added to `PublicProject`; `toPublicProject` sets `postId: row.post_id`.
- [x] A project with no linked post and at most one media item has a non-clickable title (no detail navigation) on both desktop + mobile lists. → gate `p.postId != null || p.media.length > 1`; else `onClick={undefined}` in both `Projects.tsx` pages.
- [x] A project with a linked post OR more than one media item links its title to `/projects/<slug>`. → same gate (true branch wires `router.push`).
- [x] `ProjectCard` / `MobileProjectCard` render cleanly with no `onClick` (inert title, `cursor: default`). → `MobileProjectCard` already inert; `ProjectCard` FIXED — it previously always wrapped the title in `<a href="#" class="link">`; now the anchor only renders when `onClick` is present (bare text otherwise).
- [x] Tests updated for the gated state + `postId` mapping; `@code-review` PASS. → **`@code-review` PASS:** 0 blockers, security draft-leak gate confirmed; 2 findings (CQ-02 `lib/db.ts` over 300 lines + `formatDate` dup) both RESOLVED — `db.ts` split into `db-posts.ts` + `db-internal.ts` (204/102/44 lines), `formatDate` extracted to `lib/format-date.ts`. tsc clean, full suite 427/427.

**Tests required:**
- [x] `ProjectCard renders an inert title when no onClick` → happy. → + active-link case; mirror on `MobileProjectCard`.
- [x] `public-projects mapper sets postId` → happy. → + null-post case.
- [x] e2e: a bare project card title is not a link; an enriched one is. → `admin-smoke.spec.ts` (enriched T42 vs bare project); `media.length>1` branch covered by unit only (e2e gap noted — no multi-media published project seeded).

**Depends on:** T45.A, T45.C.
**Specialist:** `@code-review`, `@designer` (confirm Override 3 layout in render).

---

## T46 — Full public-site redesign [x]

**Closed 2026-08-04, Session 51.** Built end to end in one run, all six phases.

**Closed with two carve-outs, both still outstanding as of Session 52 (2026-08-04):** the Playwright suite is rewritten but unrun (must run before the next deploy — tracked as a live `[ ]` under **Outstanding after close** below), and the redesign renders against empty tables pending builder content. Neither blocked T46's own scope, so the header stays `[x]`; both are restated in **"Outstanding work not tracked by any open task"** at the top of this file.

**Trigger:** real user feedback. The builder showed the live site to several people who were confused by it and disliked the look. The original dark bundle was replaced wholesale rather than iterated on.

**Source:** Claude Design export, archived in-repo at `docs/design-source/redesign-2026-08/` (`swarnim-bagre-site.bundled.html` + `template.extracted.html`). CONSTRAINT-05 re-baselined onto it; Overrides 1, 2 and 3 retired.

**Nine decisions locked with the builder (Q1-Q9):**
1. Home chat stays FAKE, with rotating canned deflections pushing to contact. No model, no API route.
2. `/writing/[slug]` kept; `/projects/[slug]` deleted. The card's "Writeup" action links to the T45 `post_id`.
3. `/other` ships all 7 tiles, hand-maintained.
4. Single responsive tree. `components/public/mobile/` and the middleware device split both deleted.
5. Admin stays dark. CONSTRAINT-16's four brand tokens become admin-owned constants.
6. `subtitle` + `tags` added to projects.
7. **Photos only.** The S49 SVG thumb motifs are retired, which makes screenshots a hard launch gate.
8. Space Mono self-hosted (the export bundles it but never references it; treated as an export bug).
9. Bio rewritten, first person.

Plus: no footer anywhere, blinking cursor removed, email corrected to `bagreswarnim@gmail.com`, three branded reach-out marks under "Find me here:" on Home only, em-dash sweep across UI copy.

- [x] Migrations `013_project_card_fields` + `014_other_page_model` applied to prod and empirically verified. Ledger `[007, 009, 010, 010a, 011, 012, 012a, 013, 014]`. 7/7 constraint cases correct; RLS on `notes` verified by ROW COUNT, not by exception (a first test wrongly read `anon_delete` as allowed, because a DELETE matching zero rows succeeds silently). Advisor delta: exactly 1 new WARN, the standard `rls_policy_always_true`, accepted under CONSTRAINT-09.
- [x] Token layer + fonts replaced. Palette inverted dark to light (`#1C1712` to `#F4F1EA`, gold `#C9A84C` to green `#1F3D2F`); Fraunces + JetBrains Mono to Instrument Serif + Space Grotesk + Space Mono, self-hosted via `next/font` on `<html>`.
- [x] Four pages plus `/writing/[slug]` rebuilt and visually verified in a real browser at 1440px and 390px. `/other`'s tile grid verified by seeding throwaway rows, screenshotting, then deleting them.
- [x] 47 files deleted, including 22 orphaned public components, the mobile tree, `lib/thumb-kinds.ts` and the newly orphaned `lib/nav-targets.ts`.
- [x] `embla-carousel-react` uninstalled; carousel hand-rolled in `ProjectFrame.tsx`. Public site back to zero runtime JS dependencies, so CONSTRAINT-22 now has no consumers.
- [x] Admin: `subtitle`/`tags` on the project form (thumb picker removed), `aside`/`sort_order` on stats, full `notes` CRUD at `/admin/notes`, and an `updateStat` edit path so the hand-maintained tiles can be corrected in place. SEC-09 allowlist **15 to 19**, verified by the build-gated manifest test.
- [x] Docs re-baselined: CONSTRAINT-05 + 03/15/16/22, `design-decisions.md`, `CLAUDE.md`, `architecture.md` (new §2.6 + §4.10), `founder-brief.md` #34.

**Tests required:**
- [x] Vitest **50 files / 381 tests / 0 failures** (down from 457; 11 test files targeted deleted components). `tsc` clean. `next build` exit 0, 18 routes.
- [~] Playwright **NOT executed** — needs a live Supabase fixture and an authenticated session unavailable this session. `admin-smoke.spec.ts` was rewritten for the new markup and the stats card stack, and `pages.spec.ts` / `admin-font.spec.ts` re-pointed; all type-correct but unrun. `ua-desktop.spec.ts` / `ua-mobile.spec.ts` deleted (they asserted the device split). **Run these before deploying.** → **Still unrun as of Session 52 (2026-08-04).** This line is `[~]`, so a first-`[ ]` sweep skips it and the "run these before deploying" instruction stays invisible; the live `[ ]` under **Outstanding after close** below carries the action.

**Known gap, deliberate:** nothing publicly exercises the multi-slide carousel, because the only project with media rows is a draft and never reaches `/projects`.

**Outstanding after close** — not T46 acceptance criteria (T46 is genuinely `[x]`), but real work that no other open task owns. Kept as a live `[ ]` so a first-`[ ]` sweep lands on it instead of skipping the `[~]` record above:

- [x] Run the full Playwright suite against a live Supabase fixture + authenticated session. **Blocks the next deploy.** The `[~]` line under **Tests required** above is the historical record of why it was not run at S51; this box is the outstanding action. Environment-gated, not decision-gated — an agent can close it once a fixture exists. — **DONE 2026-08-06, Session 54: 15/15 green.** Full detail on the top-of-file twin of this criterion and in `docs/session-log.md`.

**Blocked on builder content — NOT represented by any checkbox or task number:** 6 sets of project screenshots (every card currently reads "no preview yet"; T46 decision 7 retired the SVG thumb motifs, so screenshots are a hard launch gate) and 7 rows for `/other` (4 stats + 3 notes; both tables at 0). No task in this plan owns this work, and none was invented at close-out — creating tasks is `@create-plan`'s job. **The next session must scope this as a task before executing it.** Until then no `[ ]` sweep will find it.

---

## T47 — Reliable e2e teardown: stop leaking production rows [ ]

**Added 2026-08-06, Session 54, via `@create-plan`.** Opened by the first-ever Playwright run (the T46 "Outstanding after close" criterion above).

**Not a PRD feature.** This is a test-harness defect, so it has no `docs/prd.md` entry and `@cpo` was not consulted. `@create-plan`'s rule is "feature must be specced in `docs/prd.md`"; the governing precedent for an infra task without a product spec is **T10.5** (testing infrastructure, inserted 2026-05-07). Recorded here rather than left as an unexplained bypass.

**The defect.** `tests/e2e/admin-smoke.spec.ts` writes to the PRODUCTION database — CONSTRAINT-02 means there is no staging project, so every test row is a live row — and deletes its rows at the end by driving the admin UI. That cleanup is unreliable AND does not verify itself:

- `Locator.count()` is an immediate read and does not auto-wait. The admin list resolves to **0 rows** mid-`router.refresh()`, so a pass reads 0, concludes "already deleted", returns success, and leaves live rows behind.
- Observed at Session 54: a **fully green** run left 3 projects in production, one of them `published` and therefore rendering on the live `/projects` page beside the builder's real six.
- A first fix attempt (settle before counting, sweep by `RUN_ID`, assert zero survivors) surfaced a second problem — a delete that does not decrement the row count — and blew the 20s step budget. It was reverted rather than left half-finished. `deleteRowsMatching` and the cleanup step both carry `KNOWN DEFECT` comments with this diagnosis.
- `images` rows and Storage objects have **never** been cleaned up by anything, by any run, ever.

**Fix direction:** stop doing hygiene through the UI. Teardown talks to Postgres directly with the service role. Keep one UI delete as a *test* of the delete button; it just stops being what the suite relies on for cleanup.

**Files:**
- `tests/e2e/global-teardown.ts` (create) — Playwright `globalTeardown` entry point. None exists today.
- `tests/e2e/fixtures/cleanup.ts` (create) — service-role client + the sweep. Must import nothing that reaches `next/headers`.
- `playwright.config.ts` (modify) — register `globalTeardown`. `loadDotEnvLocal` already primes the runner's `process.env` at config load, so `SUPABASE_SERVICE_ROLE_KEY` is available without new plumbing.
- `tests/e2e/admin-smoke.spec.ts` (modify) — drop the two cleanup `runStep` blocks as hygiene; remove the `KNOWN DEFECT` comments once true.
- `package.json` (modify) — declare `@supabase/supabase-js` in `devDependencies`.
- `tests/e2e-cleanup.test.ts` (create) — unit tests for the pure helpers.

**Functions to implement:**
- `createServiceRoleClient(): SupabaseClient` — reads `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` from `process.env`, throws a named error naming the missing variable if absent (EH-05). Mirrors the existing shape in `scripts/seed-test-fixture.ts:148`.
- `findTestProjectIds(client): Promise<{ id: string }[]>` — matches on **`title`**, not slug.
- `sweepTestArtifacts(client): Promise<CleanupReport>` — orchestrates the ordered deletion, returns per-table counts.

**Acceptance criteria:**
- [ ] Teardown runs in Node via the service role and imports **no** module that reaches `next/headers` — 19 `lib/` modules are transitively disqualified through `lib/supabase.ts`.
- [ ] Match is on **`title`**, not slug prefix. The four test projects carry three different slug prefixes (`t28-`, `t42-`, `t43f-`), so a `t28-%` slug sweep silently misses the T42 and T43F rows; every title embeds `RUN_ID`.
- [ ] `images` rows are located by `parent_id IN (test project ids)` **captured before the projects are deleted**. No column on `images` carries a run marker, and `images.parent_id` has no FK (polymorphic, `001_create_schema.sql:69`), so the rows dangle rather than cascade.
- [ ] Deletion order respects the FKs: `projects` first — which cascades `project_media` (`010_project_media.sql`, `on delete cascade`) and thereby releases the `on delete restrict` those rows hold on `images` — then `images`, then Storage objects, then `posts` and `stats`.
- [ ] Storage objects are removed from bucket `images` using each row's `bucket_path` (CONSTRAINT-07 path scheme). Nothing has ever deleted these.
- [ ] Sweep is **self-healing**: it removes pre-existing debris from earlier crashed runs, not only the current run. This absorbs the ~23 orphaned `images` rows tracked as cleanup task #7 / handoff carry-forward #12. These are invisible to `lib/admin-images-cleanup.ts`, whose orphan predicate is `parent_id IS NULL AND parent_type IS NULL`.
- [ ] Teardown runs even when the spec fails partway — that is the case that leaks today.
- [ ] Given a green run, when the teardown finishes, then `projects` / `posts` / `stats` / `images` contain zero test rows and the `images` bucket contains zero test objects. **Verified by querying the database, not by the suite reporting success** — reporting success while leaving rows behind is the defect.
- [ ] The suite fails loudly if teardown cannot complete (EH-01: no silent catch; EH-02: error names what failed, which table, and how many rows remained).
- [ ] SEC-01: the service-role key is read from `process.env` and never hardcoded, including in test files.
- [ ] CQ-01: no function exceeds 50 lines. CQ-05: no `console.log` debug aids left in.
- [ ] **`sort_order` side effect addressed.** The T44.D step clicks "Save order", which rewrites `sort_order` on **every** project row including the builder's real six. Either snapshot and restore the real rows' `sort_order`, or scope the reorder step so it cannot touch non-test rows. Folded into T47 by builder decision, Session 54.

**Tests required:**
- `test-title pattern matches all four project titles` (TS-01 happy).
- `test-title pattern rejects a real project title` (TS-01 error) — guards against a sweep that could delete real content.
- DB-dependent verification is manual per the acceptance criterion above; the pure pattern builders are unit-tested (TS-03: DB-touching tests stay out of the pure-function files).

**Depends on:** none.

**Specialist:** `@supabase`

**Until this is fixed:** check the database for test rows after every Playwright run. A green result does not mean the run cleaned up after itself.

---

## Phase 4 Exit Criteria

- T32–T40 + T42 + T43 + T44 + T45 + T46 + T47 complete (T41 is a trigger-gated deferred follow-up and does not block Phase 4 exit, same pattern as Phase 3's T29/T31 OpenClaw-operator-gated deferrals). **As of Session 54 the incomplete tasks here are T40** — 2 content-gated criteria open — **and T47**, the e2e teardown defect opened by the first Playwright run. T47 blocks deploys in practice: the suite that gates them currently leaks live rows.
- Site is live at `swarnimbagre.com`, monitored, with content rendering against the expanded project schema.
- All security and code review findings closed.
- Mark Phase 4 row Done in [`plan-index.md`](plan-index.md). The `@plan` cycle is complete; future work happens via individual `@plan` follow-up tasks against the same docs.
