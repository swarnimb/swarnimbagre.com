# PRD: swarnimbagre.com

**Date:** 2026-05-06
**Re-baselined:** 2026-08-07 — reconciled against shipped code after **T46** (full public-site redesign, 2026-08-04) and **T41** (`b369d47`, discoverability + public-route resilience). Every spec below was checked against `app/`, `components/`, `app/styles/`, `package.json` and `supabase/migrations/*.sql` rather than against sibling docs. Sections describing surfaces that no longer exist are marked **Superseded** and reduced to a stub — never deleted or renumbered, because plan tasks and `@create-plan` cite section numbers.
**Status:** Locked. All Phase 1 product gates passed; produced by `@plan` Phase 4.
**Companion docs:** [`architecture.md`](architecture.md), [`plan-index.md`](plan-index.md), [`founder-brief.md`](founder-brief.md), [`constraints.md`](constraints.md), [`design-decisions.md`](design-decisions.md).

> **Reading rule.** This file states *what the product is*. Rationale for design and architecture decisions lives in `design-decisions.md`, `constraints.md` and `founder-brief.md`; where this file used to restate it, it now cites the CONSTRAINT id instead.

---

## 1. Product Overview

A personal site at swarnimbagre.com hosting projects, writing, and a small set of hobby stats and notes. Single-user admin panel at `/admin`. Stats are written programmatically by an external Telegram agent (OpenClaw) over a hardened HTTPS path; everything else is admin-managed.

The site exists for its owner first. It is not a marketing surface. The voice is dry, self-deprecating, and anti-LinkedIn. Visitors are recruiters, peers, and people who clicked through from elsewhere — none of them are converted, paywalled, or asked for an email.

**Primary user:** Swarnim — content owner, sole admin, sole authenticated account.
**Secondary user:** anyone who visits the public URL — passive reader, no account, no interaction.

**Why a custom build over a CMS:** evaluated and rejected at kickoff. A self-built panel keeps the verbatim-design rule on the public site intact and avoids the maintenance overhead of a CMS not chosen.

---

## 2. Public Site

Four pages plus one detail route. Layout, components and tokens come **verbatim** from the Claude Design export at `docs/design-source/redesign-2026-08/` (`swarnim-bagre-site.bundled.html` is the shipped artifact; `template.extracted.html` is the readable unpacked markup). No new components, no token overrides.

The earlier dark bundle at `docs/design-source/personal-site-web/` — and the `site/` working copy derived from it, including `site/pages/`, `site/pages-mobile/`, `site/components.jsx`, `site/mobile-components.jsx`, `site/colors_and_type.css` and `site/tweaks-panel.jsx` — is **RETIRED**. Those files still sit in the repo as a historical record. Nothing builds from them. Do not spec against them.

**Palette and type (T46):** the site is light. Ground `#F4F1EA`, accent deep green `#1F3D2F` (`app/styles/colors_and_type.css`). Fonts are Instrument Serif (display), Space Grotesk (body/UI) and Space Mono (kickers, dates, tile labels), self-hosted via `next/font` on the `<html>` element in `app/layout.tsx`. The only saturated colors anywhere on the public site are the three brand marks in the Home reach-out row.

**Runtime cost:** the public site ships zero third-party runtime JS. `embla-carousel-react` was uninstalled at T46 and the card media frame is hand-rolled (`components/public/ProjectFrame.tsx`). `marked` + DOMPurify load only on `/writing/[slug]`.

**Chrome that does not exist:** no footer, no blinking cursor, no project detail page. Cross-page navigation is the shared `SiteHeader` (wordmark + Projects / Writing / Other, collapsing to a burger menu below 640px) on every page except Home, which navigates via the three pill buttons in its reply bubble.

### 2.1 Routing and viewport

**One responsive tree.** Server-side UA device detection and the entire mobile component fork were deleted at T46. There is one component per page and one width breakpoint at **640px**, declared in the page-scoped stylesheets under `app/styles/`. (`public-other.css` additionally carries a `max-height: 600px` guard so the viewport-locked Other grid survives short windows; that is a height guard, not a second device breakpoint.)

`middleware.ts` matches `/admin/:path*` **only**. No middleware runs on any public request, and there is no `x-device-variant` header.

**Public route set — this is the whole list:**

| Route | File | Notes |
|---|---|---|
| `/` | `app/page.tsx` | Home. Reads no data. |
| `/projects` | `app/projects/page.tsx` | Card grid. |
| `/writing` | `app/writing/page.tsx` | Post list. |
| `/writing/[slug]` | `app/writing/[slug]/page.tsx` | **The only detail route on the site.** |
| `/other` | `app/other/page.tsx` | Stats + notes tiles. |

Every page sets `export const dynamic = 'force-dynamic'` (the Supabase SSR client reads request cookies) and exports `title`, `description` and an absolute `canonical` under `https://swarnimbagre.com`.

### 2.2 Page: Home (`/`)

A fake conversation. The chat box is **deliberately not wired to a model** — no API route, no history, no backend. Submitting swaps in one canned exchange and the deflection copy admits it. That is the joke, and it is a product decision, not an unfinished feature. See `CLAUDE.md` → Out of Scope.

**G/W/T:**
- Given a visitor lands on `/`, when the page renders, then it renders `components/public/pages/Home.tsx` with no database read at all: a wordmark header, a question bubble, an avatar + first-person bio, three nav pills (See the projects → `/projects`, Writing → `/writing`, Other → `/other`), a "Find me here:" row, and the input form.
- Given a visitor submits the chat form, when the submit handler runs, then the typed text is echoed as a question bubble (or the literal `tell me more` when the input was empty) and one of three canned deflections is shown. Rotation is by turn index, not random, so the behaviour is deterministic and testable.
- Given a visitor submits repeatedly, when each reply renders, then only the latest exchange is displayed — nothing accumulates and nothing is persisted.
- Given a visitor reads the reach-out row, when it renders, then exactly three branded icon links appear (LinkedIn, Email `mailto:`, GitHub), sourced from `lib/social-links.ts`. This row is on Home only.
- Given a search engine crawls `/`, when it reads the response, then `<title>`, `<meta description>` and `<link rel="canonical">` are present and accurate.

### 2.3 Page: Projects (`/projects`)

A grid of cards. Each card is: a media frame, then title, subtitle, description, tag pills and an action row.

**Card content slots** (`components/public/ProjectCard.tsx`): `title` (falls back to `Untitled project`), `subtitle` (falls back to `A new build, details on the way.`), `description` (omitted when blank), `tags` (pill row omitted when empty), and up to three actions — **Demo** (`live_url`), **GitHub** (`github_url`), **Writeup** (resolved from `post_id` → `/writing/<slug>`). When a project has no action at all the card shows `links coming soon`. Every slot degrades on its own; the schema permits an almost-empty project and the design draws that state deliberately.

**Not rendered on the card:** `progress_percent` and `thumb_kind`. Both columns still exist and `progress_percent` is still editable in admin, but T46 removed the progress ring and the SVG motif set from the public render. The columns are retained rather than dropped so historical values survive.

**G/W/T:**
- Given a visitor lands on `/projects`, when the page renders, then all `projects` rows with `status='published'` are listed in the admin-defined order (`sort_order` ascending; see 3.7).
- Given a project is `status='draft'`, when any anonymous request hits the page, then that project is invisible in the response (RLS-enforced, not app-filtered).
- Given a project's `post_id` points to a currently published post, when the card renders, then a **Writeup** action links to `/writing/<slug>`. Given the linked post is a draft, deleted, or unset, then no Writeup action renders — the card degrades, it never links to a 404.

**Media frame G/W/T — canonical for the carousel surface; referenced by 2.3a and 3.5.** Implemented in `components/public/ProjectFrame.tsx`.
- Given a project has more than one slide, when the frame renders, then a `N / M` counter, previous/next arrow buttons, a dot row, and horizontal touch swipe (40px threshold) are all functional. No auto-advance.
- Given the visitor advances past the last slide, when the index is computed, then it **wraps** to the first (and vice versa). The frame loops; it does not stop at the boundaries.
- Given a project has exactly one slide, when the frame renders, then no nav chrome is shown — no counter, no arrows, no dots, and swipe is inert.
- Given a project has zero `project_media` rows, when the card renders, then the frame still renders and shows the `no preview yet` placeholder. There is no fallback to an SVG motif and no collapsed image area.
- Given a media row is a before/after **pair**, when the frame builds its slide list, then that row contributes **two ordinary slides** (before, then after) and the counter reflects them. There is no drag-slider component: `BeforeAfterMedia` was specced but never built and does not exist in the codebase.
- **Not implemented as of 2026-08-07 (open requirements, deliberately retained rather than dropped):** per-slide captions are captured in admin, stored, and carried into the slide model, but are not drawn anywhere on the card; there is no keyboard ←/→ handler (the arrows are focusable buttons, which is the only keyboard path); there is no `aria-live` slide announcement; and no `prefers-reduced-motion` rule exists anywhere in `app/styles/`.

### 2.3a Page: Project detail (`/projects/[slug]`)

> **Superseded at T46 — this route was DELETED and does not exist.** Nothing under `/projects/` is served beyond the list, and `app/sitemap.ts` deliberately emits no project URLs. Depth now lives in the attached writing post: a project's **Writeup** action links to `/writing/<slug>` (see 2.3 and 3.8).
>
> The heading is retained because 2.3, 3.5 and 3.8 and several plan tasks cite it. The canonical carousel spec moved to **2.3** (Media frame G/W/T). The project media model itself is unchanged and is specced in **3.5**.

### 2.4 Page: Writing (`/writing`, `/writing/[slug]`)

The list is date + title + derived excerpt, each row a single link. `/writing/[slug]` is the only detail route on the site and is the target of every project card's Writeup action.

**G/W/T:**
- Given a visitor lands on `/writing`, when the page renders, then all `posts` rows with `status='published'` are listed in the admin-defined order (`sort_order` ascending; see 3.7) with date, title and an excerpt derived from `content` by `lib/post-summary.ts`.
- Given no posts are published, when the page renders, then a single honest empty line renders instead of an empty list.
- Given a visitor opens `/writing/[slug]`, when the page renders, then the header, a back link to `/writing`, the date and the title render server-side, and the post's raw Markdown is parsed by `marked` and sanitized by DOMPurify against the locked whitelist (§9.6) before injection. Sanitization is deferred to a client effect so DOMPurify never runs on the SSR Node path; the server emits an empty body container that hydrates after mount.
- Given a draft post exists, when an anonymous request hits its slug URL, then the response is a 404 (RLS returns no row, `notFound()` renders the not-found page).
- Given a post detail page is scraped, when metadata is read, then per-post `title`, `description` (first paragraph, truncated at 160 chars), `canonical`, `openGraph` (`type: article`, `publishedTime`, `modifiedTime`) and `twitter` cards are present. Posts have no cover art in the data model, so every post reuses the site OG card (§2.7).

### 2.5 Page: Other (`/other`)

"Everything else" — a viewport-locked tile grid, hairline-separated. **Seven hand-maintained tiles: four numeric tiles from `stats` over three text tiles from `notes`.** The count is an editorial convention maintained in admin, not a query limit: the page renders every row it is given and the fixed grid only looks right when filled.

Backed by migration `014_other_page_model.sql`, which added `stats.aside` + `stats.sort_order` and created the `notes` table (`kicker`, `line`, `sort_order`). Notes exist because the text tiles are a genuinely different shape from stats — no number, no unit, no category — and forcing them into `stats` with null columns would have been worse.

**G/W/T:**
- Given a visitor lands on `/other`, when the page renders, then `stats` rows render as numeric tiles (value, optional unit, label, optional italic `aside`) and `notes` rows render as text tiles (kicker + line). Both lists are ordered by `sort_order` ascending. Rows are **not** grouped by `category`; the category-grouped read was replaced at T46.
- Given both lists are empty, when the page renders, then one honest empty state renders instead of a grid of blank boxes.
- Given one of the two queries fails, when the page renders, then the other half of the grid still renders — each list loads behind its own `safeLoad` boundary (CONSTRAINT-14).
- Given the same `category`/`label` has multiple `stats` rows, when the page renders, then all rows are visible (append-only semantics — no de-duplication on read).

### 2.6 Tweaks panel

> **Not implemented; no shipped surface.** `NEXT_PUBLIC_TWEAKS` is still declared in `.env.example`, but no TypeScript or TSX file in the repo reads it and no tweaks component exists — the only implementation, `site/tweaks-panel.jsx`, belongs to the retired bundle (§2). If the panel is ever revived it is gated by that env var, never by a querystring, and it must not ship to production.

### 2.7 Discoverability and resilience surfaces (T41)

Shipped in `b369d47`. These are public surfaces with no page of their own.

| Surface | File | Behaviour |
|---|---|---|
| `/robots.txt` | `app/robots.ts` | Allows `/`, disallows `/admin` and `/api`, declares the sitemap and host. Hygiene, not a security control — the middleware gate is what protects `/admin`. |
| `/sitemap.xml` | `app/sitemap.ts` | The four root routes plus one entry per published post. Draft status is re-checked per row before a URL is emitted — a redundant check everywhere else, load-bearing here because this is the one surface that hands URLs to crawlers. Emits nothing under `/projects/`. |
| OG image | `app/opengraph-image.tsx` | One generated site card, inherited by every route. `metadataBase` in `app/layout.tsx` absolutizes it. |
| Favicon | `app/icon.svg` | Next file convention; `app/layout.tsx` deliberately declares no `icons` key, or the tag would be emitted twice. |
| Error boundary | `app/error.tsx` | Public runtime-error boundary. `app/(admin)/error.tsx` is the admin equivalent. |
| Not-found | `app/not-found.tsx` | Rendered by every `notFound()` call, including draft-post 404s. |

**G/W/T:**
- Given a crawler requests `/robots.txt` or `/sitemap.xml`, when the response is built, then it is valid and contains no draft content and no `/admin` or `/api` path.
- Given a public page throws at runtime, when the boundary catches, then the error page renders instead of a blank document, and the failure is logged with full context (CONSTRAINT-14 / EH-01).

---

## 3. Admin Panel

Single user, magic link auth. Lean CRUD only. No analytics, no scheduling, no dashboard widgets. Desktop-only.

Admin is deliberately **dark** and shares no palette with the public site. Its four brand tokens and four semantic tokens in `app/styles/admin.css` (`--admin-bg` `#1C1712`, `--admin-surface` `#252018`, `--admin-fg` `#E8E0D0`, `--admin-accent` `#C9A84C`) are admin-owned constants that mirror nothing since the public site went light at T46 — see CONSTRAINT-16. Admin uses shadcn/ui + Tailwind and shadcn's default typography; the public signature fonts are never used here.

**Sections** (`components/admin/AdminNav.tsx`): Projects, Posts, Stats, Notes, Images.

### 3.1 Auth

**Provider:** Supabase Auth, email magic link, Email provider only.
**Sole account:** the configured admin email (held in `ADMIN_ALLOWED_EMAIL` and the Supabase Auth user record; not committed to the repo). Enforced in two places: the Supabase Auth user table AND the `ADMIN_ALLOWED_EMAIL` environment variable. Both must match for sign-in to succeed.
**JWT:** 1 hour (Supabase default). **Refresh:** 30 days inactivity (Supabase default).
**Gate:** `middleware.ts` calls `getUser()` (not `getSession()`) so the JWT signature is verified server-side, and exempts exactly two paths by strict equality: `/admin/login` and `/admin/auth/callback`. Any subpath beneath those is gated.
**Lockout fallback:** the working path is a service-role session mint via `scripts/recover-admin-session.ts`, which builds the callback URL from `properties.hashed_token`. Password recovery and dashboard-copied action URLs cannot work in this system. Full procedure and its caveats: `auth-flow.md` §5.

**G/W/T:**
- Given an unauthenticated request to any `/admin/*` route, when middleware runs, then the user is redirected to `/admin/login` with no query params (no open-redirect surface, no UI-text channel).
- Given a valid magic link is clicked, when the callback runs, then a session cookie is set and the user is redirected to `/admin`.
- Given a session has expired, when the next admin request runs, then the user is redirected to `/admin/login` with no error leak.
- Given any redirect outcome (no session, expired, unexpected error), when the response is returned, then it is byte-identical across the three and padded to a uniform time floor (SEC-09).
- Given any login submission (allowlisted email, non-allowlisted email, or malformed input), when the form is submitted, then the user sees the same success-shaped UI ("check your inbox"), the response payload is identical, and the response time is bounded to a uniform floor — no observable channel distinguishes outcomes.

### 3.2 Projects CRUD (`/admin/projects`)

List, create, edit, delete. All four operations server-side via Server Actions or Route Handlers — no client-side writes. List paginates at 50.

**Fields:** `title` (required, ≤200 chars), `description` (required, textarea), `status` (`draft` | `published`), `subtitle` (optional, ≤120 chars, CHECK), `tags` (optional, 1–8 non-empty entries, CHECK), `progress_percent`, `github_url`, `live_url`, `post_url`, `post_id` ("Linked writeup" picker, see 3.8), and project media (see 3.5). `subtitle` and `tags` were added by migration `013_project_card_fields.sql`.
**Slug:** auto-generated from `title` via slugify. Editable while `status='draft'`. Locked (DB-level trigger, migration 006) once `status='published'`.
**Delete:** hard-delete with confirm modal. Cascades to `project_media` rows; orphaned `images` rows are cleaned up via 3.6. No soft-delete. No undo path.

### 3.3 Posts CRUD (`/admin/posts`)

CRUD shape analogous to Projects, with two differences: posts carry a Markdown `content` body, and posts use the single-image upload (see 3.5a) — they do not receive the multi-image carousel.

**Fields:** `title`, `content` (raw Markdown, stored verbatim in DB), `status`, optional image (see 3.5a).
**Render path:** stored Markdown is rendered client-side at read time via `marked` + DOMPurify whitelist. The DB never stores HTML.
**Slug:** auto, lock-on-publish, same as Projects.

### 3.4 Stats and Notes (`/admin/stats`, `/admin/notes`)

Both back the public `/other` page, which is why they sit next to each other in the nav.

**Stats** (`/admin/stats`): list + inline insert form on the same page (no `/new` route). Paginates at 50. Rows are **editable in place** and deletable — `insertStat`, `updateStat` and `deleteStat` all exist in `lib/admin-stats-mutations.ts`. The original "no edit, correct by delete + re-insert" rule was relaxed once the Other page needed `aside` and `sort_order` tuned by hand. The *data model* remains append-only for OpenClaw: the ingest path can only INSERT (§4).

**Notes** (`/admin/notes`): list + inline insert form, unpaginated, rows editable in place. `createNote`, `updateNote`, `deleteNote` in `lib/admin-notes-mutations.ts`.

**G/W/T:**
- Given the admin loads `/admin/stats`, when the page renders, then `stats` rows are listed with `category`, `label`, `value`, `unit`, `aside`, `sort_order` and `created_at`, and an insert form sits above the list.
- Given the admin edits a stat or note row and saves, when the mutation succeeds, then a dry success toast shows and the row reflects the new values. (No audit trail.)
- Given a new stat or note is inserted without an explicit `sort_order`, when the row lands, then a BEFORE INSERT trigger appends it at `max + 1` rather than colliding at 0 (migration `016_stats_notes_sort_order_append.sql`).
- Given a data-layer query fails on any admin page, when the request runs, then the error surfaces loudly in Next's error overlay — admin pages are deliberately NOT wrapped in `safeLoad` (CONSTRAINT-14 governs public pages only).

### 3.5 Project media component (`/admin/projects/[id]`)

Replaces the single-image upload for projects. Each project has 0–20 ordered `project_media` rows. Each row is either a single image or a before/after pair. The rows surface as the card media frame on `/projects` — see **2.3** for canonical render behaviour.

**Row types:**
- **Single image:** `image_id` set, `image_after_id` NULL → one slide.
- **Pair:** both `image_id` and `image_after_id` set → **two slides** on the public card (2.3). The drag-slider render originally specced for pairs was never built.

**G/W/T:**
- Given an admin clicks "+ image", when a file is selected, then the size is validated against the **2 MB** cap (`MAX_FILE_BYTES` in `lib/admin-images-mutations-types.ts`, mirroring `file_size_limit = 2097152` on the bucket in migration 008); oversize is rejected with an inline error.
- Given an admin clicks "+ pair", when both files are selected (before + after), then both are validated independently against the same cap.
- Given a file is not `image/jpeg`, `image/png` or `image/webp`, when it is submitted, then it is rejected at both the app boundary and the bucket. SVG is excluded on purpose.
- Given an admin tries to save a row with an empty `alt_text` on any image, when they submit, then the form rejects with a required-field error (alt-text required on every image, single or paired).
- Given an admin enters a caption longer than 140 characters, when the form re-renders, then a soft warning shows but save is not blocked. Hard validation at 280 chars (zod + DB CHECK). Note that captions are not currently rendered on the public card — see 2.3.
- Given an admin has 11+ rows on a project, when the form re-renders, then a "consider trimming" warning shows. Hard cap is 20 rows, enforced by the `project_media_enforce_row_cap` trigger (migration 010) and re-checked in zod.
- Given an admin drags a row to reorder, when they release, then the visual order updates but persistence happens on form Save (not auto-save).
- Given an admin deletes a row, when they confirm in the modal, then the `project_media` row is deleted. Underlying `images` rows are orphaned and cleaned up by 3.6.
- Given an admin uploads successfully, when the upload completes, then each file lives at `images/projects/{project_id}/{uuid}_{filename}` and an `images` row is inserted with `bucket_path`, `alt_text`, `parent_id`, `parent_type='projects'`. A `project_media` row is inserted referencing the image row(s).
- No aspect-ratio lock at upload. No byte-quota enforcement (cap is row count, not bytes).

### 3.5a Post image component (`/admin/posts/[id]`)

Single image per post. Posts do not receive the multi-image carousel.

**G/W/T:**
- Given an admin uploads an image, when the file is selected, then the size is validated against the 2 MB cap and the MIME allowlist; oversize or wrong-type is rejected with an inline error.
- Given an admin tries to save a post with an image attached and an empty `alt_text`, when they submit, then the form rejects with a required-field error.
- Given an admin uploads successfully, when the upload completes, then the file lives at `images/posts/{post_id}/{uuid}_{filename}` and an `images` row is inserted with `bucket_path`, `alt_text`, `parent_id`, `parent_type='posts'`.
- No aspect-ratio lock. No quota enforcement.

### 3.6 Orphan cleanup

Best-effort. A button on `/admin/images` that deletes `images` rows with both `parent_id` and `parent_type` NULL and `created_at` older than `ORPHAN_CLEANUP_THRESHOLD_DAYS` (7, in `lib/admin-images-cleanup.ts`), plus the corresponding Storage objects. The page previews each orphan with its Storage object size. Confirm modal. No automation, no scheduler.

### 3.7 Project & Post Reordering (`/admin/projects`, `/admin/posts`)

Manual drag-to-reorder for the project list and the post list. Sets the order both admin and public lists render in. Supersedes the reverse-chronological default in 2.3 and 2.4.

**Scope:** projects and posts. Stats and notes carry their own `sort_order` edited numerically in-row (3.4), not by drag. Media-row reorder inside a project (3.5) is unaffected.
**Mechanism:** drag a row in the admin list; release to set visual order; persistence on an explicit "Save order" action — not auto-save (mirrors 3.5).
**Persistence:** a per-row `sort_order` integer (migration 012); saved array position is the order (0-based, ascending), `created_at` DESC as the deterministic tiebreaker.
**Default order:** existing rows backfilled newest-first; a newly created project or post appends to the end via a BEFORE INSERT trigger until dragged.
**Desktop-only:** single operator; no touch-drag.

**G/W/T:**
- Given the admin loads `/admin/projects` or `/admin/posts`, when the page renders, then rows are listed in `sort_order` ascending, not reverse-chronological.
- Given the admin drags a row and drops it, when they release, then the visual order updates but is not yet persisted.
- Given the admin clicks "Save order", when it succeeds, then the new order persists, a success toast shows, and reloading the page preserves it.
- Given the admin reorders rows then navigates away without saving, when they return, then the previously saved order is shown.
- Given a visitor lands on `/projects` or `/writing`, when the page renders, then published rows appear in the admin-defined `sort_order`, not by date.
- Given a draft sits between two published rows in the admin order, when the public list renders, then only the published rows show, in their relative order.

**Out of scope:** cross-page reordering (admin lists paginate at 50; reorder operates within the loaded page); touch / mobile drag (admin is desktop-only); per-section "featured" flags or multiple orderings.
**Success metric:** the admin can set the public display order of projects and posts by dragging, and the public site renders that order.

---

### 3.8 Project Writeup Embedding

**Amended at T46.** A project may attach one existing writing post. The attachment mechanism, the schema and the admin UI are unchanged; **the render target changed.** T45 embedded the post body on `/projects/<slug>`. That route no longer exists (2.3a), so the attachment now drives a **Writeup** action on the project card that links to `/writing/<slug>` — the post's own page. Nothing is embedded, and there is no separate project-detail layout.

**Scope:** projects only, one attached post per project. The attached post is a normal post that also appears in `/writing` (reused, not project-only).
**Reference:** `projects.post_id` FK → `posts(id)`, nullable, `on delete set null` (migration 011). Distinct from `post_url` (the outbound link, which stays independent).
**Visibility:** only a currently `published` attached post produces a Writeup action; a draft, deleted or null `post_id` produces nothing.
**Resolution cost:** `/projects` loads the published-post list once and indexes it, so N projects still cost one posts query (`buildWriteupHrefs` in `app/projects/page.tsx`).

**G/W/T:**
- Given a project's `post_id` points to a published post, when a visitor views `/projects`, then that card shows a **Writeup** action linking to `/writing/<slug>`.
- Given the attached post is a draft, unpublished or missing, when the card renders, then no Writeup action shows — no error, no leak, no link to a 404.
- Given a project has no `post_id`, `live_url` or `github_url`, when the card renders, then `links coming soon` shows in place of the action row.
- Given the admin edits a project, when the form loads, then a "Linked writeup" dropdown lists published posts plus an "Unset" option and saves to `post_id`.
- Given a project has both `post_id` and `post_url`, when the card renders, then the Writeup action uses the linked post and `post_url` remains an independent outbound link.

**Out of scope:** multiple posts per project; project-only posts hidden from `/writing`; embedding post bodies anywhere on `/projects`.
**Success metric:** a project that has a writeup gives the reader a route to real long-form content rather than a duplicate of the card.

---

## 4. OpenClaw Write Path

OpenClaw is an external Telegram agent that writes hobby stats. It is the only programmatic writer to the database.

**Write target:** `stats` table only. No SELECT, UPDATE, DELETE. No access to any other table — notably **not** `notes`, which is admin-only (CONSTRAINT-04, migration 014).
**Mechanism:** Supabase Edge Function `stats-ingest` (`supabase/functions/stats-ingest/`). Validates a shared secret in the request header using a constant-time comparison. On success, INSERTs via service role. On failure, returns 401. Secret lifecycle and rotation: `docs/openclaw-config.md`.
**Why an Edge Function and not a publishable key:** see [`founder-brief.md`](founder-brief.md) entry "OpenClaw access" (resolves ASSUMPTION-06).

**PRD-level acceptance:**
- Valid secret + valid payload → 201, row inserted.
- Missing or wrong secret → 401, no row inserted, no detail leaked in the response body.
- Malformed payload → 400 with a generic field-level message.
- Constant-time comparison is required (timing attack mitigation).
- Stats are append-only on this path. Duplicate inserts are allowed; corrections happen in admin (3.4).

---

## 5. Data Model (Preview)

Full schema with column types, constraints and indexes is in [`architecture.md`](architecture.md). Preview only here. Migrations `001`–`016` live in `supabase/migrations/`.

| Table | Purpose | Notes |
|---|---|---|
| `projects` | Public project entries | `status` enum, slug locked after publish. `subtitle` + `tags` added at T46 (013). `image_id` / `image_after_id` deprecated as the primary read path; reads fall back to them only when a project has no `project_media` rows. `progress_percent` and `thumb_kind` are retained but no longer rendered publicly. |
| `project_media` | Project card carousel rows | Ordered media per project. Each row references one image (single) or two (before/after pair). Optional plain-text caption. Hard cap 20 rows per project (trigger). Added by T43 (010). |
| `posts` | Writing entries | `content` is raw Markdown; rendered client-side. `sort_order` (012). |
| `stats` | Hobby data points | OpenClaw writes via Edge Function; admin may edit or delete. `aside` + `sort_order` added at T46 (014, 016). |
| `notes` | Text tiles on `/other` | `kicker` + `line` + `sort_order`. Admin-only writes, public SELECT. Added at T46 (014, 016). |
| `images` | Image metadata + Storage path | `alt_text` NOT NULL; FK to parent project or post. |

Storage bucket `images/` holds the raw files, capped at 2 MB per object and restricted to `image/jpeg`, `image/png`, `image/webp` (008). Path scheme: `images/{projects|posts}/{parent_id}/{uuid}_{filename}`.

---

## 6. Non-Functional Requirements

### 6.1 Voice

Dry, self-deprecating, anti-LinkedIn. Applies to public site copy AND admin labels. Binding detail: CONSTRAINT-13.
**Forbidden:** superlatives, SaaS phrases ("AI-powered", "next-gen", "seamless", "powerful"), LinkedIn-motivational tone, emoji.
**Allowed in admin:** typographic symbols (※, ¶, *, →, ↗) only when needed.

### 6.2 Security (high-level — full threat model in `architecture.md`)

- Default-deny RLS on every table. Explicit policies grant access.
- Single auth principal. No multi-user, no roles to administrate. The `/admin` gate verifies the JWT server-side via `getUser()`.
- All Markdown sanitized client-side via the DOMPurify whitelist before render.
- All file uploads validated for type and size at the app boundary and again at the bucket.
- No secrets in source. `.env.example` lists names only.
- No PII in logs (email is masked or replaced with a presence flag).

### 6.3 Performance

- Public pages render under 2s on first paint over a typical home connection.
- Zero third-party runtime JS on the public site; `marked` + DOMPurify load only on `/writing/[slug]`. Fonts are self-hosted by `next/font`, so there is no render-blocking third-party request.
- Vercel CDN caches static assets aggressively (1 year). Public pages are `force-dynamic` and are not HTML-cached.
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

> The `.bundled.html` bullet was **superseded at T46**: the current design source *is* a bundled export (`docs/design-source/redesign-2026-08/swarnim-bagre-site.bundled.html`), read via its unpacked `template.extracted.html`. See `CLAUDE.md` → Out of Scope.

### 7.2 Added at T43 (project media)

- Video clips and animated GIFs as distinct content types. (A GIF uploaded as an image renders as a static image; no animated-image handling, no `<video>` element.)
- Lightbox / full-screen zoom on image click.
- Auto-advance / auto-play on the carousel.
- Image editing in admin (cropping, filtering, rotation, etc.).
- Caption markdown / hyperlinks (captions are plain text only).
- Multi-image cards on the home page. *(T46 note: Home no longer lists projects at all, so this is moot.)*

### 7.3 Added at T46 (redesign)

- A real chat backend on the home page. The chat is deliberately fake — canned rotating deflections, no model — and the copy says so.
- A project detail page. `/projects/[slug]` was deleted; `/writing/[slug]` is the only detail route.
- A mobile component fork or server-side device split. One responsive tree, one 640px breakpoint.
- A site footer, a blinking cursor, and the S49 SVG thumbnail motif set.

---

## 8. Open Questions, Resolved

The kickoff brief left a small set of questions open. Resolutions below are current, not historical.

| Question | Resolution |
|---|---|
| Auth flow | Magic link, Supabase Auth defaults (1hr JWT, 30-day refresh). Lockout fallback is a service-role mint — `auth-flow.md` §5. |
| Image policy | Projects use the multi-image card frame via `project_media` (soft warn at 11 rows / hard cap 20). Posts keep a single image. `alt_text` required per image. **2 MB** cap per file, JPEG/PNG/WebP only. No aspect lock. |
| Slug behavior | Auto-from-title. Editable while draft. Locked at DB level on publish. |
| Session expiry | Supabase Auth defaults. No custom timeout. |
| Storage cleanup | Best-effort. Admin button on `/admin/images`. 7-day age threshold. No quota enforcement. |
| Stats correction UX | Edit in place, or delete and re-insert. No audit trail. |
| Tweaks panel in production | Never shipped; no implementation exists (§2.6). |
| OpenClaw access | Edge Function `stats-ingest` with shared-secret header (Option A from ASSUMPTION-06). |

---

## 9. Phase 2 Architectural Decisions (locked)

These are locked at architecture-level. Each has a Founder Brief in [`founder-brief.md`](founder-brief.md):

1. **Stack:** Next.js 15 App Router from day one. Phase A static-bundle deploy is skipped.
2. **Stats schema (resolves ASSUMPTION-01):** single typed table with `category`, `label`, `value`, `unit` text columns. Append-only on the ingest path.
3. **Tailwind scoping (resolves ASSUMPTION-04):** `tailwindcss-scoped-preflight` plugin. Tailwind only under `app/(admin)/`. The public site never sees Tailwind.
4. **OpenClaw access (resolves ASSUMPTION-06):** Edge Function with shared-secret header.
5. **Image data layer:** Storage bucket + `images` table with required `alt_text` and parent FK. Best-effort orphan cleanup.
6. **Markdown renderer:** `marked` + DOMPurify with locked whitelist (`p, ul, ol, li, blockquote, code, pre, em, strong, a[href], h1-h4, img[src,alt]`).

Full detail and trade-offs: [`architecture.md`](architecture.md), [`founder-brief.md`](founder-brief.md), and [`constraints.md`](constraints.md).

---

## 10. Build Plan

The plan lives in [`plan-index.md`](plan-index.md), split across four phase files:

- `plan-phase-1-foundation.md` — Foundation (T1–T14)
- `plan-phase-2-admin.md` — Admin panel (T15–T28)
- `plan-phase-3-ingestion.md` — OpenClaw ingestion (T29–T31)
- `plan-phase-4-launch.md` — Polish + launch (T32 onward, including T41 discoverability, T43 project media, T44 reordering, T45 writeup linking and T46 the redesign)
