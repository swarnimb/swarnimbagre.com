# swarnimbagre.com

Personal site for projects, writing, and assorted hobby stats. The public site is the part visitors see; the admin panel behind it is single-user, kept private, and exists so the site can be edited without redeploys.

## Setup

```
copy .env.example .env.local   # Windows
cp .env.example .env.local     # macOS / Linux
npm install
npm run dev
```

Fill in values in `.env.local` after copying. `.env.local` is gitignored — never commit it.

## Environment Variables

See `.env.example` for the full list of required variable names. Values come from the Supabase project dashboard. No real values live in this repo.

## Tests

```
npm test
```

Vitest is wired up in T7. Until then, `npm test` is a placeholder.

## Tech Stack

- Next.js 15 (App Router) + React 19 + TypeScript
- Tailwind CSS — admin panel only (`/admin/*`); the public site uses no Tailwind
- Supabase — Postgres, Auth, Storage, Edge Functions
- Vercel — hosting and deploys
