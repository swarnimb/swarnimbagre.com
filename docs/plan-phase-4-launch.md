# Plan — Phase 4: Polish + Launch

**Date:** 2026-05-06
**Status:** Active — T32–T38 done (T38 doc audit complete; 9/10 criteria met, only the DS-05 fresh-clone manual run outstanding — tracked separately); T39–T40 remaining (as of 2026-05-15, Session 25)
**Tasks:** T32–T40 (9 tasks)
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
- [ ] Final commit on `main`. Vercel auto-deploy succeeds (verify in dashboard).
- [ ] DNS for `swarnimbagre.com` apex and `www` cut over to Vercel. TTL is set sensibly (e.g., 300s for cutover, raise to 3600+ once stable).
- [ ] HTTPS is live; `http://swarnimbagre.com` redirects to `https://swarnimbagre.com`.
- [ ] All four public pages return 200 with valid HTML at the production URL.
- [ ] Mobile UA serves the mobile component variant; desktop UA serves the desktop variant.
- [ ] Admin login redirects work; magic link to the configured admin email (`ADMIN_ALLOWED_EMAIL`) lands and produces a working session.
- [ ] Projects, Posts, Stats, Images CRUD all work against production (verified by the T28 flow against the live URL).
- [ ] OpenClaw test message produces a row visible at `/admin/stats` and `/other`.
- [ ] No console errors on any page in production browser DevTools (CQ-05 in production runtime).

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

## Phase 4 Exit Criteria

- All 9 tasks complete.
- Site is live at `swarnimbagre.com`, monitored, with content.
- All security and code review findings closed.
- Mark Phase 4 row Done in [`plan-index.md`](plan-index.md). The `@plan` cycle is complete; future work happens via individual `@plan` follow-up tasks against the same docs.
