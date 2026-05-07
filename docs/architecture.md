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

### 4.1 Repo layout (proposed)

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
│   └── (admin)/                      # route group — admin layout owns Tailwind import
│       ├── layout.tsx                # admin-only Tailwind/shadcn CSS, Inter font
│       ├── page.tsx                  # admin home
│       ├── login/page.tsx
│       ├── projects/...
│       ├── posts/...
│       ├── stats/page.tsx
│       └── images/page.tsx
├── components/
│   ├── public/                       # public bundle ports (verbatim from site/)
│   ├── admin/                        # shadcn-based admin components
│   └── ui/                           # shadcn primitives (generated)
├── lib/
│   ├── supabase.ts                   # client factories (server, browser)
│   ├── db.ts                         # public reads
│   ├── admin-queries.ts              # admin reads
│   ├── admin-mutations.ts            # admin writes (Server Actions)
│   ├── markdown.ts                   # marked + DOMPurify whitelist
│   ├── auth.ts                       # session helpers, signOut
│   └── images.ts                     # Storage URL helpers
├── styles/
│   ├── colors_and_type.css           # public bundle tokens, imported by root layout
│   ├── base.css                      # public site base, imported by root layout
│   └── admin.css                     # Tailwind + scoped-preflight, imported only by admin layout
├── supabase/
│   ├── migrations/                   # SQL migrations, sequentially numbered
│   └── functions/
│       └── stats-ingest/index.ts     # Edge Function
├── middleware.ts                     # Next.js middleware: UA detect + admin auth gate
└── public/                           # static assets
```

### 4.2 Tailwind scoping (Decision 3 — resolves ASSUMPTION-04)

Tailwind is imported in exactly one place: `styles/admin.css`, which is in turn imported only by `app/(admin)/layout.tsx`. The plugin `tailwindcss-scoped-preflight` wraps Tailwind's Preflight reset under the `.admin-root` selector. Every admin page renders inside `<div className="admin-root">...</div>`.

The Tailwind config's `content` glob includes only `./app/(admin)/**/*` and `./components/admin/**/*` and `./components/ui/**/*`. Public components are excluded. The public bundle never sees a Tailwind utility class, and the Preflight reset never reaches public route HTML.

**Founder Brief:** "Tailwind scoping" in [`founder-brief.md`](founder-brief.md).

### 4.3 File and function size budgets

Per CQ-01 and CQ-02:
- Functions ≤ 50 lines (security/validation may extend to 80).
- Service files ≤ 300 lines.
- Component files ≤ 200 lines.

When a module hits the limit, split by single responsibility (CQ-03). `lib/admin-mutations.ts` is the most likely growth file; it splits per resource (`admin-mutations-projects.ts`, `admin-mutations-posts.ts`, etc.) when it exceeds 300 lines.

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
