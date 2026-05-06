# Kickoff Brief: swarnimbagre.com

**Date:** 2026-05-05

## One-Line Description
Personal site at swarnimbagre.com for projects, writing, and assorted hobby stats — written in a dry, anti-LinkedIn voice and managed via a self-built admin panel.

## Problem
Swarnim wants a single online home that tracks his own projects, writing, and hobby data over time — without (a) the maintenance overhead of a CMS he didn't choose, (b) the LinkedIn-flavored "always-amazing" tone of typical professional sites, or (c) needing to touch code/SQL to update content.

## Target User
Primary: Swarnim himself — a kept-current personal record. Secondary: anyone who looks him up — recruiters, peers, audience from writing/social. Tone is for him; access is open.

## Core Scope

### In
- Public site with 4 pages: Home, Projects, Writing, Other (hobby stats).
- Design from claude.ai/design bundle, used verbatim (tokens, components, pages).
- Admin panel at `/admin` behind Supabase Auth (single user: Swarnim) — full CRUD on `projects`, `posts`, `stats`, image uploads.
- Supabase Edge Function with shared-secret auth — sole entry point for the OpenClaw Telegram agent to write to `stats` only.
- RLS default-deny on all tables; explicit policies grant access.
- Voice/brand discipline: dry humor, self-deprecation, no SaaS phrases, no emoji, no rounded pill cards.

### Explicitly Out
- Multi-user accounts, comments, reactions, social login.
- Newsletter signup, gated content, payments.
- Native mobile app.
- Headless CMS (Sanity/Payload/etc) — evaluated and rejected.
- Auto-bundled `.bundled.html` files from the design bundle (using source multi-file version for editability).
- Feed page (was in early design iteration; dropped — bundle ships 4 pages).

## Risks and Assumptions
- **Design bundle uses React-via-CDN + Babel-standalone** (in-browser JSX compile). Fine for MVP, slow at scale → migrate to Next.js when admin panel is built.
- **Supabase free tier is sufficient** for a personal site's traffic and storage. Risk: image storage if posts are media-heavy. Validate during `@assumptions`.
- **OpenClaw agent network/auth model is trusted** (separate machine, separate network, Telegram user_id whitelist). Risk: shared-secret rotation discipline.
- **`tweaks-panel.jsx` is a design-time overlay**, not production. Will need to gate or remove before public launch.
- **Bundle ships separate desktop and mobile entry points** (`site/index.html` + `pages/*.jsx` for desktop, `site/mobile.html` + `pages-mobile/*.jsx` for mobile) — both are complete and design-equivalent. Viewport routing (client-side redirect or server-side UA detection) is a small implementation detail to settle in `@recruit`/`@plan`, not architectural follow-on.

## Platform Target
Web — desktop and mobile, both complete in the design bundle as parallel entry points (`index.html` / `mobile.html`). Viewport routing strategy decided in `@recruit`.

## Stack
**Decided:**
- **Hosting:** Vercel
- **DB + Auth + Storage + Edge Functions:** Supabase (existing free-tier account)
- **Repo:** GitHub (blank, same name as domain)
- **Initial site:** Bundle's React-via-CDN + Babel-standalone, served as static files from `site/`

**Deferred to later phase (when admin panel is built):**
- **Framework migration:** Next.js (App Router) — unifies public site + protected `/admin` route + Supabase server components. Pre-bundles JSX so Babel-standalone goes away.

## Constraints
- **Time:** None hard. Domain owned; repo blank; no launch deadline.
- **Budget:** $0 — Vercel + Supabase free tiers only.
- **Technical:** Must use existing Supabase account; must use claude.ai/design bundle verbatim (no `@designer` consult).
- **Dependencies:** OpenClaw agent infrastructure (separate machine + Telegram bot) for programmatic stat ingestion — exists, integration TBD.

## ASCII Wireframe

```
                    swarnimbagre.com
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
   ┌─────────┐     ┌─────────────┐    ┌────────────┐
   │  HOME   │     │   PUBLIC    │    │  /admin    │
   │  hero   │ ──> │  Projects   │    │  (auth)    │
   │  proj   │     │  Writing    │    │  CRUD UI   │
   │  scroll │     │  Other      │    └─────┬──────┘
   └─────────┘     └──────┬──────┘          │
                          │                 ▼
                          ▼            ┌────────────┐
                    ┌──────────┐       │  Supabase  │
                    │ Supabase │ <──── │   (write)  │
                    │  (read)  │       └─────┬──────┘
                    └────┬─────┘             │
                         │                   │
                         │   ┌───────────────┘
                         │   │
                         ▼   ▼
                  ┌────────────────┐
                  │  Postgres      │
                  │  ┌──────────┐  │     ┌──────────────┐
                  │  │ projects │  │     │ Edge Function│
                  │  │ posts    │  │ <── │  + secret    │ <── OpenClaw
                  │  │ stats    │──┼──── │  (stats only)│     (Telegram)
                  │  └──────────┘  │     └──────────────┘
                  └────────────────┘
```

## Open Questions
- GitHub repo URL — exact org/user (assumed `github.com/swarnimbagre/swarnimbagre.com`; confirm).
- Whether to migrate to Next.js immediately or ship the verbatim-bundle static site first and migrate when adding `/admin`.
- Schema details for `stats` table — KV vs typed columns per category. Resolve in `@plan`.
- Vercel deploy config — root vs `site/` subfolder. Resolve at `@recruit`.
- `tweaks-panel.jsx` strategy — strip for production, or gate behind `?tweaks=1` querystring.
