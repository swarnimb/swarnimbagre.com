# Environment Variables

Every variable required at runtime is asserted by `lib/env.ts → assertRequiredEnv()`, which is called from `next.config.ts`. A missing variable fails `next dev` and `next build` loudly — by design (EH-01).

This document is the source of truth for what each variable is, where its value comes from, and where it must be set.

---

## Required Variables

| Name | Exposure | Source | Set locally? | Set on Vercel? |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public (browser-safe) | Supabase → Project Settings → API → "Project URL" | Yes — `.env.local` | Yes — Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public (browser-safe) | Supabase → Project Settings → API → "anon / publishable" key | Yes — `.env.local` | Yes — Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-only — bypasses RLS** | Supabase → Project Settings → API → "service_role" key | Yes — `.env.local` (you are the only dev) | Yes — Production + Preview only (**not** Development) |

---

## Why the `NEXT_PUBLIC_` Prefix Matters

- Vars with `NEXT_PUBLIC_` are inlined into the browser bundle by Next.js at build time.
- Vars without the prefix are available only in server contexts (Server Components, Server Actions, Route Handlers, `next.config.ts`, Edge Functions).
- The anon key is intentionally public — Supabase Row-Level Security policies are what actually protect the data. The anon key alone cannot read anything that RLS does not explicitly allow.
- The service role key bypasses RLS entirely. If it leaks, every row in the database is readable and writable by anyone with the key. Treat it as a production secret.

---

## Local Setup

1. `cp .env.example .env.local`
2. Open the Supabase dashboard for this project → Settings → API.
3. Copy each value into the matching slot in `.env.local`.
4. Restart `next dev` after any change — env vars are read at startup.

`.env.local` is gitignored. Never commit it. Never paste it into chat, screenshots, or PRs.

---

## Vercel Setup

1. Vercel → this project → Settings → Environment Variables.
2. For each variable above:
   - Enter the **Name** exactly as written (case-sensitive).
   - Paste the **Value**.
   - Tick the **Environments** column per the table above.
   - Save.
3. After all variables are saved, redeploy: Deployments → latest → "Redeploy". Env var changes do not auto-rebuild.

---

## Verifying

After deploying:

- The build log should not contain `Missing required environment variable(s)`. If it does, the variable name listed is unset on Vercel for that environment.
- Visit the production URL and confirm `/`, `/projects`, `/writing`, `/other` render data.
- Supabase → Logs → Postgres should show no errors from the deploy window.

---

## Variables Not Listed Here

- `STATS_INGEST_SECRET` — the OpenClaw → Supabase shared secret. Lives in the Supabase Edge Function environment, **not** in Vercel. Documented separately when the Edge Function is built (Phase 3).
- Anything for OpenClaw itself — lives on the Telegram agent host, not this project.
