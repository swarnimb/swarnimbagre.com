# Architecture: swarnimbagre.com

**Date:** 2026-05-06
**Last revised:** 2026-08-07 (drift sweep — T41 discoverability surfaces documented)
**Status:** Locked. Six architectural decisions captured below; each has a Founder Brief in [`founder-brief.md`](founder-brief.md). Binding constraints derived from these decisions are in [`constraints.md`](constraints.md).

This document describes how the system is built. `constraints.md` is the authoritative statement of the binding rules; where a rule lives there, this document cross-references the `CONSTRAINT-NN` id rather than restating it.

> **T46 re-baseline (2026-08-04).** The public site was rebuilt against a new design export. The mobile component fork, the device-variant middleware header, the `/projects/[slug]` route and the `embla-carousel-react` dependency were all removed; design Overrides 1, 2 and 3 are retired. See CONSTRAINT-05 and `design-decisions.md`.

This document cannot change without a corresponding update to [`founder-brief.md`](founder-brief.md).

---

## 1. Tech Stack

### 1.1 Hosting and runtime

- **Web framework:** Next.js 15 (App Router) — App Router only, no Pages Router.
- **Language:** TypeScript.
- **Hosting:** Vercel — single project, GitHub-driven deploys.
- **Database / Auth / Storage / Edge Functions:** Supabase — single free-tier project.
- **CDN:** Vercel default.

### 1.2 Frontend libraries

- **Public site:** raw React with custom components under `components/public/`. Styling is exclusively the token layer in `app/styles/colors_and_type.css` plus the component sheets `app/styles/public.css`, `public-home.css`, `public-projects.css`, `public-writing.css` and `public-other.css`. No Tailwind, no component library, **zero runtime JS dependencies**. The project media carousel is hand-rolled in `ProjectFrame.tsx` (§4.9); its admin save path uses a Postgres RPC (`save_project_media`, migration `010a`) for atomic delete-then-insert (§6.6.9).
- **Public fonts:** Instrument Serif (display), Space Grotesk (body and UI), Space Mono (kickers, dates, tile labels). Loaded through `next/font/google` in `app/layout.tsx`, which self-hosts the files at build time, so there is no runtime request to Google and no render-blocking `@import`. See §4.10 for the `<html>`-vs-`<body>` placement rule, which is load-bearing.
- **Admin panel:** shadcn/ui + Tailwind CSS, scoped to `/admin/*` only.
- **Markdown renderer:** `marked` + DOMPurify (§7).
- **Component testing:** `@testing-library/react` ^16.1.0 + `@testing-library/jest-dom` ^6.6.3 (required for React 19 / Next 15 compatibility).

### 1.3 Why Next.js from day one (Decision 1)

A static React-via-CDN deploy with Next.js migration deferred was evaluated and dropped: it adds setup work and an unrelated routing model that gets thrown away once the admin panel arrives. Going Next.js from day one removes the throwaway work, at the cost of a slower Phase 1 and a one-time port of the design bundle into Next.js components.

**Founder Brief:** "Stack" entry in [`founder-brief.md`](founder-brief.md).

---

## 2. Data Model

Six tables: `projects`, `posts`, `stats`, `images`, `project_media`, `notes`. RLS default-deny on every one. Migrations live in `supabase/migrations/` with sequential numbering.

**Applied ledger.** The Supabase migration ledger on the production project records eleven entries: `007`, `009`, `010`, `010a`, `011`, `012`, `012a`, `013`, `014`, `015`, `016`. Files `001` through `006` and `008` exist in the repo but are not in the ledger (they were applied before ledger tracking began). All eighteen migration files in the repo are applied to production.

### 2.1 `projects`

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `title` | `text` | NOT NULL, length ≤ 200 |
| `slug` | `text` | NOT NULL, UNIQUE |
| `description` | `text` | NOT NULL |
| `status` | `project_status` enum | NOT NULL, default `'draft'`. Values: `'draft'`, `'published'` |
| `image_id` | `uuid` | NULL, FK → `images.id` ON DELETE SET NULL |
| `github_url` | `text` | NULL — public-card `{ } code` button source (migration 009) |
| `live_url` | `text` | NULL — public-card `↗ site` button source (migration 009) |
| `post_url` | `text` | NULL — public-card `¶ notes` button source (migration 009). Not rendered by the T46 card |
| `progress_percent` | `integer` | NULL, CHECK `(progress_percent between 0 and 100)` — drives the ProgressRing; null → ring not rendered (migration 009) |
| `thumb_kind` | `text` | NULL. **Dead.** Originally selected an SVG motif from `lib/thumb-kinds.ts` (migration 009); the T46 card renders photographic media only and nothing reads the column. Retained rather than dropped so historical values survive. Still carried in the `PROJECT_COLUMNS` projection and typed `string \| null` on `Project` |
| `image_after_id` | `uuid` | NULL, FK → `images.id` ON DELETE SET NULL — "after" image for the BeforeAfterMedia slider; when null, the card renders a single `<img>` from `image_id` (migration 009) |
| `post_id` | `uuid` | NULL, FK → `posts.id` ON DELETE SET NULL — links a project to a published post; independent of `post_url` (migration 011) |
| `sort_order` | `integer` | NOT NULL, CHECK `projects_sort_order_nonneg` `(sort_order >= 0)` — explicit admin-controlled manual order, independent of `created_at`. Backfilled newest-first on apply so the public listing did not reshuffle on deploy. A `BEFORE INSERT` trigger appends new rows to the end (`max(sort_order)+1`) when no explicit value is supplied (migration 012) |
| `subtitle` | `text` | NULL, CHECK `subtitle is null or length(btrim(subtitle)) between 1 and 120`. One short line under the card title. Capped so it cannot quietly become a second description and blow out the card layout (migration 013) |
| `tags` | `text[]` | NULL, CHECK `projects_tags_shape`: 1 to 8 elements, no NULL element, no empty-string element, joined length ≤ 200. Rendered as the card's tag pills. Null or empty renders no tag row (migration 013) |
| `created_at` | `timestamptz` | NOT NULL, default `now()` |
| `updated_at` | `timestamptz` | NOT NULL, default `now()`, trigger on update |

**Indexes:** `(status, created_at DESC)` from migration 001; `(status, sort_order)` added in migration 012 to serve the manual-order public listing. UNIQUE on `slug`.

**Slug-lock trigger:** a BEFORE UPDATE trigger raises an exception if `slug` changes while `status='published'` (DB-level enforcement of the slug-lock-after-publish rule, migration 006).

**RLS is row-level, not column-level.** `projects_public_select` (anon, FOR SELECT, USING `status = 'published'`) and `projects_admin_all` (authenticated, FOR ALL) from migration 002 cover every column, including ones added later. Column-adding migrations therefore need no new policies.

**Tag CHECK constraint idiom (migration 013).** The tag guards use array operators only (`array_length`, `cardinality`/`array_remove`, `@>`, `array_to_string`), never a per-element predicate — Postgres forbids subqueries inside CHECK, so "for every element, …" cannot be expressed there. The NULL-element guard compares `cardinality(tags)` against `cardinality(array_remove(tags, null))` rather than `array_position`, whose NULL-search semantics are easy to get subtly wrong; the joined-length ceiling is a coarse stand-in for the per-element size check that cannot be written. The one case the DB cannot catch is a whitespace-only tag, caught a layer up by the zod schema, which trims before validating.

**`post_id` resolution (Writeup action).** There is no project detail page. `app/projects/page.tsx` loads the published post list once alongside the projects, indexes it by id, and maps `post_id` to a slug in one pass, resolving a card's "Writeup" action to `/writing/<slug>` — one extra query regardless of how many projects link a writeup. A project whose linked post is no longer published falls out of the map and its card renders without a Writeup action rather than linking to a 404. No new RLS policy: the row-level `projects_*` policies cover the column, and only published posts enter the map. Historical rationale for the retired Overrides 1 and 3: `founder-brief.md` decisions #28 and #32.

**Admin manual reorder.** `sort_order` backs admin drag-reorder for both `projects` and `posts`. Persistence goes through a `SECURITY INVOKER` RPC (`save_project_order` / `save_post_order`, migration 012a) that takes an ordered array of ids and writes 0-based positions back into `sort_order` in one transaction; callers supply display order only, never `sort_order` itself. Writes are gated by the existing `*_admin_all` (authenticated) policies — no new RLS. A reorder is a plain UPDATE, so the migration 001 `set_updated_at` trigger bumps `updated_at`. Server Actions: `saveProjectOrder` / `savePostOrder`. See `founder-brief.md` decision #33.

### 2.2 `posts`

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `title` | `text` | NOT NULL, length ≤ 200 |
| `slug` | `text` | NOT NULL, UNIQUE |
| `content` | `text` | NOT NULL — raw Markdown |
| `status` | `post_status` enum | NOT NULL, default `'draft'`. Values: `'draft'`, `'published'` |
| `image_id` | `uuid` | NULL, FK → `images.id` ON DELETE SET NULL |
| `sort_order` | `integer` | NOT NULL, CHECK `posts_sort_order_nonneg` `(sort_order >= 0)` — admin-controlled manual order; same backfill + append-on-insert trigger semantics as `projects.sort_order` (migration 012) |
| `created_at` | `timestamptz` | NOT NULL, default `now()` |
| `updated_at` | `timestamptz` | NOT NULL, default `now()`, trigger on update |

**Indexes:** `(status, created_at DESC)` from migration 001; `(status, sort_order)` added in migration 012. UNIQUE on `slug`. Same slug-lock trigger as `projects`. Manual reorder via `save_post_order` (migration 012a) — see the "Admin manual reorder" note under `projects`.

### 2.3 `stats`

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `category` | `text` | NOT NULL |
| `label` | `text` | NOT NULL |
| `value` | `text` | NOT NULL |
| `unit` | `text` | NULL (not every stat has a unit) |
| `aside` | `text` | NULL, CHECK `stats_aside_length` `aside is null or length(btrim(aside)) between 1 and 160`. The small italic line under the tile label. Optional, and capped so it stays a quip rather than a paragraph (migration 014) |
| `sort_order` | `integer` | NOT NULL, CHECK `stats_sort_order_non_negative` `(sort_order >= 0)`. **No column default** — dropped in migration 016; a `BEFORE INSERT` trigger appends new rows to the end (see below) |
| `created_at` | `timestamptz` | NOT NULL, default `now()` |

**Indexes:** `(category, created_at DESC)` from migration 001; `stats_sort_order_idx` on `(sort_order, created_at DESC)` added in migration 014 to serve the ordered public read. Append-only for every role except `authenticated` (the admin): no anon UPDATE or DELETE policy.

**Read ordering.** `getOrderedStats()` in `lib/db.ts` returns a flat `Stat[]` ordered by `sort_order` ASC with `created_at` DESC as a deterministic tiebreaker. The Other page is a fixed tile grid in a deliberate sequence; grouping by `category` — an open-ended string OpenClaw writes — could not express "these four tiles, in this order". `category` remains a column and still absorbs new stat kinds without a migration; it just does not drive display grouping.

**Append-on-insert `sort_order` (migration 016).** `stats.sort_order` and `notes.sort_order` follow the migration-012 convention: no column default, plus a `SECURITY INVOKER` `BEFORE INSERT` trigger (`stats_set_sort_order_default` / `notes_set_sort_order_default`, `SET search_path = ''`) that fires only when `new.sort_order IS NULL` and sets `coalesce((select max(sort_order) + 1 from public.<table>), 0)`. The columns stay `NOT NULL`; the trigger populates the value before the constraint is checked.

**Dropping the column default is the load-bearing half, not housekeeping.** A column DEFAULT is applied *before* `BEFORE INSERT` triggers run, so a 012-style trigger layered on top of a surviving `default 0` would never see a NULL and would be dead code. (Migration 014 had shipped both columns as `not null default 0`; every insert that did not name a position landed at 0, all rows tied, and display order collapsed onto the `created_at DESC` tiebreaker.)

**Deploy order (DB first).** Migration 016 had to be applied ahead of the application change. The then-deployed admin code always sent a concrete `sort_order`, which the trigger leaves untouched; shipping the app first — omitting the key so the trigger could compute it — would have sent NULL into a still-`NOT NULL` column with no trigger behind it. Any future "let the database compute this" change inherits the same ordering rule.

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

**Storage bucket path scheme:** `images/{projects|posts}/{parent_id}/{uuid}_{filename}`. The 2 MB size cap and the JPEG/PNG/WebP MIME allowlist are enforced at three layers: client-side at upload, the `lib/admin-images-mutations-types.ts` constants (`MAX_FILE_BYTES`, `ALLOWED_MIME_TYPES`), and the bucket itself. `supabase/migrations/008_storage_images_limits.sql` (F-30) is the source of truth for the bucket-level limits and supersedes the "configured by hand in the Supabase Dashboard" note at the tail of migration 005, which was left unedited because applied migrations are immutable. **Founder Brief:** "Image data layer", "Image-bucket limits codified in migration 008".

**Orphan cleanup (T27):** an `images` row is "orphaned" when both `parent_id IS NULL` and `parent_type IS NULL`. The admin "Clean orphans" button at `/admin/images` deletes orphans where `created_at < now() - interval '7 days'` from both the table and the Storage bucket. The grace period is a named constant, `ORPHAN_CLEANUP_THRESHOLD_DAYS = 7` in `lib/admin-images-cleanup.ts` (CQ-04). Order is **DB-first then Storage-remove**, inverted from the upload-side compensating-delete invariant, because the failure-mode trade-off differs: a failed Storage remove leaves a true orphan object whose row pointer is already gone (acceptable, loud-logged with bucket paths for human reconciliation), whereas a failed DB delete after the object is gone would leave a row pointing at nothing. Re-running the sweep is idempotent on the storage side because the rows no longer exist to be re-listed.

**Storage-layer RLS (migration 007).** `storage.objects` carries its own RLS layer separate from the `public.images` table; migration 007 installs `images_storage_admin_all` (FOR ALL on `authenticated`, USING and WITH CHECK both `bucket_id = 'images'`). This is the Storage analogue of the per-table `*_admin_all` policies and must accompany every Supabase Storage bucket in use — see CONSTRAINT-20.

**Diagnostic anchor:** the Supabase JS SDK strips the `for table "X"` suffix from RLS error messages, so a `storage.objects` denial surfaces as `'new row violates row-level security policy'`, indistinguishable from a `public.{table}` denial. When debugging, read raw Postgres logs via the Supabase MCP `mcp__supabase__get_logs` (which preserves the `for table "objects"` clause) or query `pg_policies` directly to confirm which layer is denying.

### 2.5 `project_media`

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `project_id` | `uuid` | NOT NULL, FK → `projects.id` ON DELETE CASCADE |
| `image_id` | `uuid` | NOT NULL, FK → `images.id` ON DELETE RESTRICT — the primary image when `image_after_id` is NULL, or the "before" image when `image_after_id` is non-NULL |
| `image_after_id` | `uuid` | NULL, FK → `images.id` ON DELETE RESTRICT — when non-NULL, this row is a before/after pair; when NULL, the row is a single image |
| `caption` | `text` | NULL, CHECK `caption is null or char_length(caption) <= 280`. **Retained but dead as of 2026-08-07.** The column still exists; nothing projects, validates, collects or renders it. The app-side caption path (admin input, zod schema, the 140/280 thresholds, form state, both column projections, the public/admin types, the `ProjectFrame` slide model) was removed and **no migration was run**. The `010a` `save_project_media` RPC still INSERTs into `caption` and now writes NULL on every save. **Any future migration that drops this column MUST replace `save_project_media` in the same migration** — a bare `drop column caption` leaves the RPC INSERTing into a column that no longer exists and every media save fails at runtime. |
| `order_index` | `integer` | NOT NULL, CHECK `order_index >= 0` — derived by the `save_project_media` RPC from array position via `WITH ORDINALITY`, not trusted from the client |
| `created_at` | `timestamptz` | NOT NULL, default `now()` |

**Shape discriminator.** `project_media` carries no explicit `kind` enum column. A row is a "single" when `image_after_id IS NULL` and a "pair" when it is non-NULL; the render path branches on that nullability. Keeping the discriminator implicit in FK nullability avoids a redundant column that could disagree with FK presence, and removes the need for a synchronizing CHECK constraint. `toSlides()` in `components/public/ProjectFrame.tsx` flattens each row into one slide, or two when `imageAfterUrl` is present — a pair is presented as two sequential slides, not a draggable slider.

**Image FK delete semantics.** Both `image_id` and `image_after_id` use `ON DELETE RESTRICT` — deleting an `images` row still referenced by any `project_media` row raises an error. This is the inverse of the legacy `projects.image_id` / `projects.image_after_id` columns (migrations 001 + 009), which use `ON DELETE SET NULL`. The RESTRICT posture makes media-row removal explicit: the admin must delete the `project_media` row first, which releases the FK and lets the image be cleaned. This protects published carousel slides from silent breakage during orphan cleanup at `/admin/images`.

**Indexes:** compound `(project_id, order_index)` for the ordered public-listing query (`project_media_project_order_idx`). No unique constraint on `(project_id, order_index)` — ordering is rebuilt atomically by the `save_project_media` RPC each save, not maintained incrementally.

**Row-cap trigger (`project_media_rowcap_trigger`):** fires `BEFORE INSERT OR UPDATE OF project_id` and raises when the existing row count for the same `project_id` is `>= 20`. Firing on `UPDATE OF project_id` as well as INSERT closes the move-row-between-projects bypass. PostgreSQL CHECK constraints are per-row, not per-FK-count, so the trigger is the canonical guard; the zod schema in `lib/admin-project-media-mutations-schemas.ts` enforces the same `<=20` cap as a layer above it.

**Pair distinctness:** CHECK constraint `project_media_before_after_distinct` — `image_after_id is null or image_after_id <> image_id`. A pair's before and after must be different images; a single is unconstrained by definition.

**RLS (migration 010).** `project_media_admin_all` (authenticated, FOR ALL, USING + WITH CHECK both `true`) and `project_media_public_select` (anon, FOR SELECT, USING `exists (select 1 from public.projects p where p.id = public.project_media.project_id and p.status = 'published')`). The public-read policy re-resolves the parent's published status at query time, so a forged `project_id` cannot read an unpublished project's media via the anon role.

**Atomic save surface.** Writes go through the Server Action `saveProjectMedia(projectId, mediaRows[])` — one Server Action, atomic, via the `save_project_media(uuid, jsonb)` RPC in migration `010a`. The RPC does delete-then-insert-all inside a single Postgres transaction; see §6.6.9 for the conventions it established. **The RPC body still names `caption` in its INSERT column list** even though the app no longer sends the field — dropping the column without replacing the function in the same migration breaks every media save (see the `caption` row above).

**Storage bucket.** Reuses the existing `images` bucket per §2.4. No new bucket, no new `storage.objects` policy — CONSTRAINT-20 is N/A for migrations 010 / 010a.

**Public render surface.** The carousel that renders these rows is §4.9. The schema is content-model; the carousel is the visual surface.

**Founder Brief:** entries 30 (atomic save, RPC pattern) and 34 (T46 redesign). Entries 29 and 31 record the retired embla decision and are historical.

### 2.6 `notes`

Added by migration `014_other_page_model.sql`. Backs the three text tiles on the Other page ("currently watching / reading / goal").

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `kicker` | `text` | NOT NULL, CHECK `notes_kicker_shape` `length(btrim(kicker)) between 1 and 40`. The small label above the line |
| `line` | `text` | NOT NULL, CHECK `notes_line_shape` `length(btrim(line)) between 1 and 120`. The tile's one sentence |
| `sort_order` | `integer` | NOT NULL, CHECK `notes_sort_order_non_negative` `(sort_order >= 0)`. **No column default** — dropped in migration 016; a `BEFORE INSERT` trigger appends new rows to the end (see §2.3) |
| `created_at` | `timestamptz` | NOT NULL, default `now()` |
| `updated_at` | `timestamptz` | NOT NULL, default `now()`, trigger on update |

**Indexes:** `notes_sort_order_idx` on `(sort_order, created_at DESC)`, mirroring `stats_sort_order_idx`.

**Triggers:** `notes_set_updated_at` (BEFORE UPDATE, per row) reuses the shared `public.set_updated_at()` function from migration 001 — no new function was written. `notes_set_sort_order_default` (BEFORE INSERT, per row, migration 016) is the append-on-insert trigger described in §2.3.

**RLS (migration 014).** `notes_public_select` (anon, FOR SELECT, USING `true`) and `notes_admin_all` (authenticated, FOR ALL, USING + WITH CHECK both `true`). Every note is public the moment it is written; there is no draft state, matching `stats` rather than `projects` / `posts`. `service_role` is deliberately not granted a policy: it bypasses RLS by definition, so adding one would be redundant and a footgun. RLS for `notes` is bundled into the same file as the table definition, following the migration 010 convention rather than the 002–005 split-file one.

**Not reachable by OpenClaw.** The `stats-ingest` Edge Function writes `stats` only. `notes` is admin-authored through the panel, keeping CONSTRAINT-04's programmatic write surface as narrow as it was before the table existed.

**Why a separate table and not more `stats` rows.** A note has no number, no unit and no category, so folding it into `stats` would mean three NULL columns per row plus an implicit convention distinguishing "stat with a null value" from a real stat. A four-column table is cheaper than that convention and cannot be misread.

**Read path.** `getNotes()` in `lib/db.ts` returns an ordered `Note[]` using the same contract as `getOrderedStats`: `sort_order` ASC, `created_at` DESC as tiebreaker. `app/other/page.tsx` loads stats and notes in parallel, each behind its own `safeLoad` call, so one failing query degrades half the grid instead of blanking the page. Admin CRUD follows the established per-resource split: `lib/admin-queries-notes.ts` plus the `lib/admin-notes-mutations-{types,internal,schemas,}.ts` family (§6.6.6, §6.6.8).

---

## 3. API Structure

### 3.1 Public reads — PostgREST via `@supabase/ssr`

Public pages query Supabase from Server Components using the anon role. All reads are RLS-filtered — no app-level filtering, the database returns only what is visible.

Read functions live in `lib/db.ts` (projects, stats, notes, images, project media) and `lib/db-posts.ts` (posts, re-exported through `lib/db.ts` so callers have one import path); `lib/db-internal.ts` holds the shared client + error-logging helpers both import, avoiding a circular import.

```ts
// lib/db.ts
export async function getPublishedProjects(client?: SupabaseClient): Promise<Project[]> {
  const operation = 'getPublishedProjects';
  const supabase = client ?? (await createServerClient());
  const { data, error } = await supabase
    .from('projects')
    .select(PROJECT_COLUMNS)
    .eq('status', PUBLISHED)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) {
    logDbError(operation, error);
    throw new ServiceError(`${operation} failed`, { cause: error, operation });
  }
  return (data ?? []) as unknown as Project[];
}
```

All queries go through Supabase's query builder — never raw SQL string concatenation (SEC-03).

**Column projections are a runtime contract the type system cannot check.** Each read module holds a named projection const (`PROJECT_COLUMNS`, `STAT_COLUMNS`, `NOTE_COLUMNS`, `IMAGE_COLUMNS`, `PROJECT_MEDIA_COLUMNS`). Adding a column to the `Project` type does *not* add it to the SELECT; T45's Writeup feature shipped inert in production for exactly this reason. Any migration that adds a column a page reads must also extend the projection.

**Derived post fields.** `lib/post-summary.ts` exports two pure helpers, `formatPostDate(createdAt)` and `excerptFromContent(content, maxChars = 180)`. The writing list's date string and excerpt are derived at render time from the `created_at` and `content` columns rather than stored as `published_on` / `excerpt` columns: the derivation is cheap, has no second source of truth to drift from, and needs no admin field or migration. If either ever needs to be authored by hand, that is the point to add a column.

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

**Rate-limit prep:** the Edge Function includes a placeholder check using Supabase's invocation count or a simple in-memory token bucket keyed by source IP. Not enforced at launch; the hook is wired so enforcement can be added without redeploying app code.

**Why Edge Function and not direct PostgREST with a publishable key:** the publishable key is public by design — anyone with it could INSERT. The Edge Function pattern restricts writes to OpenClaw specifically, because OpenClaw is the only party with the shared secret. **Founder Brief:** "OpenClaw access".

---

## 4. Component Architecture

### 4.1 Repo layout (confirmed)

All admin routes are nested under `/admin/*`. Login lives at `/admin/login`, the dashboard at `/admin`, and the magic-link callback at `/admin/auth/callback`. Middleware matcher is `['/admin/:path*']`. See CONSTRAINT-17.

```
swarnimbagre.com/
├── app/
│   ├── layout.tsx                    # root layout: next/font on <html>, public CSS, site-wide metadata
│   ├── page.tsx                      # Home
│   ├── projects/page.tsx             # no [slug] route — deleted at T46
│   ├── writing/page.tsx
│   ├── writing/[slug]/page.tsx       # per-post metadata + OG override
│   ├── other/page.tsx
│   ├── error.tsx                     # public error boundary (T41) — §4.4
│   ├── not-found.tsx                 # public 404 (T41) — §4.4
│   ├── robots.ts                     # /robots.txt (T41) — §4.10
│   ├── sitemap.ts                    # /sitemap.xml (T41), DB-reading — §4.10, §6.2
│   ├── icon.svg                      # favicon, file convention (T41)
│   ├── opengraph-image.tsx           # /opengraph-image, Satori-rendered OG card (T41)
│   ├── api/test/sign-in/route.ts     # dev-only, triple-gated — §4.7
│   ├── styles/                       # CSS files for the public site + admin
│   │   ├── colors_and_type.css       # public design tokens, imported by root layout
│   │   ├── base.css                  # public site base, imported by root layout
│   │   ├── public.css                # shared public shell
│   │   ├── public-home.css           # per-page sheets, each with its own 640px block
│   │   ├── public-projects.css
│   │   ├── public-writing.css
│   │   ├── public-other.css
│   │   └── admin.css                 # Tailwind + scoped-preflight, imported only by admin layout
│   └── (admin)/                      # route group — admin layout owns Tailwind import
│       ├── layout.tsx                # admin-only Tailwind/shadcn CSS, Inter font
│       ├── error.tsx                 # admin segment error boundary — §4.4
│       └── admin/                    # all admin URLs live under /admin/*
│           ├── page.tsx              # /admin — dashboard
│           ├── login/page.tsx        # /admin/login
│           ├── auth/callback/route.ts # /admin/auth/callback — magic-link callback
│           ├── projects/{page,new/page,[id]/page}.tsx
│           ├── posts/{page,new/page,[id]/page}.tsx
│           ├── stats/page.tsx
│           ├── notes/page.tsx
│           └── images/page.tsx
├── components/
│   ├── public/                       # one responsive tree, no mobile/ fork
│   │   ├── SiteHeader.tsx
│   │   ├── ProjectCard.tsx
│   │   ├── ProjectFrame.tsx          # hand-rolled carousel
│   │   ├── MarkdownContent.tsx
│   │   ├── home/SocialIcons.tsx
│   │   └── pages/{Home,Projects,Writing,Other}.tsx
│   ├── admin/                        # shadcn-based admin components
│   └── ui/                           # shadcn primitives (generated)
├── lib/
│   ├── supabase.ts                   # client factories (server, browser)
│   ├── db.ts                         # public reads; re-exports the post reads
│   ├── db-posts.ts                   # public post reads
│   ├── db-internal.ts                # shared client/logging helpers (breaks the db ↔ db-posts cycle)
│   ├── public-projects.ts            # loadPublicProjects — render-ready project shape (§4.6)
│   ├── public-project-media.ts       # media resolution for the carousel
│   ├── post-summary.ts               # formatPostDate + excerptFromContent
│   ├── safe-load.ts                  # UI-boundary wrapper (§4.4, CONSTRAINT-14)
│   ├── admin-queries.ts              # admin reads — thin barrel re-exporting the per-resource modules (§6.6.8)
│   ├── admin-queries-{projects,posts,stats,notes,project-media}.ts
│   ├── admin-{projects,posts,stats,notes,images,project-media,reorder}-mutations.ts  # 'use server' wrappers (§6.6.6)
│   ├── admin-*-mutations-internal.ts # throwing helpers (no 'use server')
│   ├── admin-*-mutations-types.ts    # client-safe envelopes
│   ├── admin-*-mutations-schemas.ts  # zod schemas (projects, stats, notes, project-media, reorder)
│   ├── admin-projects-mutations-formdata.ts  # FormData readers (projects only)
│   ├── markdown.ts                   # marked + DOMPurify whitelist
│   ├── auth.ts                       # Server Action entry points (`signInWithMagicLink`, `signOut`)
│   ├── auth-internal.ts              # non-'use server' helpers (throwing, timing-sensitive)
│   ├── session.ts                    # assertAdminSession — no directive, deliberately (§6.6.10)
│   ├── env.ts                        # assertRequiredEnv, called from next.config.ts
│   └── images.ts                     # Storage URL helpers
├── scripts/
│   ├── seed-test-fixture.ts          # idempotent Playwright fixture user (§4.8)
│   └── recover-admin-session.ts      # service-role account recovery (auth-flow.md §5.4)
├── supabase/
│   ├── migrations/                   # SQL migrations, sequentially numbered
│   └── functions/
│       └── stats-ingest/index.ts     # Edge Function
├── middleware.ts                     # Next.js middleware: admin auth gate only
└── public/                           # static assets
```

### 4.2 Tailwind scoping (Decision 3 — resolves ASSUMPTION-04)

Tailwind is imported in exactly one place: `app/styles/admin.css`, which is in turn imported only by `app/(admin)/layout.tsx`. The plugin `tailwindcss-scoped-preflight` wraps Tailwind's Preflight reset under the `.admin-root` selector. Every admin page renders inside `<div className="admin-root">...</div>`.

The Tailwind config's `content` glob includes only `./app/(admin)/**/*`, `./components/admin/**/*` and `./components/ui/**/*`. Public components are excluded, so the public bundle never sees a Tailwind utility class and the Preflight reset never reaches public route HTML.

**Color token namespacing.** Admin uses an eight-token namespaced palette: 4 brand tokens (`--admin-bg` #1C1712, `--admin-surface` #252018, `--admin-fg` #E8E0D0, `--admin-accent` #C9A84C) and 4 semantic tokens (`--admin-destructive` #B85C3C, `--admin-destructive-fg` #F5E8D8, `--admin-border` #3A3328, `--admin-muted-fg` #7A7060). Three of the semantic hexes originally *sourced* their value from the public palette's `--danger` / `--hairline` / `--fg-muted`; since T46 inverted the public palette to light they no longer match it and **must not be resynced** — they are admin-owned constants. The `--admin-*` prefix prevents cascade collisions in either direction. Tailwind config maps all shadcn slots to these tokens so utility class names (`bg-bg`, `text-fg`, `border-border`) stay clean in admin code. Full slot table: CONSTRAINT-16. Founder Brief #4.

**Declaration site — `:root`, not `.admin-root`.** All eight `--admin-*` properties are declared at `:root` in `app/styles/admin.css`; only the dark visual chrome (`background-color`, `color`, `font-family`, `min-height`) stays on `.admin-root`, so the theme is still visually scoped. Radix primitives portal overlay content to `document.body`, outside `.admin-root`, and CSS custom properties are scope-bound to their declaration selector — so `bg-popover` resolved to undefined on escaped overlays and menus rendered transparent. **Moving the tokens back to `.admin-root` will re-break every Radix overlay.** Full rationale: CONSTRAINT-16.

**Founder Brief:** "Tailwind scoping".

### 4.3 File and function size budgets

Per CQ-01 and CQ-02:
- Functions ≤ 50 lines (security/validation may extend to 80).
- Service files ≤ 300 lines.
- Component files ≤ 200 lines.

When a module hits the limit, split by single responsibility (CQ-03). Naming: `admin-{resource}-mutations.ts` — see §6.6.6.

### 4.4 UI-boundary error handling

#### `lib/safe-load.ts`

Every Server Component that calls a `lib/db.ts` read function MUST wrap the call in `safeLoad(load, fallback, context)` from [`lib/safe-load.ts`](../lib/safe-load.ts) — CONSTRAINT-14. The wrapper:

1. Awaits `load()`. On success: returns the value.
2. On any throw: invokes `logLoadFailure(context, error)`, which emits a structured `console.error` with operation, error code, error message, and stack — the same shape as `logDbError` in `lib/db.ts`.
3. Returns the caller-supplied `fallback` (typically `[]` for list queries, `null` for single-row queries).

```ts
// app/projects/page.tsx — example shape
const projects = await safeLoad<Project[]>(
  () => getPublishedProjects(),
  [],
  'page:projects',
);
```

The wrapper converts data-layer throws into degraded UI states at the page boundary. Detail-page metadata and body both use it; the body adds `if (!row) notFound()` after the call so a null fallback dispatches Next.js's 404 path. List pages render an empty state on `[]`. `app/sitemap.ts` uses it too (`'route:sitemap'`), degrading to root-routes-only rather than 500-ing on a crawler's request.

**EH-01 carve-out (explicit):** this is the only catch-and-degrade pattern permitted in the codebase outside narrow data-layer error mapping. Using `safeLoad` inside `lib/` modules or mid-render helpers is an EH-01 violation. Boundary-only.

#### Error boundaries — one per segment

Both boundaries take the same LOUD posture: `error.message` and `error.digest` are rendered verbatim with a `reset()`-wired retry button. Neither masks the failure behind generic "Something went wrong" copy. The same error is also written to Vercel Runtime Logs by Next.js.

- **`app/(admin)/error.tsx`** — admin route group. Catches uncaught render-time throws from admin Server or Client Components. shadcn-styled.
- **`app/error.tsx`** (T41) — public routes. Same posture, styled with the public sheets (shadcn is admin-only). Renders `SiteHeader` plus a retry button and a link home.
- **`app/not-found.tsx`** (T41) — public 404, reached both by unmatched URLs and by `notFound()` from a detail page whose `safeLoad` returned null. Renders `SiteHeader` plus two exit links.

Neither T41 page invents a design value: both are composed entirely from classes that already exist in the export (`.container`, `.title-block`, `.page-title`, `.page-lede`, `.meta`, `.h-actions`, `.h-btn`, `.h-btn--fill`, `.h-btn--outline`). The export contains no 404 and no error page, and `.h-actions` / `.h-btn` are used off the home page here for the first time — flagged for `@designer` sign-off under CONSTRAINT-05 rather than treated as settled.

**Founder Brief:** "UI-boundary error handling".

### 4.5 Server / Client prop boundary (Nav / MobileNav retired at T46)

> **The components are gone; the rule is not.** `Nav`, `MobileNav` and their dual-prop escape hatch were deleted with the old component tree. Navigation is now `components/public/SiteHeader.tsx`, a single `'use client'` component holding its own `NAV_ITEMS` array of plain `href` strings; it renders `next/link` directly and derives the active section from `usePathname()`. No caller passes link targets in. `lib/nav-targets.ts` still exists in the tree but nothing imports it.

**The binding rule:** Next.js 15 RSC forbids passing function props from a Server Component to a Client Component (`Event handlers cannot be passed to Client Component props.`). Any future component that must accept link targets from both a Server Component page and a Client Component parent needs a plain-data escape hatch — a `Record<string, string>` prop that takes precedence over the function-valued one, with a default that preserves byte-identical render under CONSTRAINT-05's additive-prop carve-out.

**Founder Brief:** "Server-safe Nav props".

### 4.6 Image read pattern

Image IDs are resolved to signed Storage URLs on the server, at request time, before any markup is rendered:

1. The page (Server Component) calls a loader inside `safeLoad` (CONSTRAINT-14): `loadPublicProjects()` from `lib/public-projects.ts` for the projects list, `getPostBySlug` for a writing post.
2. The loader calls `getImageById(imageId)` to resolve the `images` row, then `getImageUrl(bucket_path)` for a signed URL with TTL 3600s, and attaches the result to the render-ready shape (`PublicProject.imageUrl` / `imageAfterUrl` / `media[]`).
3. The page hands the pre-signed shape to the client components (`ProjectCard`, `ProjectFrame`), which never touch the DB or Storage.
4. Resolution failures are isolated per row: a failed URL becomes `null` and is logged with project id and column name, but the row still renders without its image. Visitors never see a broken-image icon (EH-04).

Resolution lives in the loader rather than in per-image async Server Components, which makes the per-row failure isolation explicit rather than a property of where a component happened to sit. CONSTRAINT-15 owns the signed-URL rule (signed only, TTL 3600s, centralized in `lib/images.ts::getImageUrl`).

**Why server-side resolution, not client fetching:** search engines see the rendered `<img>` in the initial HTML; the URL is present at hydration with no extra round trip; and since `components/public/` is mostly `'use client'`, keeping data loading above the client boundary means no component ever holds a Supabase client.

**Why signed URLs, not public:** the `images` bucket is private (migration `005_rls_images.sql`), so public URLs would 404. TTL 3600s is long enough for a typical reading session and short enough that a leaked URL expires quickly.

**Public surface:**
- `getImageUrl(bucketPath: string, client?: SupabaseClient): Promise<string>` — `lib/images.ts`. Throws `ServiceError` on empty path or storage failure.
- `getImageById(id: string, client?: SupabaseClient): Promise<ImageRecord | null>` — `lib/db.ts`. Mirrors the `getProjectBySlug` pattern (DI for tests, throws `ServiceError` on DB error).

**Tests:** `tests/images.test.ts`, `tests/public-projects.test.ts`.

### 4.7 Test infrastructure: NODE_ENV-gated dev-only routes

The project mounts dev-only API routes (currently: `app/api/test/sign-in/route.ts`) using a triple-gate pattern. Each gate is independent — any one gate alone refuses production traffic.

**Gate 1 — NODE_ENV bracket indirection.** The route reads NODE_ENV via:

```typescript
const NODE_ENV_KEY = 'NODE_ENV';
if (process.env[NODE_ENV_KEY] !== 'test') return new Response(null, { status: 404 });
```

Direct `process.env.NODE_ENV` access is folded into a literal at build time by Next 15's compile-time inlining — the runtime gate becomes a constant `'development' !== 'test'` (always true in dev) regardless of the actual runtime NODE_ENV. The bracket-with-variable form preserves the runtime read. **Do not "simplify" this back to dot notation** — see CONSTRAINT-19.

**Gate 2 — explicit Vercel runtime refusal.** `if (process.env.VERCEL === '1')` returns 404. Vercel sets `VERCEL=1` on every deployment runtime. This is the belt to Gate 1's suspenders.

**Gate 3 — shared-secret header.** The route requires header `x-fixture-secret` to match `process.env.TEST_FIXTURE_SECRET` via `timingSafeEqual` from `node:crypto`, with a length pre-check (return 404 on length mismatch, since `timingSafeEqual` throws on unequal-length buffers). The secret lives in `.env.local` (gitignored) and CI secrets only — never in Vercel env.

**Pattern is reusable.** Any future dev-only API surface follows the same three gates. The secret env var name and the header name are convention; the gate ordering and constant-time comparison are mandatory (SEC-04).

**Cross-references:** `app/api/test/sign-in/route.ts`, `tests/e2e/fixtures/auth.ts`, `docs/security-report.md` audit 7, CONSTRAINT-19.

### 4.8 Playwright auth fixture pattern

E2E tests log in via a server-side magic-link flow that mirrors the production callback shape but bypasses email delivery.

**Identity convention.** The fixture user is `playwright-fixture@test.swarnimbagre.com`. The subdomain `test.swarnimbagre.com` is unowned — no DNS, no MX records, no inbox — so a stray real email bounces hard rather than landing in an inbox the project doesn't control. Future fixture identities follow the pattern `<purpose>@test.swarnimbagre.com`.

**Seed mechanism.** `scripts/seed-test-fixture.ts` is an idempotent CLI that creates the fixture user via `auth.admin.createUser({ email, email_confirm: true })` using the service-role key. Re-running with an existing user is a no-op. Run via `npx tsx scripts/seed-test-fixture.ts` once per environment (local + CI).

**Auth path.** The dev-only `/api/test/sign-in` route calls `auth.admin.generateLink({ type: 'magiclink', email })` to obtain a `token_hash`, then immediately calls `auth.verifyOtp({ token_hash, type: 'email' })` against the SSR client to bind the session to the response cookies. This mirrors the production callback at `app/(admin)/admin/auth/callback/route.ts` — same `verifyOtp` shape, same cookie wiring, no PKCE verifier emitted (CONSTRAINT-18 preserved).

**Serial-mode requirement.** Specs that share a fixture user must use `test.describe.configure({ mode: 'serial' })`. `auth.admin.generateLink` invalidates the prior magic-link token for the email; concurrent workers calling generate+verify against the same user race and one fails with `otp_expired`. If a future spec needs parallelism, mint per-test-isolated identities (`playwright-fixture-${testId}@test.swarnimbagre.com`).

**Suite lifecycle.** `playwright.config.ts` registers `tests/e2e/global-setup.ts` and `tests/e2e/global-teardown.ts`. Setup snapshots `projects.sort_order` before any test writes, then warms the routes the suite hits first. Teardown runs after the last test whether or not the run was green: it sweeps every fixture row and its Storage objects with a service-role client (`@supabase/supabase-js`, a devDependency — nothing here ships to the browser), restores the ordering from the snapshot, and verifies against a fresh read that nothing survived. It talks to Postgres directly rather than driving deletes through the admin UI because the suite writes to the production database (CONSTRAINT-02 — no staging project), and UI-driven cleanup left live rows behind on runs that reported green. A teardown failure fails the run. Both files execute in plain Node and must not import anything reaching `next/headers`.

**One worker, deliberately.** `workers: 1`. All eight spec files share a single `next dev` server; run in parallel they contend for it and the 20s per-step budgets in `admin-smoke.spec.ts` blow. The suite has never been verified green any other way, and serial is also faster here (1.7m vs 4.0m, measured Session 55). This subsumes the serial-mode requirement above at the config level; the per-spec `mode: 'serial'` declarations stay as the local statement of the constraint.

**Cross-references:** `tests/e2e/fixtures/auth.ts` (`loginAsAdmin()`), `tests/e2e/admin-logout.spec.ts` (consumer + serial-mode example), `tests/e2e/global-setup.ts` + `global-teardown.ts` + `fixtures/cleanup.ts` + `fixtures/sort-order-snapshot.ts`, `docs/plan-phase-2-admin.md` T19.2, `docs/founder-brief.md` entries 19 + 20.

### 4.9 Carousel surface: hand-rolled

The project media carousel lives entirely in `components/public/ProjectFrame.tsx` (`'use client'`, no npm dependency). It imports `useRef` and `useState` from React and a type from `lib/types`, and nothing else.

**Mechanics.** A single track element is translated with `transform: translateX(-current * 100%)`, where `current` is a `useState` index. Navigation wraps modulo slide count. Dots (`.sb-dot`, one per slide, `aria-current` on the active one), previous / next arrows and a `n / total` counter render only when there is more than one slide. Touch handling is a `touchstart` / `touchend` delta with a named `SWIPE_THRESHOLD_PX = 40` constant; a smaller delta is treated as a tap and ignored. `toSlides(media)` flattens the `project_media` rows into the slide array, emitting two slides for a row with an `imageAfterUrl` (§2.5).

**Why hand-rolled and not embla restyled.** The export's carousel is a transformed track with dots and arrows and nothing else. The behaviors that justified embla — drag physics, keyboard coordination, snap containment — are not in it, so 8 KB of route chunk bought nothing. `embla-carousel-react` and its two transitive packages were uninstalled; **the public site is back to zero runtime JS dependencies.**

**CONSTRAINT-22 still applies** and currently has zero consumers: any new runtime npm dependency on a public-site code path needs a named Override in `design-decisions.md` plus a build-time route-chunk measurement inside the 15 KB gzip budget. See the constraint for the measurement method and the escalation path.

**Multi-instance safety.** `/projects` renders N project cards on one page, each mounting its own `ProjectFrame`. Every instance keeps its own `current` state, and its accessibility wiring is label-based (`aria-label` referencing the project title) rather than id-based, so there are no cross-instance DOM id collisions. If a future change introduces an id-bearing attribute here, scope it per mount with `React.useId()`; a hardcoded id would collide on the second card and break screen-reader navigation for both.

**Client-component boundary.** Server Components above `ProjectFrame` pass already-resolved data: signed image URLs (TTL 3600s per CONSTRAINT-15), alt text and order. (Caption text was in this list until 2026-08-07; the caption path is gone — see §2.5.) Nothing above the boundary reaches into the carousel's runtime state.

**Empty state.** A project with zero slides renders a `no preview yet` placeholder. There is no SVG-motif fallback — the motif set was deleted along with `thumb_kind` (§2.1) — so a real screenshot is a hard requirement for any project card that should look finished. See `founder-brief.md` entry 34.

**Cross-references:** CONSTRAINT-05, CONSTRAINT-22, `design-decisions.md`, §2.5 (the schema the carousel renders), §6.6.9 (the atomic save RPC behind the admin write path).

### 4.10 Public render architecture: one responsive tree

**No device fork.** The public site is a single component tree with **one breakpoint at 640px**. Every public stylesheet carries its own `@media (max-width: 640px)` block; there is no second breakpoint anywhere. The `components/public/mobile/` tree and the `x-device-variant` middleware header are deleted — two parallel component trees is two places for a fix to land and one place for it to be forgotten, and server-side UA sniffing made every public response vary on a header, which is bad for caching and wrong at the edges of the UA string.

**Middleware does not run on public requests.** The matcher is `['/admin/:path*']`; middleware is exactly the admin session gate (§6.2). One fewer edge invocation per public page view, and it removes a whole class of "did middleware do something to this response" question from public-route debugging.

**Stylesheet split.** Tokens live in `app/styles/colors_and_type.css`. Component classes are split across `app/styles/public.css` (the shared shell: header, nav, page frame) plus one sheet per page: `public-home.css`, `public-projects.css`, `public-writing.css`, `public-other.css`. Each page sheet owns its own responsive block, so a page's desktop and mobile rules sit next to each other in one file rather than in a shared bottom-of-file media query. All seven public sheets are imported by `app/layout.tsx`.

**Font variables go on `<html>`, not `<body>`.** `colors_and_type.css` composes `--font-serif`, `--font-sans` and `--font-mono` at `:root` from the three `next/font` variables. A CSS custom property is substituted where it is **declared**, not where it is used: with the variable classes on `<body>`, `--font-instrument-serif` and friends are out of scope at `:root`, the composed families resolve to the guaranteed-invalid value, and every `font:` shorthand referencing them silently falls back — the whole site rendered in Times New Roman with no console error. Do not move them back.

**Palette.** The public palette is light: `--bg` #F4F1EA (warm cream), `--accent` #1F3D2F (deep green), `--hairline` #D3CDBE, `--fg-muted` #837D70. Admin deliberately stayed dark, so CONSTRAINT-16's four brand tokens are admin-owned constants, not values mirrored from here, and must not be resynced. See §4.2.

**Public routes.** Five HTML routes: `/`, `/projects`, `/writing`, `/writing/[slug]`, `/other`. There is no `/projects/[slug]`; a project card's "Writeup" action links to the linked post's own page (§2.1).

**Public non-HTML surfaces (T41).** Four more anonymous, crawlable surfaces sit alongside the five routes. All are Next.js file conventions, all rendered at the root segment, and all are in scope for security review (§6.2):

- **`/robots.txt`** — `app/robots.ts`. Static. `allow: '/'`, `disallow: ['/admin', '/api']`, plus a `sitemap` pointer and `host`. The disallow list is hygiene, not a security control; the auth middleware is what gates `/admin`.
- **`/sitemap.xml`** — `app/sitemap.ts`. **The only one that reads the database.** `force-dynamic` (because `createServerClient` reads request cookies), anon role, `safeLoad` around `getPublishedPosts()`. Emits the four root routes plus one entry per published post. Drafts are excluded twice over — `status='published'` inside the query *and* a re-check on every row before emit. The redundancy is deliberate: this is the one surface that hands URLs to crawlers, and a draft that reaches a crawler gets fetched, indexed and cached by third parties in a way no later un-publish undoes. It also makes the guarantee locally testable (`tests/sitemap.test.ts`).
- **`/icon.svg`** — `app/icon.svg`. Favicon, injected by Next's file convention. `app/layout.tsx` deliberately declares no `icons` key, which would emit the tag twice.
- **`/opengraph-image`** — `app/opengraph-image.tsx`. 1200×630 PNG rendered by Satori from the public palette. `next/font` cannot be used inside `ImageResponse` (the loader returns a CSS class; Satori needs raw bytes), so the TTFs are fetched from Google Fonts at render time. Every fetch is guarded: on any failure the family is simply not registered and Satori falls back, so the worst case is right palette / wrong typeface, never a broken build or a 500 on a crawler's request. The root segment is static, so this runs at build time with no per-request network call.

`app/layout.tsx` sets `metadataBase`, plus site-wide `openGraph` and `twitter` defaults; `metadataBase` is what lets the `opengraph-image` convention resolve to an absolute URL. `/writing/[slug]` is the only route with per-post overrides, and it must name `images: ['/opengraph-image']` explicitly because a per-route `openGraph` object replaces the inherited one wholesale — omitting it would strip the card rather than keep it.

**Public components.** `SiteHeader`, `ProjectCard`, `ProjectFrame`, `MarkdownContent`, `home/SocialIcons`, and `pages/{Home,Projects,Writing,Other}` — nine files, and that is the complete inventory. T46 deleted the entire `mobile/` tree plus `BeforeAfterMedia`, `BeforeAfterMediaScenes`, `DemoLoop`, `Footer`, `MorePointer`, `Nav`, `Page`, `PostImage`, `ProgressRing`, `ProjectImage`, `ProjectMedia`, `ProjectMediaCarousel`, `ProjectMediaCarouselParts`, `ProjectRow`, `ProjectThumb`, `SectionHead`, `SocialIcon`, `StatusPill`, `StillMedia`, `TweaksPanel`, `TypoIcon`, `Wordmark`, and `lib/thumb-kinds.ts`. Anything importing those names is stale.

---

## 5. Infrastructure and Deployment

### 5.1 Vercel

Single Vercel project linked to the GitHub repo. Production branch: `main`. Preview deploys on every PR.

**Build:** `next build`. No custom build command. `next.config.ts` calls `assertRequiredEnv()` at module load, so a missing env var fails the build loudly (EH-01).
**Runtime:** Node.js (Vercel default for Next.js).
**Caching headers:** Vercel defaults. There is no `vercel.json` and no `headers()` block in `next.config.ts`, so the intended policy — static assets `Cache-Control: public, max-age=31536000, immutable`, HTML `public, max-age=3600, s-maxage=3600` — is not codified in the repo. Note that every public page exports `dynamic = 'force-dynamic'`, so HTML is not cached at the edge today.
**Domain:** `swarnimbagre.com` apex + `www` redirect, both via Vercel.

### 5.2 Supabase

Single free-tier project. Migrations applied via Supabase CLI from `supabase/migrations/` (or via the Supabase MCP `apply_migration` tool during development).

**Tables:** `projects`, `posts`, `stats`, `images`, `project_media`, `notes` — all with RLS enabled.
**Storage:** bucket `images` (private; public read goes through signed URLs). Max file size 2 MB and the JPEG/PNG/WebP MIME allowlist are codified in `supabase/migrations/008_storage_images_limits.sql` (§2.4).
**Edge Functions:** `stats-ingest`.
**Auth:** Email provider only, magic link enabled, SMTP defaults.

### 5.3 Environment variables

| Var | Where | Public? | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel + local `.env.local` | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel + local `.env.local` | yes | Anon key for client/server reads |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel server-only + local `.env.local` | **no** | Bypasses RLS. Required by `lib/env.ts::assertRequiredEnv`, so the build fails without it. Three consumers: the 404-gated test sign-in route (§4.7), the Playwright fixture seed + teardown (§4.8), and **the account-recovery path** — `scripts/recover-admin-session.ts` mints an admin session with no email at all, and is the only lockout fallback that does not depend on SMTP (`auth-flow.md` §5.4). Losing this key removes the escape hatch. Not used by any Server Action; the Edge Function reads its own Supabase-injected copy |
| `STATS_INGEST_SECRET` | Supabase Edge Function env | **no** | Shared secret for `stats-ingest` |
| `ADMIN_ALLOWED_EMAIL` | Vercel server-only + local `.env.local` | **no** | Admin allowlist enforcement for magic-link sign-in (Layer 2 defense; Layer 1 is the Supabase dashboard). See `auth-flow.md` §3 and `lib/auth-internal.ts::assertAllowlistedEmail`. Also the identity `recover-admin-session.ts` targets |
| `NEXT_PUBLIC_SITE_URL` | Vercel + local `.env.local` | yes | Absolute site URL for magic-link `emailRedirectTo`. Falls back to `NEXT_PUBLIC_VERCEL_URL` when unset. See `lib/auth-internal.ts::getSiteUrl` |
| `TEST_FIXTURE_SECRET` | `.env.local` + CI secrets only, never Vercel | **no** | Gate 3 of the dev-only test sign-in route (§4.7) |

`.env.example` lists every Next.js-runtime variable name with no values (SEC-01). The one exception is `STATS_INGEST_SECRET`: it is Edge-Function-only (read via `Deno.env.get`, never by the Next.js app), so it appears in `.env.example` only as a documented comment block — not as an assignable key — pointing at the Supabase secret-store lifecycle in `docs/openclaw-config.md`.

### 5.4 Reproducibility debt — operational unversioned config

The following operational configuration is NOT in version control and is tracked manually. A fresh rebuild from `git clone` alone will not reproduce it; each must be re-applied by hand against the Supabase dashboard.

- **Supabase Auth — Site URL.** Set to the canonical apex per CONSTRAINT-21. Dashboard `Auth → URL Configuration`.
- **Supabase Auth — Redirect URL allowlist.** Magic-link callback origin(s). Same dashboard page.
- **Supabase Auth — Custom Magic Link email template.** The HTML/text body, customized away from the stock `{{ .ConfirmationURL }}` shape to the `token_hash` shape that lands on `/admin/auth/callback`. Dashboard `Auth → Email Templates → Magic Link`. **The dashboard "Send magic link" row action depends on this template being intact** (`auth-flow.md` §5.3).

**Why this is debt, not design.** Supabase exposes these via the dashboard UI but had only partial CLI / declarative-config coverage as of 2026-05. The intended remediation is CLI-managed `config.toml` auth config once that surface stabilizes. Until then the dashboard is the source of truth and any rebuild re-applies by hand. Operationally low-risk because the project is single-environment (CONSTRAINT-02) — there is no staging/prod drift, only a one-time re-apply on disaster recovery.

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

#### `project_media`
- `project_media_public_select` — role `anon`, FOR SELECT, USING an EXISTS check that re-resolves the parent project's `status='published'` at query time (migration 010; see §2.5).
- `project_media_admin_all` — role `authenticated`, FOR ALL, USING `true`, WITH CHECK `true`.

#### `notes`
- `notes_public_select` — role `anon`, FOR SELECT, USING `true` (notes are public, like stats; there is no draft state).
- `notes_admin_all` — role `authenticated`, FOR ALL, USING `true`, WITH CHECK `true`.
- **No policy for `service_role`,** deliberately: it bypasses RLS by definition. **No write path for OpenClaw:** the Edge Function writes `stats` only (CONSTRAINT-04).

#### Platform-side functions are in scope for the RPC grant idiom (migration 015, F-41)

`public.rls_auto_enable()` is Supabase platform infrastructure, not project authorship: it appears in no repo migration, `pg_proc` carries no creation timestamp so it cannot be dated, and it backs the `ensure_rls` event trigger that fires on `ddl_command_end` and switches row security on for every new table created in `public`. It is `SECURITY DEFINER` with `proconfig = ["search_path=pg_catalog"]`, and Supabase's default privileges had left `EXECUTE` granted to `public`, `anon` and `authenticated` — making a definer-privilege function reachable by an unauthenticated caller at `/rest/v1/rpc/rls_auto_enable`.

Migration `015_revoke_rls_auto_enable_execute.sql` revokes `EXECUTE` from all three, guarded by a `to_regprocedure` existence check so it is a no-op where the platform has not installed the function. Both the `public` revoke and the named `anon` / `authenticated` revokes are required — the same two-revoke rule as the project's own RPCs (§6.6.9), because Supabase's bootstrap default privileges grant directly to those roles and that grant survives a revoke from `public`.

Exploitability was nil — the body's first statement is `pg_event_trigger_ddl_commands()`, which raises outside a `ddl_command_end` context — and that is not the reason for the fix. The point is not leaving a definer-privilege entry point internet-reachable, where a future rewrite of the body would silently inherit an anon-callable definer path with no review step in between. The auto-enable behaviour is unaffected: Postgres does not consult `EXECUTE` privilege when firing an event trigger; the function runs inside the DDL transaction under the trigger's own ownership.

**Forward rule:** platform-installed functions in `public` are inside the project's security surface even though no migration created them. Anything `SECURITY DEFINER` and `EXECUTE`-granted to `anon` or `authenticated` needs a justification or a revoke, regardless of who authored it.

### 6.2 Auth boundaries

**Unauthenticated public surfaces.** Nine in total. Anon Supabase client where a client is used at all; RLS is the only filter; middleware does not execute on any of them (matcher is `['/admin/:path*']`).

| Surface | Reads DB? | Posture |
|---|---|---|
| `/` | yes (anon) | RLS-filtered reads behind `safeLoad` |
| `/projects` | yes (anon) | RLS-filtered; published projects + published-post map only |
| `/writing` | yes (anon) | RLS-filtered to `status='published'` |
| `/writing/[slug]` | yes (anon) | RLS-filtered; `notFound()` on null |
| `/other` | yes (anon) | RLS-filtered; stats + notes are public by policy |
| `/sitemap.xml` | **yes (anon)** | RLS-filtered to `status='published'`, plus a redundant per-row published re-check before emit. `safeLoad` degrades a query failure to roots-only. Emits no draft URL by construction (§4.10) |
| `/robots.txt` | no | Static. Disallows `/admin` and `/api` — hygiene, not a control |
| `/icon.svg` | no | Static asset |
| `/opengraph-image` | no | Build-time Satori render; the only outbound network call on any public surface (Google Fonts, fully guarded) |

Any new file-convention route added at the root segment joins this list and is in scope for security review.

**Admin routes** (`/admin/*`): middleware calls `supabase.auth.getUser()` and redirects to `/admin/login` when it errors or returns no user. `/admin/login` and `/admin/auth/callback` are ungated **by exact match, never prefix match** — so a future `/admin/login/recover` is gated by default (F-16). The admin's email is enforced by the fact that there is exactly one user account; no role check is needed.

**Admin mutations** (every Server Action that writes): `assertAdminSession()` at the top of the action body, independent of middleware. See §6.6.10 and CONSTRAINT-23.

**Edge Function**: shared-secret header, constant-time comparison (SEC-04).

**`getUser()`, not `getSession()` (F-40, audit 24b).** `getSession()` decodes the SSR cookie and checks `exp` locally without verifying the JWT signature, so a hand-forged cookie carrying a garbage-signed token with a future `exp` passed the gate and rendered the admin shell — with no data, because PostgREST still rejected the unsigned JWT on every query, but with the page structure exposed. `getUser()` round-trips to Supabase and validates the token server-side. The cost is one auth round-trip per gated page load, which is the correct price for the only check standing in front of `/admin`. Do not swap it back for the local decode.

**Admin allowlist is two-layer** (`auth-flow.md` §3): the Supabase dashboard "Allow new users to sign up" is OFF (Layer 1), and `lib/auth-internal.ts::assertAllowlistedEmail` rejects any email != `ADMIN_ALLOWED_EMAIL` before invoking `signInWithOtp` (Layer 2). The callback route re-checks the email post-`verifyOtp` so a session is never minted for a non-allowlisted user.

### 6.3 Threat model — top three

| # | Threat | Mitigation |
|---|---|---|
| 1 | XSS via untrusted Markdown in posts | DOMPurify whitelist (§7). Sanitization is applied at render time, every time. The DB stores raw Markdown, never HTML — the sanitizer runs on every read, with no stored-HTML attack surface. |
| 2 | Unauthorized stat ingestion (spam or impersonation of OpenClaw) | Edge Function with shared secret. Constant-time comparison defeats timing oracles. Service role key is held only by the Edge Function runtime, never sent over the wire from a client. |
| 3 | Unauthorized admin access | Magic link auth (single account). Middleware verifies the token via `getUser()` and redirects anon requests on `/admin/*`. Every admin mutation Server Action additionally calls `assertAdminSession()` before it acts (§6.6.10) — middleware does not run on the Server Action dispatch path when the action ID is POSTed to a non-`/admin` URL. RLS remains the authoritative resource-level gate behind both. |

### 6.4 Secrets handling

- All secrets are env vars (SEC-01). `.env*` is gitignored (SEC-07).
- `SUPABASE_SERVICE_ROLE_KEY` is read in four contexts, none of them reachable from a browser or a Server Action: `supabase/functions/stats-ingest/index.ts` (Edge runtime, Supabase-injected), `app/api/test/sign-in/route.ts` (404-gated, §4.7), `scripts/seed-test-fixture.ts` + `scripts/recover-admin-session.ts` (CLI), and `tests/e2e/fixtures/cleanup.ts` + `playwright.config.ts` (test harness). It is never imported by `lib/`, never exported from a client component module, and no Server Action touches it. `lib/env.ts` names it as a required var, so a missing value fails the build.
- `STATS_INGEST_SECRET` lives only in the Edge Function's env.
- Vercel project settings carry production values; local dev uses `.env.local` (gitignored).
- A startup check in `next.config.ts` (`assertRequiredEnv()` from `lib/env.ts`) throws if any required env var is missing (EH-01: fail loud).

### 6.5 Logging and PII

- Errors include operation, sanitized inputs, and stack trace (EH-02, EH-03).
- Email addresses are logged as a presence flag (`{ emailProvided: true }`), never as the raw value (SEC-05).
- User-facing errors are concise; full detail goes to the internal log (EH-04).
- No `console.log` left in production code (CQ-05).

### 6.6 Auth flow architectural patterns

#### 6.6.1 `'use server'` module surface

Every `export` of a `'use server'` module is promoted by Next.js to a publicly callable Server Action with a stable hashed ID that ships in the client bundle. Auth-adjacent code therefore separates concerns across two sibling files:

- a `'use server'` wrapper module containing ONLY public Server Action entry points (`lib/auth.ts` — exports `signInWithMagicLink`, `signOut`);
- a non-`'use server'` helper module containing throwing, timing-sensitive or otherwise outcome-dependent logic (`lib/auth-internal.ts` — exports `attemptMagicLink`, `assertAllowlistedEmail`, `EMAIL_SCHEMA`, `SIGN_IN_OPERATION`).

The wrapper imports the helper as a regular ES module function. This is binding for every future auth-adjacent task. Build-output check: `.next/server/server-reference-manifest.json` lists exactly the expected action IDs, no more. See SEC-08 and `docs/auth-flow.md` §2a point 4.

#### 6.6.2 Constant-time floor for enumeration-resistant Server Actions

Auth-adjacent Server Actions whose internal helpers have outcome-dependent timing (allowlisted vs not, found vs not-found) wrap the helper in `try/finally` and pad the response with `setTimeout` to a fixed wall-clock floor before resolving. The floor is a named constant (`MIN_DURATION_MS = 750`, `lib/auth-constants.ts`). Fast paths pad up; slow paths run over — floor, not ceiling, since truncating slow paths would introduce a separate oracle. The wrapper catches and discards thrown errors silently: re-logging inside the catch reintroduces a timing differential between success and failure and reopens the channel. Inner helpers log structured context themselves. See `docs/auth-flow.md` §2a point 3 and `docs/security-report.md` audit-2 F-12.

#### 6.6.3 Supabase SSR auth flow type — implicit, not PKCE

`lib/supabase.ts::createServerClient` constructs the `@supabase/ssr` client with `auth: { flowType: 'implicit' }`. The library defaults to PKCE, which writes a `*-code-verifier` `Set-Cookie` on the call-Supabase branch of `signInWithOtp` but not on the throw-and-skip branch — a header-level enumeration channel orthogonal to body shape and timing. Implicit flow does not emit the verifier cookie, so response headers are uniform across outcomes. The magic-link callback consumes `?token_hash=&type=` via `verifyOtp`, which is not PKCE-dependent. The PKCE-shaped `?code=...` branch in `app/(admin)/admin/auth/callback/route.ts` is dead under the current single-user magic-link-only model; it is retained for future OAuth integration. See `docs/auth-flow.md` §2a point 5, `docs/security-report.md` audit-3 F-15, and CONSTRAINT-18.

#### 6.6.4 `/api/admin/*` route handler gate (F-17, audit pass 5)

The middleware matcher (`['/admin/:path*']`) does not cover `/api/*`. **Nothing under `app/api/` is protected by middleware.** No `/api/admin/*` routes exist today — the only route there is the `NODE_ENV`-gated test fixture (§4.7), which self-protects — but the natural growth path lands admin-only endpoints (image upload, batch operations, deletes) under `/api/admin/*`, where the gate would not run.

Every route handler added under `app/api/admin/**` MUST: (1) call `assertAdminSession()` from `lib/session.ts` at the top of the handler, before any business logic; (2) return `new Response(null, { status: 401 })` when it throws — uniform across every admin API route, no body, no error detail, paralleling the SEC-09 redirect-uniformity contract the page gate already satisfies.

The alternative — tightening the matcher to gate `/api/admin/*` directly — is acceptable but not preferred: per-handler protection keeps API routes self-protective and decouples them from the matcher's evolution. Document the choice when the first such route ships.

**Code-review checklist:** any new file under `app/api/admin/**` must contain an `assertAdminSession()` call before any business logic. See `docs/security-report.md` audit-5 F-17 and audit-24b F-39.

#### 6.6.5 Build invariants (F-14, SEC-09)

Two invariants on the auth surface must hold across every build. Breaking either is a security regression, not a refactor.

- **Server Action surface (F-14).** After every build, `.next/server/server-reference-manifest.json` must list exactly the actions named in the allowlist at `tests/server-actions-manifest.test.ts` — no more, no fewer. The allowlist is **nineteen IDs across eight modules**: `signInWithMagicLink`, `signOut` (`lib/auth.ts`); `createProject` / `updateProject` / `deleteProject`; `createPost` / `updatePost` / `deletePost`; `insertStat` / `updateStat` / `deleteStat`; `createNote` / `updateNote` / `deleteNote`; `uploadImage` / `deleteOrphanImages`; `saveProjectMedia`; `saveProjectOrder` / `savePostOrder`. Seventeen of the nineteen are admin mutations carrying the §6.6.10 guard; the two exceptions are the `lib/auth.ts` pair.

  **Reachability gotcha:** Next.js excludes Server Actions not reachable from any `app/**` route, so an action can exist in source and stay absent from the manifest until a page renders the component that dispatches it — the reason several actions entered the allowlist a task later than they were written. Any PR that adds an action ID without updating the allowlist and auditing the new surface is a wire-level enumeration regression. See §6.6.1, §6.6.6, `docs/auth-flow.md` §2a point 4, `docs/security-report.md` audit-4 F-14 and audit-5 F-14a/c/d.

- **Middleware uniformity (SEC-09).** Every middleware redirect outcome on the admin auth gate must pad to `MIN_DURATION_MS = 750` and write zero `Set-Cookie` headers. Tests S1–S5 in `tests/middleware.test.ts` enforce this across the no-session, Supabase-error and helper-throw branches; do not relax them without re-running `@security`. See `docs/security-report.md` audit-5 "Six-channel SEC-09 uniformity".

#### 6.6.6 Admin mutation surface — per-resource file split

The mutation surface for admin CRUD splits **per resource family** (projects, posts, stats, notes, images, project-media, reorder) because the client-side form must import the response-state shape without transitively pulling `next/headers`. Using projects as the worked example:

- **`lib/admin-projects-mutations-types.ts`** — pure types and consts. Exports the `ProjectMutationState` envelope (`{ status: 'idle' | 'ok' | 'error'; fieldErrors?; formError? }`) and the initial state. No runtime imports of Supabase, zod, or `next/headers`. Safe to import from `'use client'` components — this is the file that crosses the boundary at the type level. The cross-resource `GENERIC_FORM_ERROR` string lives in `lib/auth-constants.ts` (single source of truth — wire copy must remain identical across resources to prevent enumeration via copy differences).
- **`lib/admin-projects-mutations-internal.ts`** — server-only helpers that may throw: `createProjectInternal`, `updateProjectInternal`, `deleteProjectInternal`, plus the operation tags used in structured logs. NO `'use server'` directive — regular ES module functions, not Server Actions. Imports the Supabase server client and is therefore poisoned by `next/headers`; never import it from a client component.
- **`lib/admin-projects-mutations.ts`** — `'use server'`. Exports ONLY the public Server Action entry points (`createProject`, `updateProject`, `deleteProject`). Each wrapper applies the uniformity contract: `try/finally` with the `MIN_DURATION_MS = 750` floor (Channel 3), `try/catch` converting `ZodError` to `fieldErrors` and any other throw to a generic `formError` (Channels 1, 2), no rethrow to the wire (Channel 6), no `Set-Cookie` writes (Channel 5). The first statement inside that `try` is `await assertAdminSession()` (§6.6.10, CONSTRAINT-23). Every export lands a stable hashed action ID in the manifest (§6.6.5).

Two further members exist where a wrapper crossed CQ-02's 300-line budget. The split axis is always single responsibility, never line-count-driven code shuffling:

- **`-schemas.ts`** — zod schemas and derived types, lifted out of `-internal.ts`. Present on projects, stats, notes, project-media and reorder.
- **`-formdata.ts`** — the `FormData` field readers and the `ZodError` → `fieldErrors` mapper, lifted out of the wrapper. Projects only. Extract this only when a wrapper's parsing bulk is what breaches the budget — the wrapper file must stay a list of Server Action entry points, so parsing helpers are the correct thing to move out and the entry points are not.

The form component for each resource (`components/admin/ProjectForm.tsx`, `PostForm.tsx`, `StatsInsertForm.tsx`, `NotesInsertForm.tsx`, …) is `'use client'`, imports types from its sibling `-types.ts` only, and receives Server Action references via Next 15's transform — no runtime import of the wrapper module on the client. `useActionState` threads the state envelope.

**Why three files and not the two-file split from §6.6.1:** the auth flow's client surface (`LoginForm`) imports nothing from `lib/auth*.ts` at the type level, because magic-link auth returns `void`. Mutations are different — the form has to react to `fieldErrors` and `formError`, so it must import the shape from somewhere. Co-locating types with the internal helpers breaks the build with `You're importing a component that needs "next/headers"`; pushing them into `lib/types.ts` would pollute the domain-types module with admin-only UI state.

**Why per-resource and not shared:** the shared trio crossed CQ-02's 300-line budget (`admin-mutations.ts` = 519, `admin-mutations-internal.ts` = 687). Per-resource modules also reduce blast radius, isolate test mocks, and decouple the slug-lock policy (projects/posts) from the schemaless write path (stats) and the file-handling path (images).

**Code-review checklist:** any new `'use server'` admin mutation module must (1) keep its file scope to public Server Action wrappers only — no exported helpers, types or consts; (2) import types from a `-types` sibling; (3) wrap the internal helper in the uniformity contract; (4) call `await assertAdminSession()` as the first statement inside that `try`, in every exported action; (5) update `tests/server-actions-manifest.test.ts` in the same PR; (6) live in its own per-resource family — do NOT add a new mutation to a sibling resource's `-mutations.ts`.

#### 6.6.7 `useActionState` dispatch from inside a parent form

When a Server Action must dispatch from inside an existing parent `<form>` — e.g. an image upload widget embedded inside `ProjectForm` / `PostForm` — the inner client component CANNOT wrap itself in another `<form>`. HTML disallows nested forms; the browser silently drops the inner form and the outer form's submit handler intercepts everything. The pattern is:

- Render the inner component as `<div>` (NOT `<form action={...}>`).
- Trigger button is `<button type="button" onClick={handleUpload}>` (NOT `type="submit"`).
- `handleUpload` constructs `FormData` from refs / state and calls `startTransition(() => dispatch(formData))`.
- The `useActionState` envelope is preserved unchanged: `const [state, dispatch, isPending] = useActionState(action, INITIAL_STATE)`. Wrapping the dispatch in a `useTransition` is required for `isPending` to track the in-flight Server Action when called outside a `<form action>` binding.

The Server Action wrapper itself is byte-identical to the form-bound case — same wire shape, same RSC dispatch path, same uniformity contract. The fix is a client-side composition refactor only.

**Reference implementation:** `components/admin/ImageUpload.tsx`. **Regression pin:** `tests/ImageUpload.test.tsx` — the "renders no <form> element" test asserts `container.querySelector('form')` is `null`. The bug only surfaced against a real browser (BLOCKING-01, T28), because unit tests mocked the dispatch path.

#### 6.6.8 Admin query surface — per-resource split + shared query-error helper (CQ-02/CQ-07)

The admin read surface mirrors the per-resource decomposition of the mutation surface (§6.6.6), for the same reason: the single `lib/admin-queries.ts` grew past CQ-02's 300-line budget. `lib/admin-queries.ts` is retained as a thin re-export barrel at the original path, so no consumer import changed:

- **`lib/admin-queries-projects.ts`** — `ProjectFilter`, `ProjectRow`, `getAllProjects`, `getProjectById`.
- **`lib/admin-queries-posts.ts`** — `PostFilter`, `PostRow`, `PostPickerRow`, `getAllPosts`, `getPostById`, `listPostsForPicker`.
- **`lib/admin-queries-stats.ts`** — `getAllStats`.
- **`lib/admin-queries-notes.ts`** — `getAllNotes`.
- **`lib/admin-queries-project-media.ts`** — `getProjectMediaByProjectAdmin`.
- **`lib/admin-queries.ts`** — barrel only; re-exports the symbols above. No logic.

Per-module structured-log helpers were a CQ-07 DRY violation and were collapsed into a single `logQueryError(operation, error)` in `lib/admin-mutation-log.ts` — the same module that owns the mutation-side `logMutationError` — imported by each query module. Admin reads do NOT route through `lib/safe-load.ts`; that boundary is public-Server-Component-only (EH-01). Admin query failures surface loud to the operator via `logQueryError` plus an empty/typed result, never silently swallowed.

**Code-review checklist:** a new admin resource gets its own `admin-queries-<resource>.ts`; the barrel re-exports it; query-error logging goes through `logQueryError` — do not reintroduce per-module copies.

#### 6.6.9 Atomic save surface — Postgres RPC pattern

When a Server Action must atomically replace a child collection for one parent (delete-all-then-insert-all), wrap both statements in a single Postgres function call rather than running them sequentially from the application layer with a try/catch rollback. The application-layer approach has strictly more failure modes — a crash between the two statements, a connection drop after the DELETE commits, a partial INSERT whose compensating delete also fails. Sequential-with-app-rollback is acceptable only when the RPC route adds genuine schema cost: parameter shapes that don't translate cleanly to a `jsonb` payload, or callers that genuinely need per-statement progress reporting.

Conventions established by `save_project_media` (migration `010a`), binding for future RPCs of this kind:

- `LANGUAGE plpgsql`.
- `SECURITY INVOKER` — the function runs with the caller's role, so the table's existing admin RLS policy gates both the DELETE and the INSERT exactly as it would for direct table writes. No `SECURITY DEFINER` unless there is a specific reason to elevate; defaulting to `INVOKER` keeps RLS the single source of truth.
- `SET search_path = ''` with every reference qualified `public.*` (Supabase advisor `0011_function_search_path_mutable`).
- `EXECUTE` revoked from both `public` **and** `anon`, then granted only to `authenticated`. Supabase's project-bootstrap default privileges run `grant execute ... to anon, authenticated, service_role` on every new function in `public`, so `anon` ends up with a direct grant that survives a `revoke from public`. Both revokes are required.
- Input shape guard at the top of the body — `raise exception` on NULL or non-array `jsonb` payloads. Without it, `jsonb_array_elements(null)` returns zero rows silently and an unguarded DELETE-then-INSERT would wipe the collection.
- Where ordering matters, derive `order_index` from array position via `WITH ORDINALITY` rather than trusting a caller-supplied field. The array IS the order; this eliminates the duplicate-`order_index` failure mode at the source.

**Reference implementations:** `supabase/migrations/010a_save_project_media_rpc.sql`, `012a_save_sort_order_rpc.sql`.

#### 6.6.10 Application-layer auth guard on admin mutations — `assertAdminSession()` (F-39, CONSTRAINT-23)

`lib/session.ts` exports one function, `assertAdminSession(client?: SupabaseClient): Promise<void>`. It is called as the first statement inside the `try` of **every one of the 17 admin mutation Server Actions**, across all seven wrapper modules: `admin-projects-mutations.ts`, `admin-posts-mutations.ts`, `admin-stats-mutations.ts`, `admin-notes-mutations.ts`, `admin-images-mutations.ts`, `admin-project-media-mutations.ts` and `admin-reorder-mutations.ts`. `lib/auth.ts` (`signInWithMagicLink`, `signOut`) is deliberately excluded — guarding the sign-in path would lock the single user out of their own login.

**Why it exists.** Without it, admin authorization is single-layered on Postgres RLS; SEC-04 requires two checks, authenticated AND authorized, and only the second existed. The gap is larger than it looks because of how Next.js dispatches Server Actions: the action is selected by the `Next-Action` request header against whatever URL is POSTed, not against the route it nominally belongs to. With the matcher narrowed to `/admin/:path*`, an action ID lifted out of the client bundle could be POSTed to `/` — a path middleware never sees — and the body would run in full, with only the RLS policy refusing the write. One bad policy in a future migration would then be an immediate unauthenticated write path with nothing behind it. The guard does not replace RLS; RLS stays the authoritative resource-level gate. This is the authentication half.

Four design properties, each load-bearing (CONSTRAINT-23 carries the same rules in normative form):

- **Wrapper layer, not `-internal.ts`.** The `'use server'` wrappers are the client-reachable boundary (§6.6.1); the internal helpers are ordinary ES module functions with no wire address. Guarding the internals would put the check behind the boundary it is supposed to defend, and would fire redundantly on server-side call chains.
- **Inside the existing `try`, not before it.** The wrapper's `finally { await padToFloor(start) }` therefore still covers a guard rejection, so an unauthenticated call is padded to `MIN_DURATION_MS = 750` like every other outcome (SEC-09 Channel 3), and the wrapper's `catch` still converts the throw to the uniform `GENERIC_FORM_ERROR` envelope (Channel 2). An unauthenticated caller receives a response byte-identical to a failed validation.
- **It throws; it does not return a boolean.** A guard whose failure mode is a falsy return is one forgotten `if` away from being a no-op. `ServiceError` on every failure mode — absent session, Supabase error, network throw. Logs carry the operation tag and error name only, never token contents, session, email or raw error message (SEC-05, EH-02).
- **It lives in a directive-free module.** `lib/session.ts` has no `'use server'`. Exporting the guard from a `'use server'` module would promote it to a publicly callable Server Action and hand any client a wire-level "is an admin session currently present?" oracle — a probe channel orthogonal to the uniformity contract (SEC-08).

It uses `getUser()`, not `getSession()`, for the same reason as the middleware gate (§6.2).

**Code-review checklist:** every export of an admin `*-mutations.ts` module contains `await assertAdminSession()` as the first statement inside its `try`. A new mutation without it is a security regression, not a style nit.

---

## 7. Markdown Renderer (Decision 6)

**Library:** `marked` (Markdown → HTML) + `DOMPurify` (sanitization).
**Layer:** client-side. The DB stores raw Markdown. Rendering happens in a client component because DOMPurify uses the DOM (jsdom on the server is possible but adds weight; client-side is sufficient for this site's traffic profile).

**Whitelist (final):**

| Element | Allowed attributes |
|---|---|
| `p`, `ul`, `ol`, `li`, `blockquote`, `code`, `pre`, `em`, `strong`, `h1`, `h2`, `h3`, `h4` | none |
| `a` | `href` only — `javascript:` protocol stripped |
| `img` | `src`, `alt` only |

Everything else is removed. Inline event handlers (`onerror`, `onclick`, etc.) are removed by DOMPurify by default and explicitly verified by tests.

**Why client-side and not server-side rendering of HTML:**
- The DB never contains HTML, so a stored-XSS path through the database is closed off by construction.
- Server-side rendering of sanitized HTML is possible but means the sanitizer runs on every cache miss. Client-side keeps the cache layer simple and the trust boundary unambiguous.

**Founder Brief:** "Markdown renderer".

---

## 8. Founder Briefs (inline + compiled)

The full Founder Brief document is [`founder-brief.md`](founder-brief.md). Each architectural decision in this file (§1.3, §2.3, §2.4, §3.3, §4.2, §7) is also a Founder Brief entry. Architecture changes require a corresponding Founder Brief update.

---

## 9. Constraints

The binding decisions in this document are mirrored in [`constraints.md`](constraints.md). Constraint IDs (`CONSTRAINT-XX`) provide stable references for future sessions to check compliance against.
