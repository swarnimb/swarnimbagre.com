# PRD: swarnimbagre.com

**Date:** 2026-05-06
**Status:** Locked. All Phase 1 product gates passed; produced by `@plan` Phase 4.
**Companion docs:** [`architecture.md`](architecture.md), [`plan-index.md`](plan-index.md), [`founder-brief.md`](founder-brief.md), [`constraints.md`](constraints.md).

---

## 1. Product Overview

A personal site at swarnimbagre.com hosting projects, writing, and a small set of hobby stats. Single-user admin panel at `/admin`. Stats are written programmatically by an external Telegram agent (OpenClaw) over a hardened HTTPS path; everything else is admin-managed.

The site exists for its owner first. It is not a marketing surface. The voice is dry, self-deprecating, and anti-LinkedIn. Visitors are recruiters, peers, and people who clicked through from elsewhere — none of them are converted, paywalled, or asked for an email.

**Primary user:** Swarnim — content owner, sole admin, sole authenticated account.
**Secondary user:** anyone who visits the public URL — passive reader, no account, no interaction.

**Why a custom build over a CMS:** evaluated and rejected at kickoff. A self-built panel keeps the design rules (verbatim bundle on the public site) intact and avoids the maintenance overhead of a CMS not chosen.

---

## 2. Public Site

Four pages. Layout, components, and tokens come verbatim from the bundle at `docs/design-source/personal-site-web/`. No new components, no token overrides.

### 2.1 Routing and viewport

Server-side UA detection via Next.js middleware. Each page has a single canonical URL. Mobile and desktop variants render different components but share the same path; the middleware picks which variant to serve.

### 2.2 Page: Home (`/`)

**G/W/T:**
- Given a visitor lands on `/`, when the page renders, then it serves the bundle's Home component (desktop or mobile per UA), with hero + project scroll exactly as specified in `site/pages/Home.jsx` / `site/pages-mobile/Home.jsx`.
- Given a search engine crawls `/`, when it reads the response, then `<title>`, `<meta description>`, and `<link rel="canonical">` are present and accurate.

### 2.3 Page: Projects (`/projects`)

**G/W/T:**
- Given a visitor lands on `/projects`, when the page renders, then all `projects` rows with `status='published'` are listed in reverse-chronological order.
- Given a project has an associated image, when the project card renders, then the image loads from Supabase Storage with its required `alt_text`.
- Given a project is `status='draft'`, when any anonymous request hits the page, then that project is invisible in the response (RLS-enforced, not app-filtered).

### 2.4 Page: Writing (`/writing`)

**G/W/T:**
- Given a visitor lands on `/writing`, when the page renders, then all `posts` rows with `status='published'` are listed in reverse-chronological order with title, excerpt, and date.
- Given a visitor opens an individual post (`/writing/[slug]`), when the page renders, then the post's raw Markdown is parsed by `marked` and sanitized by DOMPurify against the locked whitelist before being injected into the DOM.
- Given a draft post exists, when an anonymous request hits its slug URL, then the response is a 404 (RLS returns no row, page renders not-found).

### 2.5 Page: Other (`/other`)

**G/W/T:**
- Given a visitor lands on `/other`, when the page renders, then `stats` rows are grouped by `category` and rendered using the bundle's Other-page layout.
- Given the same `category`/`label` has multiple rows, when the page renders, then all rows are visible (append-only semantics — no de-duplication on read).

### 2.6 Tweaks panel

Gated by `NEXT_PUBLIC_TWEAKS=1` env var. The legacy `?tweaks=1` querystring is dropped post-Next.js migration. The tweaks panel never ships to production; gating is a build-time concern.

---

## 3. Admin Panel

Single user, magic link auth. Lean CRUD only. No analytics, no scheduling, no dashboard widgets.

### 3.1 Auth

**Provider:** Supabase Auth, email magic link, Email provider only.
**Sole account:** swarnim.build@gmail.com (configured in Supabase).
**JWT:** 1 hour (Supabase default).
**Refresh:** 30 days inactivity (Supabase default).
**Lockout fallback:** if email is unreachable, recover by manually invalidating session in the Supabase dashboard.

**G/W/T:**
- Given an unauthenticated request to any `/admin/*` route, when middleware runs, then the user is redirected to `/admin/login`.
- Given a valid magic link is clicked, when the callback runs, then a session cookie is set and the user is redirected to `/admin`.
- Given a session has expired, when the next admin request runs, then the user is redirected to `/admin/login` with no error leak.

### 3.2 Projects CRUD (`/admin/projects`)

List, create, edit, delete. All four operations server-side via Server Actions or Route Handlers — no client-side writes.

**Fields:** `title` (required, ≤200 chars), `description` (required, textarea), `status` (`draft` | `published`), optional image (see 3.5).
**Slug:** auto-generated from `title` via slugify. Editable while `status='draft'`. Locked (DB-level) once `status='published'`.
**Delete:** hard-delete with confirm modal. No soft-delete. No undo path.

### 3.3 Posts CRUD (`/admin/posts`)

Same shape as Projects with one extra field.

**Fields:** `title`, `content` (raw Markdown, stored verbatim in DB), `status`, optional image.
**Render path:** stored Markdown is rendered client-side at read time via `marked` + DOMPurify whitelist. The DB never stores HTML.
**Slug:** auto, lock-on-publish, same as Projects.

### 3.4 Stats view (`/admin/stats`)

Read-only list with one exception: a manual insert form for backfills.

**G/W/T:**
- Given the admin loads `/admin/stats`, when the page renders, then `stats` rows are listed in reverse-chronological order with `category`, `label`, `value`, `unit`, `created_at`.
- Given the admin needs to correct a row, when they delete the wrong row and re-insert via the manual form, then the stats list reflects the correction. (No audit trail in Phase 1.)
- No edit. Stats are append-only at the data model.

### 3.5 Image component (Projects + Posts)

A shared component used inside both Projects and Posts forms.

**G/W/T:**
- Given an admin uploads an image, when the file is selected, then the size is validated against the 2 MB cap; oversize is rejected with an inline error.
- Given an admin tries to save a project/post with an image attached and an empty `alt_text`, when they submit, then the form rejects with a required-field error.
- Given an admin uploads successfully, when the upload completes, then the file lives at `images/{projects|posts}/{parent_id}/{uuid}_{filename}` and an `images` row is inserted with `bucket_path`, `alt_text`, `parent_id`, `parent_type`.
- No aspect-ratio lock. No quota enforcement.

### 3.6 Orphan cleanup

Best-effort. A button on `/admin/images` that deletes `images` rows with both `parent_id` and `parent_type` NULL and `created_at` older than 7 days, plus the corresponding Storage objects. Confirm modal. No automation, no scheduler.

---

## 4. OpenClaw Write Path

OpenClaw is an external Telegram agent that writes hobby stats. It is the only programmatic writer to the database.

**Write target:** `stats` table only. No SELECT, UPDATE, DELETE. No access to any other table.
**Mechanism:** Supabase Edge Function `stats-ingest`. Validates a shared secret in the request header using a constant-time comparison. On success, INSERTs via service role. On failure, returns 401.
**Why an Edge Function and not a publishable key:** the publishable key would be public on the internet by design; the secret-header pattern restricts writes to OpenClaw specifically. See [`founder-brief.md`](founder-brief.md) entry "OpenClaw access".

**PRD-level acceptance:**
- Valid secret + valid payload → 201, row inserted.
- Missing or wrong secret → 401, no row inserted, no detail leaked in the response body.
- Malformed payload → 400 with a generic field-level message.
- Constant-time comparison is required (timing attack mitigation).
- Stats are append-only. Duplicate inserts are allowed; corrections happen via admin delete + re-insert.

---

## 5. Data Model (Preview)

Full schema with column types, constraints, and indexes is in [`architecture.md`](architecture.md). Preview only here.

| Table | Purpose | Notes |
|---|---|---|
| `projects` | Public project entries | `status` enum, slug locked after publish |
| `posts` | Writing entries | `content` is raw Markdown; rendered client-side |
| `stats` | Hobby data points | Append-only; OpenClaw writes via Edge Function |
| `images` | Image metadata + Storage path | `alt_text` NOT NULL; FK to parent project or post |

Storage bucket `images/` holds the raw files. Path scheme: `images/{projects|posts}/{parent_id}/{uuid}_{filename}`.

---

## 6. Non-Functional Requirements

### 6.1 Voice

Dry, self-deprecating, anti-LinkedIn. Applies to public site copy AND admin labels.
**Forbidden:** superlatives, SaaS phrases ("AI-powered", "next-gen", "seamless", "powerful"), LinkedIn-motivational tone, emoji.
**Allowed in admin:** typographic symbols (※, ¶, *, →, ↗) only when needed.

### 6.2 Security (high-level — full threat model in `architecture.md`)

- Default-deny RLS on every table. Explicit policies grant access.
- Single auth principal. No multi-user, no roles to administrate.
- All Markdown sanitized client-side via DOMPurify whitelist before render.
- All file uploads validated for type and size at the boundary.
- No secrets in source. `.env.example` lists names only.
- No PII in logs (email is masked or replaced with a presence flag).

### 6.3 Performance

- Public pages render under 2s on first paint over a typical home connection.
- Vercel CDN caches static assets aggressively (1 year). HTML is cached for 1 hour.
- Supabase free tier covers projected usage with substantial headroom (see ASSUMPTION-05).

### 6.4 Hosting and budget

- Vercel free tier. Single project. GitHub-driven deploys.
- Supabase free tier. Single project. One-week-pause risk mitigated by daily OpenClaw write traffic.
- Total monthly cost: $0.

---

## 7. Out of Scope

Verbatim from `docs/kickoff-brief.md`:

- Multi-user accounts, comments, reactions, social login.
- Newsletter signup, gated content, payments.
- Native mobile app.
- Headless CMS (Sanity / Payload / etc.) — evaluated and rejected.
- Auto-bundled `.bundled.html` files from the design bundle (using the source multi-file version for editability).
- Feed page (was in early design iteration; dropped — bundle ships 4 pages).

---

## 8. Open Questions, Resolved

The kickoff brief left a small set of questions open. All resolved during Phase 1 of `@plan`:

| Question | Resolution |
|---|---|
| Auth flow | Magic link, Supabase Auth defaults (1hr JWT, 30-day refresh). |
| Image policy | Optional. `alt_text` required when an image is present. 2 MB cap. No aspect lock. |
| Slug behavior | Auto-from-title. Editable while draft. Locked at DB level on publish. |
| Session expiry | Supabase Auth defaults. No custom timeout. |
| Storage cleanup | Best-effort. Admin button on `/admin/images`. 7-day age threshold. No quota enforcement. |
| Stats correction UX | Admin deletes the wrong row + re-inserts a correction. No audit trail in Phase 1. |
| Tweaks panel in production | `NEXT_PUBLIC_TWEAKS=1` env var. Querystring path retired with the Next.js migration. |
| OpenClaw access | Edge Function `stats-ingest` with shared-secret header (Option A from ASSUMPTION-06). |

---

## 9. Phase 2 Architectural Decisions (locked)

These are locked at architecture-level. Each has a Founder Brief in [`founder-brief.md`](founder-brief.md):

1. **Stack:** Next.js 15 App Router from day one. Phase A static-bundle deploy is skipped.
2. **Stats schema (resolves ASSUMPTION-01):** single typed table with `category`, `label`, `value`, `unit` text columns. Append-only.
3. **Tailwind scoping (resolves ASSUMPTION-04):** `tailwindcss-scoped-preflight` plugin. Tailwind only in `app/(admin)/layout.tsx`. Public bundle never sees Tailwind.
4. **OpenClaw access (resolves ASSUMPTION-06):** Edge Function with shared-secret header.
5. **Image data layer:** Storage bucket + `images` table with required `alt_text` and parent FK. Best-effort orphan cleanup.
6. **Markdown renderer:** `marked` + DOMPurify with locked whitelist (`p, ul, ol, li, blockquote, code, pre, em, strong, a[href], h1-h4, img[src,alt]`).

Full detail and trade-offs: [`architecture.md`](architecture.md), [`founder-brief.md`](founder-brief.md), and [`constraints.md`](constraints.md).

---

## 10. Build Plan

The 40-task plan lives in [`plan-index.md`](plan-index.md), split across four phase files:

- `plan-phase-1-foundation.md` — Foundation (T1–T14)
- `plan-phase-2-admin.md` — Admin panel (T15–T28)
- `plan-phase-3-ingestion.md` — OpenClaw ingestion (T29–T31)
- `plan-phase-4-launch.md` — Polish + launch (T32–T40)
