# Environment Variables Checklist

This document is the single authoritative reference for every environment
variable this project reads. It states, per variable: whether it is public or
server-only, where to source the value, where to set it locally, where to set
it in production, and what fails if it is missing.

No real secret values appear in this file (SEC-01). It documents names and
provenance only.

---

## The Four Categories

Variables fall into four categories. Read this before the per-variable detail.

1. Startup-required. Asserted by `lib/env.ts -> assertRequiredEnv()`, which is
   called at module top-level in `next.config.ts`. A missing value here fails
   `next dev` and `next build` loudly, by design (EH-01). The required list is
   the exported `REQUIRED_ENV_VARS` array in `lib/env.ts` - that array is the
   single source of truth and the test suite imports it directly.

2. Production-required, with a fallback. Needed for correct behavior in
   production but NOT in `REQUIRED_ENV_VARS`, because a runtime fallback
   exists. These do not hard-fail `next build`.

3. Test / CI only. Used by the local test fixture and CI. Must never be set in
   Vercel. Not startup-required.

4. Deferred. Intentionally left blank (Sentry, T32 Option B). Must NOT be
   added to startup validation or `next build` breaks. See `docs/monitoring.md`
   for the gate condition that reactivates them.

There is also a separate runtime: the Supabase stats-ingest Edge Function runs
on Deno, not Next.js. It validates its own environment via its own
`loadEnvOrThrow`, not `assertRequiredEnv`. Its variables are set via Supabase
secrets and are NOT placed in `.env.example`. See the Edge Function Runtime
section below and `docs/openclaw-config.md`.

---

## Category 1 - Startup-Required (hard-fail at `next build` / `next dev`)

These four are in `REQUIRED_ENV_VARS`. Any one missing aborts the build.

| Name | Exposure | Source | Set locally | Set in production | Fails if missing |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public (inlined into browser bundle) | Supabase dashboard, Project Settings, API, "Project URL" | `.env.local` | Vercel: Production + Preview | Site cannot reach the database; build aborts |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public (inlined into browser bundle) | Supabase dashboard, Project Settings, API, "anon / publishable" key | `.env.local` | Vercel: Production + Preview | Site cannot reach the database; build aborts |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only (bypasses RLS) | Supabase dashboard, Project Settings, API, "service_role" key | `.env.local` | Vercel: Production + Preview, server-only | Admin writes and the test sign-in route fail; build aborts |
| `ADMIN_ALLOWED_EMAIL` | Server-only | Chosen by the project owner (the single permitted admin email) | `.env.local` | Vercel: Production + Preview, server-only | Build aborts. Enforces CONSTRAINT-09 single-user allowlist |

Note on `ADMIN_ALLOWED_EMAIL`: this task (T34) promoted it into
`REQUIRED_ENV_VARS`. Previously a missing value only failed later, at admin
sign-in (the `getAdminAllowedEmail()` throw). It now also hard-fails the
build, so the misconfiguration surfaces before deploy rather than at first
login attempt.

Why the `NEXT_PUBLIC_` prefix matters:

- `NEXT_PUBLIC_` vars are inlined into the browser bundle at build time.
- Vars without the prefix are available only in server contexts (Server
  Components, Server Actions, Route Handlers, `next.config.ts`).
- The anon key is intentionally public - Row-Level Security policies protect
  the data. The anon key cannot read anything RLS does not explicitly allow.
- The service role key bypasses RLS entirely. If it leaks, every row is
  readable and writable. Treat it as a production secret. It is server-only
  and is never set in the Vercel "Development" scope.

---

## Category 2 - Production-Required, With a Fallback (NOT startup-asserted)

These are needed for correct production behavior but are deliberately absent
from `REQUIRED_ENV_VARS` because a fallback exists. They do not hard-fail the
build.

| Name | Exposure | Source | Set locally | Set in production | Fails if missing |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Public | Absolute site origin, no trailing slash | `.env.local` = `http://localhost:3000` | Vercel Production = `https://swarnimbagre.com` | Magic-link redirect breaks only if this AND the Vercel URL are both unset |
| `NEXT_PUBLIC_VERCEL_URL` | Public | Auto-injected by Vercel; never set manually | n/a (not present locally) | Auto-set by Vercel | n/a - it is the fallback host for `NEXT_PUBLIC_SITE_URL` |

Behavior detail: `getSiteUrl()` in `lib/auth-internal.ts` reads
`NEXT_PUBLIC_SITE_URL` first, then falls back to a `https://`-prefixed
`NEXT_PUBLIC_VERCEL_URL`. On Vercel Preview, `NEXT_PUBLIC_SITE_URL` can be left
unset and the preview host is used automatically. This is precisely why
`NEXT_PUBLIC_SITE_URL` is NOT in the startup-required list - adding it would
break Preview deploys that legitimately rely on the fallback. It is required
in Production, where there is no acceptable fallback origin.

---

## Category 3 - Test / CI Only (must never be set in Vercel)

These gate the test sign-in fixture. They must never appear in any Vercel
environment.

| Name | Exposure | Source | Set locally | Set in production | Fails if missing |
|---|---|---|---|---|---|
| `TEST_FIXTURE_SECRET` | Server-only | Generate with `openssl rand -hex 32` | `.env.local` / CI only | Never set in Vercel | `/api/test/sign-in` stays disabled; gated alongside `NODE_ENV=test` and `VERCEL!=1` |
| `TEST_FIXTURE_EMAIL` | Server-only | Has a non-secret default | `.env.local` / CI (optional) | Never set in Vercel | Falls back to `playwright-fixture@test.swarnimbagre.com` |

`TEST_FIXTURE_SECRET` is one of three independent gates on the test sign-in
route - the route is reachable only when `NODE_ENV=test`, `VERCEL!=1`, and the
secret matches. All three must hold.

---

## Category 4 - Optional / Preview-Only

| Name | Exposure | Source | Set locally | Set in production | Fails if missing |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_TWEAKS` | Public (boolean) | Set by you | Optional in `.env.local` | Vercel Preview only, set to `1`; unset in Production | Nothing breaks - the tweaks dev panel is simply hidden |

The tweaks panel is gated at build time by `NEXT_PUBLIC_TWEAKS === '1'`
(see `components/public/pages/Home.tsx`). Because the value is inlined at
build, a visitor cannot summon the panel on production via any URL.

---

## Category 5 - Deferred (Sentry; intentionally blank)

Do NOT add these to `assertRequiredEnv` / `REQUIRED_ENV_VARS` - doing so breaks
`next build`, since they are blank by design until Sentry is activated (T32
Option B, decided 2026-05-14).

| Name | Exposure | Source | Set locally | Set in production | Fails if missing |
|---|---|---|---|---|---|
| `SENTRY_DSN` | Server-only | Sentry project DSN (when activated) | Blank | Blank until Sentry activated | Nothing - error visibility relies on Vercel + Edge logs pre-launch |
| `NEXT_PUBLIC_SENTRY_DSN` | Public | Sentry project DSN (when activated) | Blank | Blank until Sentry activated | Nothing - same as above |

See `docs/monitoring.md` for the interim log-review playbook and the gate
condition that flips this back to Option A.

---

## Supabase Edge Function Runtime (separate from Next.js)

The stats-ingest Edge Function runs on Deno inside Supabase, not in the
Next.js process. It does NOT use `assertRequiredEnv`; it validates its own
environment with its own `loadEnvOrThrow`. These variables are NOT in
`.env.example`.

| Name | Exposure | Source | How to set | Fails if missing |
|---|---|---|---|---|
| `STATS_INGEST_SECRET` | Server-only (Edge runtime) | Shared secret for the stats-ingest Edge Function | `supabase secrets set STATS_INGEST_SECRET=...` or Supabase dashboard, Edge Functions, Manage secrets | OpenClaw ingest is rejected; see `docs/openclaw-config.md` |
| `SUPABASE_URL` | Edge runtime | Auto-injected by Supabase | No manual action | n/a - Supabase provides it inside the Edge runtime |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge runtime | Auto-injected by Supabase | No manual action | n/a - Supabase provides it inside the Edge runtime |

The `SUPABASE_SERVICE_ROLE_KEY` row above is the Edge runtime's auto-injected
copy. It is distinct from the Next.js startup-required variable of the same
name in Category 1, which you must set manually in `.env.local` and Vercel.

---

## Local Setup

1. `cp .env.example .env.local`
2. Open the Supabase dashboard for this project, Settings, API.
3. Copy each value into the matching slot in `.env.local`.
4. Choose your admin email and set `ADMIN_ALLOWED_EMAIL`.
5. Restart `next dev` after any change - env vars are read at startup.

`.env.local` is gitignored. Never commit it. Never paste it into chat,
screenshots, or PRs.

---

## Vercel Setup

1. Vercel, this project, Settings, Environment Variables.
2. For each Category 1 and Category 2 (production) variable:
   - Enter the Name exactly as written (case-sensitive).
   - Paste the Value.
   - Tick Production + Preview. Do not tick Development for server-only keys.
   - Save.
3. Do NOT set any Category 3 (test) variable in Vercel.
4. Leave Category 5 (Sentry) blank until Sentry is activated.
5. After saving, redeploy: Deployments, latest, Redeploy. Env var changes do
   not auto-rebuild.

---

## Verifying

After deploying:

- The build log must not contain `Missing required environment variable(s)`.
  If it does, the named variable is unset on Vercel for that environment.
- Visit the production URL and confirm `/`, `/projects`, `/writing`, `/other`
  render data.
- Confirm admin sign-in works with the `ADMIN_ALLOWED_EMAIL` address.
- Supabase, Logs, Postgres should show no errors from the deploy window.
