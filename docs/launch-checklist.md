# Launch Checklist

This document is the go/no-go checklist for putting swarnimbagre.com into
production. It has three sections — Pre-launch, Launch, Post-launch — each a
literal checklist. Work top to bottom. Do not tick an item you have not
actually verified.

Nothing here is a substitute for the underlying task acceptance criteria; it
is the single place to confirm they all hold at once before the site goes
live.

---

## The OpenClaw Gate

Some items below depend on the OpenClaw Telegram stat-ingest path being wired
and live. That path is **deferred** — T29 (operator secret provisioning) and
T31 (integration test) are blocked on builder steps at the OpenClaw host, and
T30 (the `stats-ingest` Edge Function) is built but not yet deployed against
the live project. See `docs/plan-phase-3-ingestion.md` and the next-session
constraints in `docs/session-handoff.md`.

Items that depend on this are written below, **not omitted**, and tagged
`[OPENCLAW-GATED]`. They cannot be ticked until OpenClaw is wired. The launch
is decoupled from OpenClaw: the public site and admin panel deploy to
production independently — they do not depend on OpenClaw — and the launch
sign-off must explicitly acknowledge the OpenClaw items are deferred rather
than silently skipped. T39 (production deploy) is **not** blocked on OpenClaw
being live; its OpenClaw-related scope narrows to "the `stats-ingest` path is
deployed and smoke-verifiable", which can complete after the public launch.
T40 (post-launch monitoring of real `stats` rows) follows once OpenClaw is
producing data. OpenClaw ingestion (T29 / T31) and its verification are
post-launch work.

---

## Pre-launch

- [ ] All tests pass (`npm test`). Re-run from clean — the reconciled
      baseline is Vitest 201/201 (36 files) and Deno 12/0 (12 passing, 0
      failed, no skips); confirm it still holds, do not trust the logged
      number.
- [ ] Playwright admin-route E2E suite is re-run **in isolation** (not in
      parallel with a build) and verified clean before launch sign-off. It is
      currently **unverified**: last known-good was 17/10 (Session 22); recent
      runs were flaky (13–14/17, admin-route timeouts / `ERR_ABORTED`).
      Evidence points to environmental flakiness, not a logic regression, but
      a clean run has not been reproduced. Do not trust the logged number.
- [ ] `npm run build` is clean (CQ-05: no warnings, no dead code). The build
      log must not contain `Missing required environment variable(s)`.
- [ ] All four public pages (`/`, `/projects`, `/writing`, `/other`) render on
      desktop and mobile (Playwright smoke).
- [ ] Admin end-to-end flow passes (the T28 suite).
- [ ] `[OPENCLAW-GATED]` OpenClaw integration test passes (T31 manual tests).
      Blocked until OpenClaw is wired — see The OpenClaw Gate above.
- [ ] Fresh-clone check (DS-05 / T33, flagged outstanding at last handoff):
      clone the repo to a scratch directory, follow `README.md` literally, and
      confirm `npm run dev` serves `http://localhost:3000`. Tick T33
      criterion 4 when this passes.
- [ ] DNS for `swarnimbagre.com` and `www` points at Vercel.
- [ ] HTTPS is enforced (Vercel default — verify via
      `curl -I https://swarnimbagre.com` and confirm an `http://` request
      redirects to `https://`).
- [ ] Vercel production domain is set to `swarnimbagre.com`.
- [ ] All env vars are set in Vercel production. Cross-check every Category 1
      and Category 2 (production) variable against `docs/env-checklist.md`.
      Specifically confirm `ADMIN_ALLOWED_EMAIL` is set in Vercel Production
      **and** Preview — since T34 it is in `REQUIRED_ENV_VARS`, so a missing
      value hard-fails `next build` before deploy, not at first sign-in.
- [ ] Apply `supabase/migrations/008_storage_images_limits.sql` to the
      production Supabase project during the T39 deploy step. It is idempotent
      and only makes prod match version control — the live bucket already
      enforces these exact 2 MB size + JPEG/PNG/WebP MIME limits (hand-set
      2026-05-07). Single prod project, no staging (CONSTRAINT-02).
- [ ] `.env.local`, `.env`, `profile.md`, `manifest.md`, `CLAUDE.md`, and the
      session log files are gitignored (SEC-07 verified — confirm with
      `git check-ignore`).
- [ ] No PII in any log path (SEC-05 spot check).

---

## Launch

- [ ] Tag the release commit.
- [ ] Push to `main`. (Note: `main` has been held ahead of `origin/main`
      deliberately across recent sessions — confirm the full intended history
      is what gets pushed.)
- [ ] Verify the Vercel deploy succeeds in the dashboard.
- [ ] Hit the production URL: pages load, admin login redirects work, and the
      public pages render database content.
- [ ] Announcement copy follows the voice rules — no superlatives, no SaaS
      phrases, no emoji (CONSTRAINT-13).

---

## Post-launch

- [ ] Monitor Vercel logs and Supabase Edge Function logs for the first 24
      hours. Sentry is deferred (T32 Option B); the interim log-review
      procedure is the launch monitoring path — follow `docs/monitoring.md`.
- [ ] `[OPENCLAW-GATED]` Watch `stats` table activity to confirm OpenClaw is
      writing. Cannot be confirmed until OpenClaw is wired and has sent at
      least one real ingest — see The OpenClaw Gate above.
- [ ] Add the first 2–3 sample projects and 1–2 sample posts via the admin
      panel so the public site has content on day one.
- [ ] Bug triage: any crash files a follow-up task or a hotfix — do not let it
      sit unlogged.
