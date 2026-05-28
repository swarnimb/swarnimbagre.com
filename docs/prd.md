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
- Given a visitor lands on `/projects`, when the page renders, then all `projects` rows with `status='published'` are listed in the admin-defined order (`sort_order` ascending; see 3.7).
- Given a project has `project_media` rows, when its card renders, then the card's image slot is a swipeable carousel of those rows. Carousel chrome and behavior are canonical in 2.3a (same component, same data — no separate "card primary image" concept).
- Given a project has zero `project_media` rows, when its card renders, then no image area is shown.
- Given a project is `status='draft'`, when any anonymous request hits the page, then that project is invisible in the response (RLS-enforced, not app-filtered).

### 2.3a Page: Project detail (`/projects/[slug]`)

The showcase surface for a single project. Renders the project's card content (title, description, progress ring, links) above a multi-image carousel. The carousel on this page is the same component (same chrome, same data) as the carousel embedded in the project card on `/projects` — only the container size differs.

**Project media model:**
- A project has 0–20 ordered `project_media` rows.
- Each row is either a **single image** (`image_id` set, `image_after_id` NULL) or a **before/after pair** (both set).
- Pair rows render as a `BeforeAfterMedia` drag-slider slide.
- Each row optionally has a plain-text caption (≤140 chars soft, 280 hard).

**G/W/T (canonical for the carousel surface — referenced by 2.3, 2.3a, 3.5):**
- Given a project has multiple media rows, when the carousel renders, then dots below + left/right arrows + horizontal swipe + keyboard ←/→ are all functional. No auto-advance. No loop — boundaries stop at first/last slide.
- Given a project has exactly one media row, when the carousel renders, then no nav chrome is shown (no dots, no arrows, no swipe affordance) — the single slide renders as a static image or slider.
- Given a project has zero media rows, when the page renders, then no carousel section appears.
- Given a media row has a caption, when its slide is active, then the caption renders below the image in muted meta type.
- Given a screen reader is active, when a slide becomes active, then the live region announces "Slide N of M, [alt text]".
- Given `prefers-reduced-motion: reduce`, when slides change, then no transition animation runs.
- Given a pair row's slide is active, when the visitor drags the inner before/after divider, then the divider responds to drag and the surrounding carousel swipe does not advance (drag-handle takes priority within its hit area).
- Given the slug points to a `status='draft'` project, when an anonymous request hits `/projects/[slug]`, then the response is 404 (RLS returns no row).

### 2.4 Page: Writing (`/writing`)

**G/W/T:**
- Given a visitor lands on `/writing`, when the page renders, then all `posts` rows with `status='published'` are listed in the admin-defined order (`sort_order` ascending; see 3.7) with title, excerpt, and date.
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
**Sole account:** the configured admin email (held in `ADMIN_ALLOWED_EMAIL` and the Supabase Auth user record; not committed to the repo). Enforced in two places: Supabase Auth user table AND the `ADMIN_ALLOWED_EMAIL` environment variable. Both must match for sign-in to succeed.
**JWT:** 1 hour (Supabase default).
**Refresh:** 30 days inactivity (Supabase default).
**Lockout fallback:** if email is unreachable, recover by manually invalidating session in the Supabase dashboard.

**G/W/T:**
- Given an unauthenticated request to any `/admin/*` route, when middleware runs, then the user is redirected to `/admin/login`.
- Given a valid magic link is clicked, when the callback runs, then a session cookie is set and the user is redirected to `/admin`.
- Given a session has expired, when the next admin request runs, then the user is redirected to `/admin/login` with no error leak.
- Given any login submission (allowlisted email, non-allowlisted email, or malformed input), when the form is submitted, then the user sees the same success-shaped UI ("check your inbox"), the response payload is identical, and the response time is bounded to a uniform floor — no observable channel distinguishes outcomes.

### 3.2 Projects CRUD (`/admin/projects`)

List, create, edit, delete. All four operations server-side via Server Actions or Route Handlers — no client-side writes.

**Fields:** `title` (required, ≤200 chars), `description` (required, textarea), `status` (`draft` | `published`), optional project media (see 3.5).
**Slug:** auto-generated from `title` via slugify. Editable while `status='draft'`. Locked (DB-level) once `status='published'`.
**Delete:** hard-delete with confirm modal. Cascades to `project_media` rows; orphaned `images` rows are cleaned up via 3.6. No soft-delete. No undo path.

### 3.3 Posts CRUD (`/admin/posts`)

CRUD shape analogous to Projects, with two differences: posts carry a Markdown `content` body, and posts use the single-image upload (see 3.5a) — they do not receive the multi-image carousel.

**Fields:** `title`, `content` (raw Markdown, stored verbatim in DB), `status`, optional image (see 3.5a).
**Render path:** stored Markdown is rendered client-side at read time via `marked` + DOMPurify whitelist. The DB never stores HTML.
**Slug:** auto, lock-on-publish, same as Projects.

### 3.4 Stats view (`/admin/stats`)

Read-only list with one exception: a manual insert form for backfills.

**G/W/T:**
- Given the admin loads `/admin/stats`, when the page renders, then `stats` rows are listed in reverse-chronological order with `category`, `label`, `value`, `unit`, `created_at`.
- Given the admin needs to correct a row, when they delete the wrong row and re-insert via the manual form, then the stats list reflects the correction. (No audit trail in Phase 1.)
- No edit. Stats are append-only at the data model.

### 3.5 Project media component (`/admin/projects/[id]`)

Replaces the single-image upload for projects. Each project has 0–20 ordered `project_media` rows. Each row is either a single image or a before/after pair. The rows surface as the carousel on the public site (list cards and detail page — see 2.3a for canonical behavior).

**Row types:**
- **Single image:** `image_id` set, `image_after_id` NULL → renders as a static image slide.
- **Pair:** both `image_id` and `image_after_id` set → renders as a `BeforeAfterMedia` drag-slider slide.

**G/W/T:**
- Given an admin clicks "+ image", when a file is selected, then the size is validated against the 5 MB cap; oversize is rejected with an inline error.
- Given an admin clicks "+ pair", when both files are selected (before + after), then both are validated independently against the 5 MB cap.
- Given an admin tries to save a row with an empty `alt_text` on any image, when they submit, then the form rejects with a required-field error (alt-text required on every image, single or paired).
- Given an admin enters a caption longer than 140 characters, when the form re-renders, then a soft warning shows but save is not blocked. Hard validation at 280 chars (server-side).
- Given an admin has 11+ rows on a project, when the form re-renders, then a "consider trimming" warning shows. Hard cap is 20 rows (DB CHECK constraint).
- Given an admin drags a row to reorder, when they release, then the visual order updates but persistence happens on form Save (not auto-save).
- Given an admin deletes a row, when they confirm in the modal, then the `project_media` row is deleted. Underlying `images` rows are orphaned and cleaned up by 3.6.
- Given an admin uploads successfully, when the upload completes, then each file lives at `images/projects/{project_id}/{uuid}_{filename}` and an `images` row is inserted with `bucket_path`, `alt_text`, `parent_id`, `parent_type='project'`. A `project_media` row is inserted referencing the image row(s).
- No aspect-ratio lock at upload. No byte-quota enforcement (cap is row count, not bytes).

### 3.5a Post image component (`/admin/posts/[id]`)

Single image per post. No change from the original Phase 1 behavior — posts do not receive the multi-image carousel.

**G/W/T:**
- Given an admin uploads an image, when the file is selected, then the size is validated against the 5 MB cap; oversize is rejected with an inline error.
- Given an admin tries to save a post with an image attached and an empty `alt_text`, when they submit, then the form rejects with a required-field error.
- Given an admin uploads successfully, when the upload completes, then the file lives at `images/posts/{post_id}/{uuid}_{filename}` and an `images` row is inserted with `bucket_path`, `alt_text`, `parent_id`, `parent_type='post'`.
- No aspect-ratio lock. No quota enforcement.

### 3.6 Orphan cleanup

Best-effort. A button on `/admin/images` that deletes `images` rows with both `parent_id` and `parent_type` NULL and `created_at` older than 7 days, plus the corresponding Storage objects. Confirm modal. No automation, no scheduler.

### 3.7 Project & Post Reordering (`/admin/projects`, `/admin/posts`)

Manual drag-to-reorder for the project list and the post list. Sets the order both admin and public lists render in. Supersedes the reverse-chronological default in 2.1 and 2.3.

**Scope:** projects and posts only, one order per type. Stats stay reverse-chronological. Media-row reorder inside a project (3.5) is unaffected.
**Mechanism:** drag a row in the admin list; release to set visual order; persistence on an explicit "Save order" action — not auto-save (mirrors 3.5).
**Persistence:** a per-row `sort_order` integer; saved array position is the order (0-based, ascending).
**Default order:** existing rows backfilled newest-first (preserves current behaviour); a newly created project or post appends to the end of the order until dragged.
**Desktop-only:** single operator; no touch-drag.

**G/W/T:**
- Given the admin loads `/admin/projects` or `/admin/posts`, when the page renders, then rows are listed in `sort_order` ascending, not reverse-chronological.
- Given the admin drags a row and drops it, when they release, then the visual order updates but is not yet persisted.
- Given the admin clicks "Save order", when it succeeds, then the new order persists, a success toast shows, and reloading the page preserves it.
- Given the admin reorders rows then navigates away without saving, when they return, then the previously saved order is shown.
- Given a visitor lands on `/projects` or `/writing`, when the page renders, then published rows appear in the admin-defined `sort_order`, not by date.
- Given a draft sits between two published rows in the admin order, when the public list renders, then only the published rows show, in their relative order.

**Out of scope:** cross-page reordering (admin lists paginate at 50; reorder operates within the loaded page); touch / mobile drag (admin is desktop-only); reordering stats; per-section "featured" flags or multiple orderings.
**Success metric:** the admin can set the public display order of projects and posts by dragging, and the public site renders that order.

---

### 3.8 Project Writeup Embedding (`/projects/<slug>`)

A project may attach one existing writing post; its body renders on the project detail page below the card/carousel. Makes the detail page show content the list card does not. Layout: see Override 3 in `design-decisions.md`.

**Scope:** projects only, one attached post per project. The attached post is a normal post that also appears in `/writing` (reused, not project-only).
**Reference:** new `projects.post_id` FK → `posts(id)`, nullable, `on delete set null`. Distinct from `post_url` (the `¶ notes` outbound link, which stays independent).
**Link activation:** the `/projects` list links a card's title to its detail page only when the project has an attached post OR more than one media item; otherwise the card is non-clickable.
**Visibility:** only a `published` attached post renders publicly; a draft or null `post_id` renders nothing.

**G/W/T:**
- Given a project's `post_id` points to a published post, when a visitor opens `/projects/<slug>`, then that post's body renders below the carousel, styled like `/writing`.
- Given a project has no `post_id` and at most one media item, when a visitor views `/projects`, then that project's title is not a link (no detail navigation).
- Given a project has a `post_id` OR more than one media item, when a visitor views `/projects`, then its title links to `/projects/<slug>`.
- Given the attached post is a draft or missing, when the detail page renders, then no body shows — no error, no leak.
- Given the admin edits a project, when the form loads, then a "Linked writeup" dropdown lists published posts plus an "Unset" option and saves to `post_id`.
- Given a project has both `post_id` and `post_url`, when the detail page renders, then the embedded body shows and the `¶ notes` button still links to `post_url`.

**Out of scope:** multiple posts per project; project-only posts hidden from `/writing`; embedding bodies on the `/projects` list cards (detail page only).
**Success metric:** opening a project that has a writeup shows real long-form content, not a duplicate of the card.

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
| `projects` | Public project entries | `status` enum, slug locked after publish. `image_id` + `image_after_id` columns deprecated as primary read path; new uploads route through `project_media`. Reads fall back to legacy columns when no `project_media` rows exist. |
| `project_media` | Project carousel rows | Ordered media per project. Each row references one image (single-image row) or two images (before/after pair row). Optional plain-text caption. Hard cap 20 rows per project (DB CHECK). Added by T43. |
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

### 7.1 From kickoff brief (verbatim from `docs/kickoff-brief.md`)

- Multi-user accounts, comments, reactions, social login.
- Newsletter signup, gated content, payments.
- Native mobile app.
- Headless CMS (Sanity / Payload / etc.) — evaluated and rejected.
- Auto-bundled `.bundled.html` files from the design bundle (using the source multi-file version for editability).
- Feed page (was in early design iteration; dropped — bundle ships 4 pages).

### 7.2 Added at T43 (project media)

- Video clips and animated GIFs as distinct content types. (A GIF uploaded as an image renders as a static image; no animated-image handling, no `<video>` element.)
- Lightbox / full-screen zoom on image click.
- Auto-advance / auto-play on the carousel.
- Image editing in admin (cropping, filtering, rotation, etc.).
- Caption markdown / hyperlinks (captions are plain text only).
- Multi-image cards in the home page's `ProjectRow` (the home scroller uses `thumbKind` SVG icons, not photos — unaffected by this feature).

---

## 8. Open Questions, Resolved

The kickoff brief left a small set of questions open. All resolved during Phase 1 of `@plan`:

| Question | Resolution |
|---|---|
| Auth flow | Magic link, Supabase Auth defaults (1hr JWT, 30-day refresh). |
| Image policy | Re-resolved at T43: projects use multi-image carousel via `project_media` (soft cap 10 / hard cap 20 rows). Posts keep single image. `alt_text` required per image. 5 MB cap per file. No aspect lock. |
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
