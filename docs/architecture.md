# Architecture: swarnimbagre.com

**Date:** 2026-05-06
**Status:** Locked. Six architectural decisions captured below; each has a Founder Brief in [`founder-brief.md`](founder-brief.md). Binding constraints derived from these decisions are in [`constraints.md`](constraints.md).

This document cannot change without a corresponding update to [`founder-brief.md`](founder-brief.md).

---

## 1. Tech Stack

### 1.1 Hosting and runtime

- **Web framework:** Next.js 15 (App Router) — App Router only, no Pages Router.
- **Language:** TypeScript.
- **Hosting:** Vercel — single project, GitHub-driven deploys.
- **Database / Auth / Storage / Edge Functions:** Supabase — single free-tier project.
- **CDN:** Vercel default (asset caching configured per the deploy section below).

### 1.2 Frontend libraries

- **Public site:** raw React + custom components from `site/components.jsx` and `site/mobile-components.jsx`. Styling is exclusively CSS variables in `site/colors_and_type.css` plus inline styles. No Tailwind, no component library.
- **Admin panel:** shadcn/ui + Tailwind CSS, scoped to `/admin/*` only.
- **Markdown renderer:** `marked` + DOMPurify (see Section 6).
- **Component testing:** `@testing-library/react` ^16.1.0 + `@testing-library/jest-dom` ^6.6.3 (required for React 19 / Next 15 compatibility).

### 1.3 Why Next.js from day one (Decision 1)

Phase A in earlier drafts was a static deploy of the React-via-CDN bundle, with Next.js migration deferred. That was dropped. The static deploy adds setup work and an unrelated routing model that gets thrown away once the admin panel arrives. Going Next.js from day one removes the throwaway work.

**Founder Brief:** see "Stack" entry in [`founder-brief.md`](founder-brief.md).

**Trade-offs accepted:**
- Phase 1 takes longer than a static deploy would — but Phase 1 produces the foundation Phase 2 needs.
- The verbatim bundle is ported into Next.js components rather than served as static HTML. This is a one-time cost, mitigated by copying components without modification.

---

## 2. Data Model

Four tables. RLS default-deny on every one. Migrations live in `supabase/migrations/` with sequential numbering.

### 2.1 `projects`

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `title` | `text` | NOT NULL, length ≤ 200 |
| `slug` | `text` | NOT NULL, UNIQUE |
| `description` | `text` | NOT NULL |
| `status` | `project_status` enum | NOT NULL, default `'draft'`. Values: `'draft'`, `'published'` |
| `image_id` | `uuid` | NULL, FK → `images.id` ON DELETE SET NULL |
| `created_at` | `timestamptz` | NOT NULL, default `now()` |
| `updated_at` | `timestamptz` | NOT NULL, default `now()`, trigger on update |

**Indexes:** `(status, created_at DESC)` for the public listing query. UNIQUE on `slug`.

**Slug-lock trigger:** a BEFORE UPDATE trigger raises an exception if `slug` changes while `status='published'` (DB-level enforcement of the slug-lock-after-publish rule).

### 2.2 `posts`

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `title` | `text` | NOT NULL, length ≤ 200 |
| `slug` | `text` | NOT NULL, UNIQUE |
| `content` | `text` | NOT NULL — raw Markdown |
| `status` | `post_status` enum | NOT NULL, default `'draft'`. Values: `'draft'`, `'published'` |
| `image_id` | `uuid` | NULL, FK → `images.id` ON DELETE SET NULL |
| `created_at` | `timestamptz` | NOT NULL, default `now()` |
| `updated_at` | `timestamptz` | NOT NULL, default `now()`, trigger on update |

**Indexes:** `(status, created_at DESC)`. UNIQUE on `slug`. Same slug-lock trigger as `projects`.

### 2.3 `stats`

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `category` | `text` | NOT NULL |
| `label` | `text` | NOT NULL |
| `value` | `text` | NOT NULL |
| `unit` | `text` | NULL (not every stat has a unit) |
| `created_at` | `timestamptz` | NOT NULL, default `now()` |

**Indexes:** `(category, created_at DESC)`. Append-only — no UPDATE policy, no DELETE policy for any role except `authenticated` (the admin).

**Schema rationale (Decision 2 — resolves ASSUMPTION-01):** OpenClaw is an LLM agent that interprets plain-English Telegram messages. The schema must be flexible enough that adding a new "category" of stat does not require a migration. Per-category tables would mean a migration per new hobby. A KV store would lose typing entirely. A single typed table with `category` + `label` + `value` + `unit` text columns is the middle ground: typed enough to query, flexible enough to absorb new categories without schema changes. **Founder Brief:** "Stats schema" in [`founder-brief.md`](founder-brief.md).

### 2.4 `images`

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `bucket_path` | `text` | NOT NULL — path in Supabase Storage `images` bucket |
| `alt_text` | `text` | **NOT NULL** — required when an image is present |
| `parent_id` | `uuid` | NULL — FK to `projects.id` or `posts.id` depending on `parent_type` |
| `parent_type` | `text` | NULL — `'projects'` or `'posts'` (CHECK constraint) |
| `created_at` | `timestamptz` | NOT NULL, default `now()` |

**CHECK constraint:** `parent_type IN ('projects', 'posts') OR parent_type IS NULL`.

**Storage bucket path scheme:** `images/{projects|posts}/{parent_id}/{uuid}_{filename}`. The 2 MB cap is enforced both client-side at upload and via a Supabase Storage policy. **Founder Brief:** "Image data layer" in [`founder-brief.md`](founder-brief.md).

**Orphan cleanup:** `images` row is "orphaned" when both `parent_id IS NULL` and `parent_type IS NULL`. The admin "Clean orphans" button deletes orphans where `created_at < now() - interval '7 days'` from both the table and the Storage bucket. The 7-day grace period is a named constant: `const ORPHAN_CLEANUP_THRESHOLD_DAYS = 7;` (CQ-04).

---

## 3. API Structure

### 3.1 Public reads — PostgREST via `@supabase/ssr`

Public pages query Supabase from Server Components using the anon role. All reads are RLS-filtered to `status='published'`. No app-level filtering — the database returns only what is visible.

```ts
// lib/db.ts (preview shape, not a full file)
export async function getPublishedProjects() {
  const supabase = createServerClient(...);
  const { data, error } = await supabase
    .from('projects')
    .select('id, title, slug, description, image_id, created_at')
    .eq('status', 'published')
    .order('created_at', { ascending: false });
  if (error) throw new ServiceError('getPublishedProjects failed', { cause: error });
  return data;
}
```

All queries go through Supabase's query builder — never raw SQL string concatenation (SEC-03).

### 3.2 Admin writes — Server Actions

Admin mutations are Next.js Server Actions or Route Handlers. The Supabase client used here authenticates as the logged-in admin user; the JWT cookie is read server-side and attached to every Supabase request. Writes are RLS-checked at the database level — Server Actions are not the security boundary, the database is.

**Forbidden:** calling Supabase write methods from client components. All writes are server-side.

### 3.3 Edge Function — `stats-ingest`

The only programmatic write path. **Decision 4 — resolves ASSUMPTION-06.** Locked option (a) from the assumption: a thin Edge Function gateway with shared-secret header.

**Endpoint:** `POST https://{project-ref}.supabase.co/functions/v1/stats-ingest`

**Headers:**
- `X-Stats-Secret: {shared-secret}` — required, validated via constant-time comparison (`crypto.timingSafeEqual`).
- `Content-Type: application/json`.

**Body:**
```json
{
  "category": "string",
  "label": "string",
  "value": "string",
  "unit": "string | null"
}
```

**Responses:**
- `201 Created` — payload validated, row inserted via service role.
- `400 Bad Request` — payload missing or malformed; generic field-level message, no internal detail.
- `401 Unauthorized` — secret missing or wrong; body is `{"error":"unauthorized"}`, no detail leaked.
- `429 Too Many Requests` — reserved for rate-limit prep (see below).

**Rate-limit prep:** the Edge Function includes a placeholder check using Supabase's invocation count or a simple in-memory token bucket keyed by source IP. Not enforced in Phase 3 launch; the hook is wired so enforcement can be added without redeploying app code.

**Why Edge Function and not direct PostgREST with a publishable key:** the publishable key is public by design. Anyone with the key could INSERT. The Edge Function pattern restricts writes to OpenClaw specifically because OpenClaw is the only party with the shared secret. **Founder Brief:** "OpenClaw access" in [`founder-brief.md`](founder-brief.md).

---

## 4. Component Architecture

### 4.1 Repo layout (confirmed)

All admin routes are nested under `/admin/*`. Login lives at `/admin/login`, the dashboard at `/admin`, and the magic-link callback at `/admin/auth/callback`. Middleware matcher is `['/admin/:path*']`. See CONSTRAINT-17 (added 2026-05-12) and founder-brief entry of 2026-05-12 for rationale.

```
swarnimbagre.com/
├── app/
│   ├── layout.tsx                    # root layout — public fonts, public CSS, NO Tailwind
│   ├── page.tsx                      # Home
│   ├── projects/page.tsx
│   ├── projects/[slug]/page.tsx
│   ├── writing/page.tsx
│   ├── writing/[slug]/page.tsx
│   ├── other/page.tsx
│   ├── styles/                       # CSS files for the public site + admin
│   │   ├── colors_and_type.css       # public bundle tokens, imported by root layout
│   │   ├── base.css                  # public site base, imported by root layout
│   │   └── admin.css                 # Tailwind + scoped-preflight, imported only by admin layout
│   └── (admin)/                      # route group — admin layout owns Tailwind import
│       ├── layout.tsx                # admin-only Tailwind/shadcn CSS, Inter font
│       └── admin/                    # all admin URLs live under /admin/*
│           ├── page.tsx              # /admin — dashboard
│           ├── login/page.tsx        # /admin/login
│           ├── auth/callback/route.ts # /admin/auth/callback — magic-link callback
│           ├── projects/...
│           ├── posts/...
│           ├── stats/page.tsx
│           └── images/page.tsx
├── components/
│   ├── public/                       # public bundle ports (verbatim from site/)
│   ├── admin/                        # shadcn-based admin components
│   └── ui/                           # shadcn primitives (generated)
├── lib/
│   ├── supabase.ts                   # client factories (server, browser)
│   ├── db.ts                         # public reads
│   ├── admin-queries.ts              # admin reads
│   ├── admin-{projects,posts,stats}-mutations.ts  # admin writes (per-resource Server Actions; see §6.6.6)
│   ├── admin-{projects,posts,stats}-mutations-internal.ts  # throwing helpers (no 'use server')
│   ├── admin-{projects,posts,stats}-mutations-types.ts     # client-safe envelopes
│   ├── markdown.ts                   # marked + DOMPurify whitelist
│   ├── auth.ts                       # Server Action entry points (e.g., `signInWithMagicLink`)
│   ├── auth-internal.ts              # non-'use server' helpers (throwing, timing-sensitive)
│   └── images.ts                     # Storage URL helpers
├── supabase/
│   ├── migrations/                   # SQL migrations, sequentially numbered
│   └── functions/
│       └── stats-ingest/index.ts     # Edge Function
├── middleware.ts                     # Next.js middleware: UA detect + admin auth gate
└── public/                           # static assets
```

### 4.2 Tailwind scoping (Decision 3 — resolves ASSUMPTION-04)

Tailwind is imported in exactly one place: `app/styles/admin.css`, which is in turn imported only by `app/(admin)/layout.tsx`. The plugin `tailwindcss-scoped-preflight` wraps Tailwind's Preflight reset under the `.admin-root` selector. Every admin page renders inside `<div className="admin-root">...</div>`.

The Tailwind config's `content` glob includes only `./app/(admin)/**/*` and `./components/admin/**/*` and `./components/ui/**/*`. Public components are excluded. The public bundle never sees a Tailwind utility class, and the Preflight reset never reaches public route HTML.

**Color token namespacing.** The admin uses an eight-token namespaced palette: 4 brand tokens (`--admin-bg`, `--admin-surface`, `--admin-fg`, `--admin-accent`) and 4 semantic tokens (`--admin-destructive`, `--admin-destructive-fg`, `--admin-border`, `--admin-muted-fg`). The semantic tokens map to shadcn slots (destructive, border, input, muted-foreground); the 3 sourced-from-public tokens match public-palette hexes verbatim (`--danger`, `--hairline`, `--fg-muted`) for brand coherence. The `--admin-*` prefix prevents cascade collisions if the public site's `:root` token definitions ever leak into the admin subtree (or vice versa). Tailwind config maps all 19 shadcn slots to these tokens, so utility class names (`bg-bg`, `text-fg`, `border-border`) stay clean in admin code — see CONSTRAINT-16 for the full slot table. Locked T15 — see Founder Brief #4 (Admin CSS token namespacing).

**Founder Brief:** "Tailwind scoping" in [`founder-brief.md`](founder-brief.md).

### 4.4 UI-boundary error handling — `lib/safe-load.ts`

Every Server Component that calls a `lib/db.ts` read function MUST wrap the call in `safeLoad(load, fallback, context)` from [`lib/safe-load.ts`](../lib/safe-load.ts). The wrapper:

1. Awaits `load()`. On success: returns the value.
2. On any throw: invokes `logLoadFailure(context, error)`, which emits a structured `console.error` with operation, error code, error message, and stack — the same shape as `logDbError` in `lib/db.ts`.
3. Returns the caller-supplied `fallback` (typically `[]` for list queries, `null` for single-row queries, `{}` for grouped queries).

```ts
// app/projects/page.tsx — example shape
const projects = await safeLoad<Project[]>(
  () => getPublishedProjects(),
  [],
  'page:projects',
);
```

The wrapper exists to convert data-layer throws into degraded UI states at the page boundary. Detail-page metadata + body both use it; the body adds `if (!row) notFound()` after the call so a null fallback dispatches Next.js's 404 path. List pages render an empty state on `[]`.

**EH-01 carve-out (explicit):** This is the only catch-and-degrade pattern permitted in the codebase outside narrow data-layer error mapping. Using `safeLoad` inside `lib/` modules or mid-render helpers is an EH-01 violation. Boundary-only.

**Founder Brief:** "UI-boundary error handling" in [`founder-brief.md`](founder-brief.md).

### 4.5 Server / Client prop boundary — `Nav` / `MobileNav`

Next.js 15 RSC forbids passing function props from a Server Component to a Client Component (`Event handlers cannot be passed to Client Component props.`). `Nav` and `MobileNav` are `'use client'` components used by both Server Component detail pages (`app/projects/[slug]/page.tsx`, `app/writing/[slug]/page.tsx`) and Client Component list-render components (`components/public/pages/{Projects,Writing,Other}.tsx`).

Both Nav components accept two parallel ways to specify link targets:

| Prop | Type | Caller boundary | Use when |
|---|---|---|---|
| `hrefs?: Record<string, string>` | plain data | Server Component OK | Detail pages pass `hrefs={NAV_PATHS}` (exported as a static const from `lib/nav-targets.ts`). |
| `resolveHref?: (id: string) => string` | function | Client Component only | List-render components pass `resolveHref={resolveNavPath}`. |
| `onNav?: (target: string) => void` | function | Client Component only | When SPA navigation via `router.push` is desired. Detail pages do NOT pass this — they let the browser navigate via the `href`. |

`hrefs` takes precedence over `resolveHref`. When neither is passed, the default `() => '#'` preserves byte-identical bundle render per CONSTRAINT-05's additive-prop carve-out.

**Founder Brief:** "Server-safe Nav props" in [`founder-brief.md`](founder-brief.md).

### 4.6 Image read pattern

Image rendering for public content uses async Server Components that resolve image IDs to signed Storage URLs at request time. The pipeline:

1. Page (Server Component) loads project/post data via `getProjectBySlug` / `getPostBySlug`, wrapped in `safeLoad` (CONSTRAINT-14). The data includes `image_id`.
2. Page renders `<ProjectImage imageId={...} alt={...} />` or `<PostImage imageId={...} alt={...} />`.
3. The image component (also a Server Component) calls `getImageById(imageId)` to resolve the `images` row, then `getImageUrl(bucket_path)` to produce a signed URL with TTL 3600s.
4. The component returns `<img src=... alt=... loading="lazy" />`. On any error in the resolution chain it logs with context and returns `null` — visitors never see a broken-image icon (EH-04).

**Why async Server Components, not client components:**
- SEO: search engines see the rendered `<img>` in the initial HTML.
- First paint: the URL is present at hydration, no extra round trip.
- Existing `components/public/` is mostly `'use client'` for interactive UI (cards, nav, demos). Image components are pure data loaders — different concern, different runtime.

**Why signed URLs, not public:**
- The `images` bucket is private (migration `005_rls_images.sql`). Public URLs would 404. See CONSTRAINT-15.
- TTL 3600s: long enough for a typical reading session; short enough that a leaked URL expires quickly.

**Public surface (functions added in T13):**
- `getImageUrl(bucketPath: string, client?: SupabaseClient): Promise<string>` — `lib/images.ts`. Throws `ServiceError` on empty path or storage failure.
- `getImageById(id: string, client?: SupabaseClient): Promise<ImageRecord | null>` — `lib/db.ts`. Mirrors `getProjectBySlug` pattern (DI for tests, throws `ServiceError` on DB error).

**Tests:** Vitest + `@testing-library/react` for React component rendering. React 19 / Next 15 require testing-library v16+. See `tests/images.test.ts` and `tests/ProjectImage.test.tsx`.

### 4.3 File and function size budgets

Per CQ-01 and CQ-02:
- Functions ≤ 50 lines (security/validation may extend to 80).
- Service files ≤ 300 lines.
- Component files ≤ 200 lines.

When a module hits the limit, split by single responsibility (CQ-03). The shared `lib/admin-mutations.ts` was split per resource at T25 — see §6.6.6. Naming: `admin-{resource}-mutations.ts` (e.g., `admin-projects-mutations.ts`).

### 4.7 Test infrastructure: NODE_ENV-gated dev-only routes

The project mounts dev-only API routes (currently: `app/api/test/sign-in/route.ts`) using a triple-gate pattern. Each gate is independent — any one gate alone refuses production traffic.

**Gate 1 — NODE_ENV bracket indirection.** The route reads NODE_ENV via:

```typescript
const NODE_ENV_KEY = 'NODE_ENV';
if (process.env[NODE_ENV_KEY] !== 'test') return new Response(null, { status: 404 });
```

Direct `process.env.NODE_ENV` access is folded into a literal at build time by Next 15's compile-time inlining — the runtime gate becomes a constant `'development' !== 'test'` (always true in dev) regardless of the actual runtime NODE_ENV. The bracket-with-variable form preserves the runtime read. **Do not "simplify" this back to dot notation** — see CONSTRAINT-19.

**Gate 2 — explicit Vercel runtime refusal.** `if (process.env.VERCEL === '1')` returns 404. Vercel sets `VERCEL=1` on every deployment runtime. This is the belt to Gate 1's suspenders.

**Gate 3 — shared-secret header.** The route requires header `x-fixture-secret` to match `process.env.TEST_FIXTURE_SECRET` via `timingSafeEqual` from `node:crypto`. Length pre-check (return 404 on length mismatch, since `timingSafeEqual` throws on unequal-length buffers). The secret lives in `.env.local` (gitignored) and CI secrets only — never in Vercel env.

**Pattern is reusable.** Any future dev-only API surface should follow the same three-gate pattern. The secret env var name and the header name are convention; the gate ordering and constant-time comparison are mandatory (SEC-04).

**Cross-references:** `app/api/test/sign-in/route.ts` (implementation), `tests/e2e/fixtures/auth.ts` (consumer), `docs/security-report.md` audit 7 (verification), `docs/constraints.md` CONSTRAINT-19 (binding rule).

### 4.8 Playwright auth fixture pattern

E2E tests log in via a server-side magic-link flow that mirrors the production callback shape but bypasses email delivery.

**Identity convention.** The fixture user is `playwright-fixture@test.swarnimbagre.com`. The subdomain `test.swarnimbagre.com` is unowned — no DNS, no MX records, no inbox. A stray real email bounces hard rather than landing in an inbox the project doesn't control. Future fixture identities follow the pattern `<purpose>@test.swarnimbagre.com`.

**Seed mechanism.** `scripts/seed-test-fixture.ts` is an idempotent CLI that creates the fixture user via `auth.admin.createUser({ email, email_confirm: true })` using the service-role key. Re-running with an existing user is a no-op. Run via `npx tsx scripts/seed-test-fixture.ts` once per environment (local + CI).

**Auth path.** The dev-only `/api/test/sign-in` route calls `auth.admin.generateLink({ type: 'magiclink', email })` to obtain a `token_hash`, then immediately calls `auth.verifyOtp({ token_hash, type: 'email' })` against the SSR client to bind the session to the response cookies. This mirrors the production callback at `app/(admin)/admin/auth/callback/route.ts` — same `verifyOtp` shape, same cookie wiring, no PKCE verifier emitted (CONSTRAINT-18 preserved).

**Serial-mode requirement.** Specs that share a fixture user must use `test.describe.configure({ mode: 'serial' })`. `auth.admin.generateLink` invalidates the prior magic-link token for the email; concurrent workers calling generate+verify against the same user race and one fails with `otp_expired`. If a future spec needs parallelism, mint per-test-isolated identities (`playwright-fixture-${testId}@test.swarnimbagre.com`).

**Cross-references:** `tests/e2e/fixtures/auth.ts` (`loginAsAdmin()` helper), `tests/e2e/admin-logout.spec.ts` (consumer + serial-mode example), `docs/plan-phase-2-admin.md` T19.2 (origin), `docs/founder-brief.md` entries 19 + 20.

---

## 5. Infrastructure and Deployment

### 5.1 Vercel

Single Vercel project linked to the GitHub repo. Production branch: `main`. Preview deploys on every PR.

**Build:** `next build`. No custom build command needed.
**Runtime:** Node.js (Vercel default for Next.js).
**Caching headers:** static assets (CSS, JS, images) → `Cache-Control: public, max-age=31536000, immutable`. HTML → `Cache-Control: public, max-age=3600, s-maxage=3600`.
**Domain:** `swarnimbagre.com` apex + `www` redirect, both via Vercel.

### 5.2 Supabase

Single free-tier project. Migrations applied via Supabase CLI from `supabase/migrations/` (or via the Supabase MCP `apply_migration` tool during development).

**Tables:** `projects`, `posts`, `stats`, `images` — all with RLS enabled.
**Storage:** bucket `images` (private bucket — public read goes through signed URLs or RLS-checked policy). Max file size 2 MB enforced via bucket policy.
**Edge Functions:** `stats-ingest`.
**Auth:** Email provider only, magic link enabled, SMTP defaults.

### 5.3 Environment variables

| Var | Where | Public? | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel + local `.env.local` | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel + local `.env.local` | yes | Anon key for client/server reads |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel server-only + local `.env.local` | **no** | Admin server-side writes only |
| `STATS_INGEST_SECRET` | Supabase Edge Function env | **no** | Shared secret for `stats-ingest` |
| `ADMIN_ALLOWED_EMAIL` | Vercel server-only + local `.env.local` | **no** | Admin allowlist enforcement for magic-link sign-in (Layer 2 defense; Layer 1 is the Supabase dashboard). See `auth-flow.md` §3 and `lib/auth-internal.ts::assertAllowlistedEmail`. |
| `NEXT_PUBLIC_SITE_URL` | Vercel + local `.env.local` | yes | Absolute site URL for magic-link `emailRedirectTo`. Falls back to `NEXT_PUBLIC_VERCEL_URL` when unset. See `lib/auth-internal.ts::getSiteUrl`. |
| `NEXT_PUBLIC_TWEAKS` | Vercel (preview only, never production) | yes (boolean) | Gates the tweaks panel |

`.env.example` lists every variable name with no values (SEC-01). Service role key is loaded only in server contexts; never imported in client components. `NEXT_PUBLIC_TWEAKS` is unset in production.

---

## 6. Security Architecture

### 6.1 RLS policies — per table

**Default-deny is enforced by enabling RLS on every table without a permissive policy. Each policy below grants the minimum needed.**

#### `projects`
- `projects_public_select` — role `anon`, FOR SELECT, USING `(status = 'published')`.
- `projects_admin_all` — role `authenticated`, FOR ALL, USING `true`, WITH CHECK `true`.

#### `posts`
- `posts_public_select` — role `anon`, FOR SELECT, USING `(status = 'published')`.
- `posts_admin_all` — role `authenticated`, FOR ALL, USING `true`, WITH CHECK `true`.

#### `stats`
- `stats_public_select` — role `anon`, FOR SELECT, USING `true` (stats are public).
- `stats_admin_all` — role `authenticated`, FOR ALL, USING `true`, WITH CHECK `true`.
- **No INSERT policy for `anon`.** OpenClaw writes go through the Edge Function, which uses the service role and bypasses RLS. The service role key is held only by the Edge Function runtime.

#### `images`
- `images_public_select` — role `anon`, FOR SELECT, USING a join condition: visible only when the parent (project or post) has `status='published'`.
- `images_admin_all` — role `authenticated`, FOR ALL, USING `true`, WITH CHECK `true`.

### 6.2 Auth boundaries

- **Public routes** (`/`, `/projects`, `/projects/[slug]`, `/writing`, `/writing/[slug]`, `/other`): no auth. Anon Supabase client. RLS is the only filter.
- **Admin routes** (`/admin/*`): middleware checks for a Supabase session cookie. Unauthenticated → redirect to `/admin/login`. The admin's email is enforced by the fact that there is exactly one user account; no role check is needed.
- **Edge Function**: shared-secret header. Constant-time comparison (SEC-04 — timing attack mitigation).

Admin allowlist is two-layer (`auth-flow.md` §3): the Supabase dashboard "Allow new users to sign up" is OFF (Layer 1), and `lib/auth-internal.ts::assertAllowlistedEmail` rejects any email != `ADMIN_ALLOWED_EMAIL` before invoking `signInWithOtp` (Layer 2). Callback route defense-in-depth (`app/(admin)/admin/auth/callback/route.ts`) re-checks the email post-`verifyOtp` so a session is never minted for a non-allowlisted user.

### 6.3 Threat model — top three

| # | Threat | Mitigation |
|---|---|---|
| 1 | XSS via untrusted Markdown in posts | DOMPurify whitelist (Section 7). Sanitization is applied at render time, every time. The DB stores raw Markdown, never HTML — meaning the sanitizer runs on every read, with no stored-HTML attack surface. |
| 2 | Unauthorized stat ingestion (spam or impersonation of OpenClaw) | Edge Function with shared secret. Constant-time comparison defeats timing oracles. Service role key is held only by the Edge Function runtime, never sent over the wire from a client. |
| 3 | Unauthorized admin access | Magic link auth (single account). Middleware redirects anon requests on `/admin/*`. RLS still rejects unauthenticated writes even if middleware fails — defense in depth. |

### 6.4 Secrets handling

- All secrets are env vars (SEC-01). `.env*` is gitignored (SEC-07).
- `SUPABASE_SERVICE_ROLE_KEY` is referenced only in `lib/supabase.ts`'s server-only factory and in the Edge Function. Never exported from a client component module.
- `STATS_INGEST_SECRET` lives only in the Edge Function's env.
- Vercel project settings carry production values; local dev uses `.env.local` (gitignored).
- A startup check in `next.config.ts` throws if any required env var is missing (EH-01: fail loud).

### 6.5 Logging and PII

- Errors include operation, sanitized inputs, and stack trace (EH-02, EH-03).
- Email addresses are logged as a presence flag (`{ emailProvided: true }`), never as the raw value (SEC-05).
- User-facing errors are concise; full detail goes to the internal log (EH-04).
- No `console.log` left in production code (CQ-05).

### 6.6 Auth flow architectural patterns

#### 6.6.1 `'use server'` module surface

Every `export` of a `'use server'` module is promoted by Next.js to a publicly callable Server Action with a stable hashed ID that ships in the client bundle. Auth-adjacent code therefore separates concerns across two sibling files: a `'use server'` wrapper module that contains ONLY public Server Action entry points (`lib/auth.ts` — exports `signInWithMagicLink`), and a non-`'use server'` helper module that contains throwing, timing-sensitive, or otherwise outcome-dependent logic (`lib/auth-internal.ts` — exports `attemptMagicLink`, `assertAllowlistedEmail`, `EMAIL_SCHEMA`, `SIGN_IN_OPERATION`). The wrapper imports the helper as a regular ES module function. This pattern is binding for every future auth-adjacent task (T18-T28, Phase 3 ingestion). Build-output check: `.next/server/server-reference-manifest.json` lists exactly the expected action IDs, no more. See SEC-08 and `docs/auth-flow.md` §2a point 4.

#### 6.6.2 Constant-time floor for enumeration-resistant Server Actions

Auth-adjacent Server Actions whose internal helpers have outcome-dependent timing (allowlisted vs not-allowlisted, found vs not-found) wrap the helper in a `try/finally` block and pad the response with `setTimeout` to a fixed wall-clock floor before resolving. The floor is a named constant (`MIN_DURATION_MS = 750` in `lib/auth.ts`). Fast paths pad up; slow paths run over (floor, not ceiling — truncating slow paths would introduce a separate oracle). The wrapper catches and discards thrown errors silently — re-logging inside the catch reintroduces a timing differential between success and failure, reopening the channel. Inner helpers log structured context themselves. See `docs/auth-flow.md` §2a point 3 and `docs/security-report.md` audit-2 F-12.

#### 6.6.3 Supabase SSR auth flow type — implicit, not PKCE

`lib/supabase.ts::createServerClient` constructs the `@supabase/ssr` client with `auth: { flowType: 'implicit' }`. The library defaults to PKCE, which writes a `*-code-verifier` `Set-Cookie` on the call-Supabase branch of `signInWithOtp` but not on the throw-and-skip branch — a header-level enumeration channel orthogonal to body shape and timing. Implicit flow does not emit the verifier cookie, so the response headers are uniform across outcomes. Magic-link callback consumes `?token_hash=&type=` via `verifyOtp`, which is not PKCE-dependent. The PKCE-shaped `?code=...` branch in `app/(admin)/admin/auth/callback/route.ts` is dead under the current single-user magic-link-only model; it is retained for future OAuth integration. See `docs/auth-flow.md` §2a point 5, `docs/security-report.md` audit-3 F-15, and CONSTRAINT-18.

#### 6.6.4 `/api/admin/*` route handler gate (F-17, audit pass 5)

The middleware matcher `'/((?!api|_next/static|_next/image|favicon.ico).*)'` excludes `/api/*` (Next.js convention to avoid running middleware on API routes that handle their own auth). No `/api/*` routes exist today — `app/api/` is empty as of T18 — but the natural growth path lands admin-only endpoints (image upload, batch operations, deletes) under `/api/admin/*`, where the middleware admin-gate would not run. To prevent silent bypass, every route handler added under `app/api/admin/**` MUST: (1) call `getServerSession()` from `lib/session.ts` at the top of the handler, before any business logic; (2) return `new Response(null, { status: 401 })` if the session is null. Use the same uniform 401 across every admin API route — no body, no error detail — paralleling the SEC-09 redirect-uniformity contract that the page gate already satisfies. The alternative — tightening the middleware matcher to gate `/api/admin/*` directly — is acceptable but not preferred: per-handler protection keeps API routes self-protective and decouples them from the matcher's evolution. Document the choice when the first `/api/admin/*` route ships. **Code-review checklist:** any new file under `app/api/admin/**` must contain a `getServerSession()` call before any business logic. See `docs/security-report.md` audit-5 F-17.

#### 6.6.5 Build invariants (F-14, SEC-09)

Two invariants on the auth surface must hold across every build. Breaking either one is a security regression, not a refactor.

- **Server Action surface (F-14, audit pass 4):** every export of a `'use server'` module is a public Server Action with a stable hashed ID in the client bundle. After every build, `.next/server/server-reference-manifest.json` must list exactly the actions named in the test allowlist at `tests/server-actions-manifest.test.ts` — no more, no fewer. As of T25 commit 1 the allowlist is `signInWithMagicLink` (T17), `signOut` (T18), `createProject` (T21), `updateProject` (T21), `deleteProject` (T22), `createPost` (T23), `updatePost` (T23), `deletePost` (T23), `insertStat` (T24), `deleteStat` (T24) — ten IDs total, spread across four modules: `lib/auth.ts` plus per-resource trios for projects, posts, and stats. T25 will introduce an images trio + `uploadImage` in a follow-up commit, lifting the count to 11 across five modules. Any PR that adds a new action ID without updating the test allowlist + auditing the new surface is a wire-level enumeration regression. See §6.6.1, §6.6.6, `docs/auth-flow.md` §2a point 4, `docs/security-report.md` audit-4 F-14 and audit-5 F-14a/c/d.
- **Middleware uniformity (SEC-09, audit pass 5):** every middleware redirect outcome on the admin auth gate must pad to `MIN_DURATION_MS = 750` and write zero `Set-Cookie` headers. Tests S1–S5 in `tests/middleware.test.ts` enforce this contract across the no-session, Supabase-error, and helper-throw branches; do not relax them without re-running `@security`. See `docs/security-report.md` audit-5 "Six-channel SEC-09 uniformity".

#### 6.6.6 Admin mutation surface — three-module file split, per resource

The mutation surface for admin CRUD splits into three modules **per resource family** (projects, posts, stats; images joins at T25) because the client-side form must import the response-state shape without transitively pulling `next/headers`. Using projects as the worked example:

- **`lib/admin-projects-mutations-types.ts`** — pure types and consts. Exports the `ProjectMutationState` envelope (`{ status: 'idle' | 'ok' | 'error'; fieldErrors?; formError? }`) and the initial state. No runtime imports of Supabase, zod, or `next/headers`. Safe to import from `'use client'` components. This is the file that crosses the client/server boundary at the type level. The cross-resource `GENERIC_FORM_ERROR` string lives in `lib/auth-constants.ts` (single source of truth — wire copy must remain identical across resources to prevent enumeration via copy differences).
- **`lib/admin-projects-mutations-internal.ts`** — server-only helpers that may throw. Exports `createProjectInternal`, `updateProjectInternal`, `deleteProjectInternal`, the zod schemas, and the operation tags used in structured logs. NO `'use server'` directive — these are regular ES module functions, not Server Actions. Imports the Supabase server client and is therefore poisoned by `next/headers`; never import this module from a client component.
- **`lib/admin-projects-mutations.ts`** — `'use server'` directive. Exports ONLY the public Server Action entry points (`createProject`, `updateProject`, `deleteProject`). Each wrapper applies the four-channel uniformity contract: `try/finally` with `MIN_DURATION_MS = 750` floor (Channel 3), `try/catch` that converts `ZodError` to `fieldErrors` and any other throw to a generic `formError` (Channels 1, 2), no rethrow to the wire (Channel 6), no `Set-Cookie` writes (Channel 5). Every export here lands a stable hashed action ID in `.next/server/server-reference-manifest.json` (§6.6.5).

Posts and stats follow the same trio shape — `lib/admin-posts-mutations-{types,internal,}.ts` and `lib/admin-stats-mutations-{types,internal,}.ts`. The form component for each resource (`components/admin/ProjectForm.tsx`, `PostForm.tsx`, `StatsInsertForm.tsx`) is `'use client'`, imports types from its sibling `-types.ts` only, and receives Server Action references via Next 15's transform — no runtime import of the wrapper module is needed on the client. `useActionState` threads the state envelope.

Why three files and not the two-file split from §6.6.1: the auth flow's client surface (`LoginForm`) never imports anything from `lib/auth-internal.ts` or `lib/auth.ts` at the type level — the form is fully ignorant of the action's return shape because magic-link auth returns `void`. Mutations are different: the form has to react to `fieldErrors` and `formError`, which requires importing the shape from somewhere. A two-file split (types co-located with internal helpers) breaks the build with `You're importing a component that needs "next/headers"` because the client component transitively pulls the Supabase server client. Pushing the types into `lib/types.ts` would pollute the domain-types module with admin-only UI state. The third file is the cleanest boundary — and it is binding for every future admin mutation task.

**Why per-resource and not shared (T25 evolution)** — the shared trio crossed CQ-02's 300-line service-file budget at T24 (admin-mutations.ts = 519, admin-mutations-internal.ts = 687); per-resource modules also reduce blast radius for future mutations, isolate test mocks, and decouple the slug-lock policy (projects/posts) from the schemaless write path (stats) and the file-handling path (images, T25).

**Code-review checklist:** any new `'use server'` admin mutation module must (1) keep its file scope to public Server Action wrappers only — no exported helpers, types, or consts; (2) import types from a `-types` sibling; (3) wrap the internal helper in the four-channel contract; (4) update `tests/server-actions-manifest.test.ts` in the same PR; (5) live in its own per-resource trio — do NOT add a new mutation to a sibling resource's `-mutations.ts`. New resources get a new trio.

---

## 7. Markdown Renderer (Decision 6)

**Library:** `marked` (Markdown → HTML) + `DOMPurify` (sanitization).
**Layer:** client-side. The DB stores the raw Markdown. Rendering happens in a client component because DOMPurify uses the DOM (jsdom on server is possible but adds weight; client-side is sufficient for this site's traffic profile).

**Whitelist (final):**

| Element | Allowed attributes |
|---|---|
| `p`, `ul`, `ol`, `li`, `blockquote`, `code`, `pre`, `em`, `strong`, `h1`, `h2`, `h3`, `h4` | none |
| `a` | `href` only — `javascript:` protocol stripped |
| `img` | `src`, `alt` only |

Everything else is removed. Inline event handlers (`onerror`, `onclick`, etc.) are removed by DOMPurify by default and explicitly verified by tests.

**Founder Brief:** "Markdown renderer" in [`founder-brief.md`](founder-brief.md).

**Why client-side and not server-side rendering of HTML:**
- The DB never contains HTML, so a stored-XSS path through the database is closed off by construction.
- Server-side rendering of sanitized HTML is possible but means the sanitizer runs on every cache miss. Client-side keeps the cache layer simple and the trust boundary unambiguous.

---

## 8. Founder Briefs (inline + compiled)

The full Founder Brief document is [`founder-brief.md`](founder-brief.md). Each architectural decision in this file (Sections 1.3, 2.3, 2.4, 3.3, 4.2, 7) is also a Founder Brief entry. Architecture changes require a corresponding Founder Brief update.

---

## 9. Constraints

The binding decisions in this document are mirrored in [`constraints.md`](constraints.md). Constraint IDs (`CONSTRAINT-XX`) provide stable references for future sessions to check compliance against.
