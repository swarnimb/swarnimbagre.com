# Plan — Phase 4: Polish + Launch

**Date:** 2026-05-06
**Status:** Pending
**Tasks:** T32–T40 (9 tasks)
**Predecessor:** [`plan-phase-3-ingestion.md`](plan-phase-3-ingestion.md)
**Successor:** none — final phase

End state: site is live at `swarnimbagre.com`, monitored, the post-launch checklist is closed. Phase 4 is operational and quality work — error monitoring, env-var hygiene, security review, code review, doc audit, production deploy, and post-launch ops.

---

## T32 — Error monitoring (Sentry) — option A deploy or option B defer

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
- [ ] `.env.example` lists `SENTRY_DSN` with a comment "deferred — set when monitoring is added".
- [ ] `docs/monitoring.md` documents that Sentry is deferred and what the builder should look at instead in the meantime (Vercel logs, Supabase Edge Function logs).

The builder picks A or B at task start. Either choice is valid; record the choice in `docs/session-log.md`.

**Tests required:**
- `initSentry initializes without error when DSN is set` (TS-01) — option A only.
- `initSentry skips initialization when DSN is unset` (TS-01) — option A only.

**Depends on:** Phase 3 complete (T31)

**Specialist:** `@cto`

---

## T33 — README finalization

**Files:**
- `README.md` (finalize)

**Functions to implement:** [documentation only]

**Acceptance criteria:**
- [ ] README contains the five required sections (DS-05):
  - **Project description** — one paragraph, voice-rule compliant (CONSTRAINT-13). No SaaS phrases.
  - **Setup** — exact commands: `cp .env.example .env.local`, fill values, `npm install`, `npm run dev`, open `http://localhost:3000`.
  - **Environment variables** — names only, reference `.env.example`. No real values (SEC-01).
  - **Tests** — `npm test`.
  - **Deploy** — `git push origin main` triggers Vercel auto-deploy.
- [ ] Additional sections (kept terse): admin login flow link to `docs/auth-flow.md`; design rules link to `docs/design-decisions.md`; voice rules link to `docs/constraints.md`.
- [ ] No `TODO` lines left in (CQ-05).
- [ ] DS-05 verification: a fresh checkout, following only the README, reaches a working `npm run dev` state.

**Tests required:**
- Manual: builder runs through README setup on a fresh clone, confirms steps work as written. Logged in `docs/session-log.md`.

**Depends on:** T32

**Specialist:** none

---

## T34 — Environment variables checklist + startup validation

**Files:**
- `.env.example` (finalize)
- `docs/env-checklist.md` (create — DS-02)
- `next.config.ts` (modify — finalize startup check from T14)

**Functions to implement:**
- `assertRequiredEnv()` (extended from T14 if needed) — covers all final required vars.

**Acceptance criteria:**
- [ ] `.env.example` lists all required public + server-only vars; no values (SEC-01).
- [ ] `docs/env-checklist.md` documents each var: name, public/server, where to source the value, where to set it locally, where to set it in production, what fails if it is missing (EH-01).
- [ ] Startup check throws a clear error naming the missing variable (EH-02). Server fails to boot rather than running with a missing var (EH-01: fail loud).
- [ ] No real secret in `.env.example`, no real secret in `docs/env-checklist.md`, no real secret in any committed file (SEC-01, SEC-07).
- [ ] `.env`, `.env.local`, `.env.*.local` are gitignored (SEC-07 verified).

**Tests required:**
- `assertRequiredEnv throws when a required var is missing` (TS-01 error).
- `assertRequiredEnv passes when all required vars are present` (TS-01 happy).

**Depends on:** T33

**Specialist:** none

---

## T35 — Launch checklist document

**Files:**
- `docs/launch-checklist.md` (create)

**Functions to implement:** [documentation only]

**Acceptance criteria:**
- [ ] Document has three sections (each is a checklist):

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

## T36 — Security review

**Files:** all code from T1–T34.

**Functions to implement:** [review task — no new code]

**Acceptance criteria:**
- [ ] **RLS audit:** `@security` confirms every table has RLS enabled and that policies match `architecture.md` §6.1. No table is permissive by default. OpenClaw cannot SELECT, UPDATE, or DELETE on any table — only the Edge Function (using the service role) can INSERT to `stats` (SEC-04, CONSTRAINT-08).
- [ ] **Auth audit:** middleware redirects unauthenticated requests on every `/admin/*` route. JWT lifetime is the Supabase default. Magic-link tokens are short-lived. No PII in logs (SEC-05).
- [ ] **Input validation audit:** every Server Action validates inputs at the boundary with zod (SEC-02). All Supabase queries use parameterized builders (SEC-03). The Markdown sanitizer's whitelist is the locked one (CONSTRAINT-06).
- [ ] **File upload audit:** `uploadImage` enforces type and size at both the boundary and the Storage bucket policy (SEC-02). Path scheme matches CONSTRAINT-07.
- [ ] **Secrets audit:** `.env*` gitignored; no real secret in any committed file (SEC-01, SEC-07). Service role key is loaded only in server contexts. Edge Function secret is in Supabase env, not in repo.
- [ ] **Edge Function audit:** constant-time secret comparison verified (SEC-04). 401 response is identical for missing-vs-wrong header. No detail leaked in any error response body.
- [ ] **HTTPS:** Vercel auto-managed; verified by checking redirect from `http://` to `https://`.

**Findings:** any failure here blocks launch. Fix and re-run before marking done.

**Tests required:** [review task — assertions captured in checklist above]

**Depends on:** T34

**Specialist:** `@security`

---

## T37 — Code review

**Files:** all code from T1–T34.

**Functions to implement:** [review task]

**Acceptance criteria:**
- [ ] All committed code passes ESLint + Prettier (CQ-05).
- [ ] Function lengths ≤ 50 lines (security/validation may extend to 80) (CQ-01).
- [ ] File lengths ≤ 300 (services) or ≤ 200 (components) (CQ-02).
- [ ] Single responsibility per file (CQ-03). Naming is explicit (CQ-06).
- [ ] No magic numbers — every threshold is a named constant with a comment (CQ-04). Examples to verify: `ORPHAN_CLEANUP_THRESHOLD_DAYS`, `MAX_IMAGE_BYTES`, etc.
- [ ] No dead code, no commented-out blocks, no `console.log` debug, no `TODO` left from earlier in the project (CQ-05).
- [ ] No duplicated logic (CQ-07). `slugify`, error logging shape, RLS policy patterns — all extracted.
- [ ] No accidental O(n²) where O(n) is available (CQ-08).
- [ ] Error handling: every catch block either handles visibly or re-throws (EH-01). All errors include context (EH-02) and stack traces (EH-03). User-facing errors are concise; internal logs are detailed (EH-04). Custom error types used for distinct failure modes (EH-05).
- [ ] All public functions have doc comments (DS-01).
- [ ] All tests pass (`npm test`). Critical paths (auth, data writes, access control, file uploads, Markdown sanitization) all have ≥1 happy + ≥1 error case (TS-01, TS-04). Test names describe behavior, not implementation (TS-02). Unit tests do not depend on external services (TS-03). No shared mutable test state (TS-05).

**Tests required:** the existing `npm test` suite must pass.

**Depends on:** T36

**Specialist:** `@code-review`

---

## T38 — Documentation audit

**Files:** all `docs/*.md` and `README.md`.

**Functions to implement:** [review task]

**Acceptance criteria:**
- [ ] `docs/architecture.md` matches the implementation. If anything diverged during build, either update architecture.md AND `docs/founder-brief.md` (DS-02) OR file a follow-up task.
- [ ] `docs/founder-brief.md` has an entry for every architectural decision actually present in code. No drift.
- [ ] `docs/constraints.md` matches what is enforced. No stale constraint that the code no longer respects.
- [ ] `docs/auth-flow.md` describes the actual flow as built.
- [ ] `docs/env-checklist.md` lists every var that is actually checked at startup.
- [ ] `docs/monitoring.md` and `docs/openclaw-config.md` are accurate.
- [ ] `docs/launch-checklist.md` reflects current operational reality.
- [ ] `README.md` is accurate (DS-05). Setup steps work on a fresh clone.
- [ ] No broken links between docs.
- [ ] No `TODO` or `[Placeholder]` left in any committed doc (CQ-05 applied to docs).

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
- [ ] Admin login redirects work; magic link to swarnim.build@gmail.com lands and produces a working session.
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
