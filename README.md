# swarnimbagre.com

Personal site for projects, writing, and assorted hobby stats — written in a dry, anti-LinkedIn voice. The public site is what visitors see. The admin panel behind it is single-user, kept private, and exists so the site can be edited without redeploys.

## Setup

```
copy .env.example .env.local   # Windows
cp .env.example .env.local     # macOS / Linux
```

Fill values in `.env.local` — they come from the Supabase project dashboard. `.env.local` is gitignored and must never be committed. See `Environment variables` below for what each name is.

```
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Environment variables

Names only — see `.env.example` for the canonical list and inline comments. Real values come from the Supabase dashboard and are set in Vercel for production. No real values live in this repo.

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — public anon key. Safe in the browser; RLS protects data.
- `SUPABASE_SERVICE_ROLE_KEY` — server-only. Bypasses RLS. Never expose to the client.
- `NEXT_PUBLIC_SITE_URL` — absolute origin used to build the magic-link redirect. No trailing slash.
- `ADMIN_ALLOWED_EMAIL` — single-user allowlist for the admin panel.
- `TEST_FIXTURE_SECRET`, `TEST_FIXTURE_EMAIL` — Playwright fixture only. Never set in Vercel.
- `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` — deferred. See `docs/monitoring.md`.

Edge Function secrets (e.g. `STATS_INGEST_SECRET`) live in Supabase, not in `.env.local`. See `docs/openclaw-config.md`.

## Tests

```
npm test            # Vitest — unit + integration
npm run test:watch  # Vitest watch mode
npm run test:e2e    # Playwright — end-to-end against dev server on :3100
npm run test:edge   # Deno — Edge Function tests
```

`npm test` is the default. The e2e run starts its own dev server on port 3100; the edge run requires Deno installed locally.

## Build

```
npm run build       # Next.js production build — useful as a compile check before pushing
npm start           # Serve the production build on :3000
npm run lint        # Next/ESLint
```

## Deploy

`git push origin main` triggers a Vercel production deploy. Branch pushes get preview deploys. Vercel is configured via its dashboard; this repo has no `vercel.json`.

Before the first deploy: set every variable listed in `Environment variables` in the Vercel project (Production + Preview).

## Tech stack

- Next.js 15 (App Router) + React 19 + TypeScript
- Tailwind CSS — admin panel only (`/admin/*`). The public site uses no Tailwind.
- Supabase — Postgres, Auth, Storage, Edge Functions
- Vercel — hosting and deploys

## Reference

- Admin login flow — [`docs/auth-flow.md`](docs/auth-flow.md)
- Design rules — [`docs/design-decisions.md`](docs/design-decisions.md)
- Voice rules — [`docs/constraints.md`](docs/constraints.md)
