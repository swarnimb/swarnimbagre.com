# Architecture: swarnimbagre.com

**Date:** 2026-05-06
**Last revised:** 2026-08-06 (T47 — Playwright global setup / teardown, single worker)
**Status:** Locked. Six architectural decisions captured below; each has a Founder Brief in [`founder-brief.md`](founder-brief.md). Binding constraints derived from these decisions are in [`constraints.md`](constraints.md).

> **T46 re-baseline (2026-08-04).** The public site was rebuilt against a new design export. `constraints.md` CONSTRAINT-05 and `design-decisions.md` are the authoritative statement of what the design now is; this document describes how it is built. The mobile component fork, the device-variant middleware header, the `/projects/[slug]` route and the embla dependency were all removed. Overrides 1, 2 and 3 are retired. Sections below carry T46 notes where the shape changed.

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

- **Public site:** raw React with custom components under `components/public/`. Styling is exclusively the token layer in `app/styles/colors_and_type.css` plus the component sheets `app/styles/public.css`, `public-home.css`, `public-projects.css`, `public-writing.css` and `public-other.css`. No Tailwind, no component library. **Zero runtime JS dependencies** (T46). `embla-carousel-react` and its two transitive packages were uninstalled when the project media carousel was re-implemented by hand in `ProjectFrame.tsx`; see §4.9. The carousel's admin save path still uses a Postgres RPC (`save_project_media`, migration `010a_save_project_media_rpc.sql`) for atomic delete-then-insert; see §6.6.9.
- **Public fonts:** Instrument Serif (display), Space Grotesk (body and UI), Space Mono (kickers, dates, tile labels). Loaded through `next/font/google` in `app/layout.tsx`, which self-hosts the files at build time, so there is no runtime request to Google and no render-blocking `@import`. See §4.10 for the `<html>`-vs-`<body>` placement rule, which is load-bearing.
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

Six tables: `projects`, `posts`, `stats`, `images`, `project_media`, `notes`. RLS default-deny on every one. Migrations live in `supabase/migrations/` with sequential numbering.

**Applied ledger.** The Supabase migration ledger on the production project records eleven entries: `007`, `009`, `010`, `010a`, `011`, `012`, `012a`, `013`, `014`, `015`, `016`. Files `001` through `006` and `008` exist in the repo but are not in the ledger. Migrations `013_project_card_fields.sql` and `014_other_page_model.sql` landed at T46; `015_revoke_rls_auto_enable_execute.sql` and `016_stats_notes_sort_order_append.sql` landed at audit 24b. All four are applied to production.

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
| `post_url` | `text` | NULL — public-card `¶ notes` button source (migration 009) |
| `progress_percent` | `integer` | NULL, CHECK `(progress_percent between 0 and 100)` — drives the ProgressRing; null → ring not rendered (migration 009) |
| `thumb_kind` | `text` | NULL. **Dead since T46.** Originally selected an SVG motif from `lib/thumb-kinds.ts` (migration 009). The redesigned card renders photographic media only, so `lib/thumb-kinds.ts` and the `ThumbKind` union were deleted and nothing reads the column. Retained rather than dropped so historical values survive if the decision is ever revisited. Still carried in the `PROJECT_COLUMNS` projection and typed `string \| null` on `Project` |
| `image_after_id` | `uuid` | NULL, FK → `images.id` ON DELETE SET NULL — "after" image for the BeforeAfterMedia slider; when null, the card renders a single `<img>` from `image_id` (migration 009) |
| `post_id` | `uuid` | NULL, FK → `posts.id` ON DELETE SET NULL — links a project to a published post whose body renders on the detail page (Override 3); independent of `post_url` (migration 011) |
| `sort_order` | `integer` | NOT NULL, CHECK `(sort_order >= 0)` — explicit admin-controlled manual order, independent of `created_at`. Backfilled newest-first on apply so the public listing did not reshuffle on deploy. A `BEFORE INSERT` trigger appends new rows to the end (`max(sort_order)+1`) when no explicit value is supplied (migration 012) |
| `subtitle` | `text` | NULL, CHECK `subtitle is null or length(btrim(subtitle)) between 1 and 120`. One short line under the card title. Capped so it cannot quietly become a second description and blow out the card layout (migration 013) |
| `tags` | `text[]` | NULL, CHECK: 1 to 8 elements, no NULL element, no empty-string element, joined length ≤ 200. Rendered as the card's tag pills. Null or empty renders no tag row (migration 013) |
| `created_at` | `timestamptz` | NOT NULL, default `now()` |
| `updated_at` | `timestamptz` | NOT NULL, default `now()`, trigger on update |

**Indexes:** `(status, created_at DESC)` from migration 001; `(status, sort_order)` added in migration 012 to serve the manual-order public listing. UNIQUE on `slug`.

**Slug-lock trigger:** a BEFORE UPDATE trigger raises an exception if `slug` changes while `status='published'` (DB-level enforcement of the slug-lock-after-publish rule).

**RLS on the new columns (migration 009).** No new policies required. The existing `projects_public_select` (anon, FOR SELECT, USING `status = 'published'`) and `projects_admin_all` (authenticated, FOR ALL) policies from migration 002 grant access at the row level, not column level — every new column is automatically covered. Verified against `pg_policies` post-apply.

**Card content fields (T46, migration 013).** `subtitle` and `tags` fill the two content slots the redesigned project card renders but the schema did not carry. Both are nullable and the card degrades when either is missing, so the migration needs no backfill and every pre-existing row stays valid.

The tag guards are written entirely with array operators (`array_length`, `cardinality`/`array_remove`, the `@>` containment test, `array_to_string`) rather than a per-element predicate. That is not a style choice: Postgres forbids subqueries inside a CHECK constraint, so there is no way to express "for every element, …" there. The NULL-element guard compares `cardinality(tags)` against `cardinality(array_remove(tags, null))` instead of using `array_position`, whose NULL-search semantics are easy to get subtly wrong. The joined-length ceiling is a coarse per-element size guard standing in for the per-element check that cannot be written. The one case the DB cannot catch is a whitespace-only tag; that is caught a layer up by the zod schema, which trims before validating (same split as the T43.E media schemas).

**Override 1 (project-card surface, 2026-05-19). RETIRED at T46.** Six columns above were consumed by a project-card surface that deviated from the original dark bundle. That bundle and its overrides are retired; see the CONSTRAINT-05 re-baseline note in `constraints.md` and the retirement banner in `design-decisions.md`. `github_url`, `live_url`, `progress_percent` and `image_after_id` remain live columns on the new card surface; `post_url` and `thumb_kind` do not. Historical rationale is `founder-brief.md` decision #28.

**Override 3 (project detail embed, T45, 2026-06-03). RETIRED at T46.** `app/projects/[slug]/page.tsx` was deleted with the redesign, so there is no project detail page and no embedded post body. `post_id` survives and changed job: it now resolves a project card's "Writeup" action to the linked post's own page at `/writing/<slug>`. `app/projects/page.tsx` loads the published post list once alongside the projects, indexes it by id, and maps `post_id` to a slug in one pass, so the resolution cost is one extra query regardless of how many projects link a writeup. A project whose linked post is no longer published simply falls out of the map and its card renders without a Writeup action, rather than linking to a 404. No new RLS policy: the existing row-level `projects_*` policies cover the column, and only published posts enter the map. Historical rationale is `founder-brief.md` decision #32.

**Admin manual reorder (T44, 2026-06-03).** `sort_order` (above) backs admin drag-reorder for both `projects` and `posts`. Persistence goes through a `SECURITY INVOKER` RPC (`save_project_order` / `save_post_order`, migration 012a) that takes an ordered array of ids and writes 0-based positions back into `sort_order` in one transaction; callers supply display order only, never `sort_order` itself. Writes are gated by the existing `*_admin_all` (authenticated) policies — no new RLS. A reorder is a plain UPDATE, so the migration 001 `set_updated_at` trigger bumps `updated_at` (@cto decision, T44.A). Server Actions: `saveProjectOrder` / `savePostOrder`. See `founder-brief.md` decision #33.

### 2.2 `posts`

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `title` | `text` | NOT NULL, length ≤ 200 |
| `slug` | `text` | NOT NULL, UNIQUE |
| `content` | `text` | NOT NULL — raw Markdown |
| `status` | `post_status` enum | NOT NULL, default `'draft'`. Values: `'draft'`, `'published'` |
| `image_id` | `uuid` | NULL, FK → `images.id` ON DELETE SET NULL |
| `sort_order` | `integer` | NOT NULL, CHECK `(sort_order >= 0)` — admin-controlled manual order; same backfill + append-on-insert trigger semantics as `projects.sort_order` (migration 012) |
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
| `aside` | `text` | NULL, CHECK `aside is null or length(btrim(aside)) between 1 and 160`. The small italic line under the tile label. Optional, and capped so it stays a quip rather than a paragraph (migration 014) |
| `sort_order` | `integer` | NOT NULL, CHECK `stats_sort_order_non_negative` `(sort_order >= 0)`. Deterministic display order for the numeric tiles (migration 014). **No column default** — the `default 0` from 014 was dropped in migration 016 and a `BEFORE INSERT` trigger now appends new rows to the end (`coalesce(max(sort_order) + 1, 0)`) when no explicit value is supplied |
| `created_at` | `timestamptz` | NOT NULL, default `now()` |

**Indexes:** `(category, created_at DESC)` from migration 001; `stats_sort_order_idx` on `(sort_order, created_at DESC)` added in migration 014 to serve the ordered public read. Append-only: no UPDATE policy, no DELETE policy for any role except `authenticated` (the admin).

**Read ordering (T46).** `getStatsByCategory` was removed and replaced by `getOrderedStats()` in `lib/db.ts`, which returns a flat `Stat[]` ordered by `sort_order` ASC with `created_at` DESC as a deterministic tiebreaker. The redesigned Other page is a fixed tile grid in a deliberate sequence; the old grouped read ordered alphabetically by `category`, an open-ended string that OpenClaw writes, so it could not express "these four tiles, in this order". Ordering now matches the `projects` / `posts` convention from T44. `category` is still a column and still absorbs new stat kinds without a migration per §2.3's schema rationale; it just no longer drives display grouping.

**Append-on-insert `sort_order` (migration 016, audit 24b).** `stats.sort_order` and `notes.sort_order` now follow the `projects` / `posts` convention from migration 012: no column default, a `SECURITY INVOKER` `BEFORE INSERT` trigger (`stats_set_sort_order_default` / `notes_set_sort_order_default`, `SET search_path = ''`) that fires only when `new.sort_order IS NULL` and sets `coalesce((select max(sort_order) + 1 from public.<table>), 0)`. The columns stay `NOT NULL`; the trigger populates the value before the constraint is checked.

Migration 014 had shipped both columns as `not null default 0`, so every insert that did not name a position landed at 0, all rows tied, and display order collapsed onto the `created_at DESC` tiebreaker. **Dropping the column default is the load-bearing half of the fix, not housekeeping:** a column DEFAULT is applied *before* `BEFORE INSERT` triggers run, so a 012-style trigger added on top of `default 0` would never see a NULL and would be dead code. Both tables were empty at apply time, so no backfill was needed.

**Deploy order (DB first).** Migration 016 is safe to apply ahead of the application change, and must be. The then-deployed admin code always sent a concrete `sort_order`, which the trigger leaves untouched; shipping the app first — omitting the key so the trigger could compute it — would have sent NULL into a still-`NOT NULL` column with no trigger behind it. Any future "let the database compute this" change inherits the same ordering rule.

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

**Storage bucket path scheme:** `images/{projects|posts}/{parent_id}/{uuid}_{filename}`. The 2 MB size cap and the JPEG/PNG/WebP MIME allowlist are enforced at three layers: client-side at upload, the `lib/admin-images-mutations-types.ts` constants (`MAX_FILE_BYTES`, `ALLOWED_MIME_TYPES`), and the `images` bucket itself. The bucket-level limits are codified in `supabase/migrations/008_storage_images_limits.sql` (F-30, security audit 16) — that migration is now the source of truth and supersedes the "configured by hand in the Supabase Dashboard" note at the tail of `supabase/migrations/005_rls_images.sql` (left unedited because applied migrations are immutable). **Founder Brief:** "Image data layer" and "Image-bucket limits codified in migration 008" in [`founder-brief.md`](founder-brief.md).

**Orphan cleanup (T27):** `images` row is "orphaned" when both `parent_id IS NULL` and `parent_type IS NULL`. The admin "Clean orphans" button at `/admin/images` deletes orphans where `created_at < now() - interval '7 days'` from both the table and the Storage bucket. The 7-day grace period is a named constant: `const ORPHAN_CLEANUP_THRESHOLD_DAYS = 7;` in `lib/admin-images-cleanup.ts` (CQ-04). Order is **DB-first then Storage-remove** — inverted from the upload-side compensating-delete invariant — because the failure-mode trade-off is different: a failed Storage remove on cleanup leaves a true orphan storage object whose row pointer is already gone (acceptable, loud-logged with bucket paths so a human can reconcile), whereas a failed DB delete with the Storage object already gone would leave a row pointing at nothing (bad UX in any subsequent listing). Re-running the sweep is idempotent on the storage side because the rows no longer exist to be re-listed.

**Storage-layer RLS (migration 007).** `storage.objects` carries its own RLS layer separate from the `public.images` table; migration 007 (`supabase/migrations/007_rls_storage_images.sql`) installs `images_storage_admin_all` (FOR ALL on `authenticated`, USING and WITH CHECK both `bucket_id = 'images'`). This is the Storage analogue of the per-table `*_admin_all` policies and must accompany every Supabase Storage bucket in use — see CONSTRAINT-20. Migration 005 created the `images` bucket but deferred the policy work; the deferred work was forgotten and only surfaced at T28's first end-to-end upload. **Diagnostic anchor:** the Supabase JS SDK strips the `for table "X"` suffix from RLS error messages, so a `storage.objects` denial surfaces as `'new row violates row-level security policy'` indistinguishable from a `public.{table}` denial. When debugging, read raw Postgres logs via the Supabase MCP `mcp__supabase__get_logs` (which preserves the `for table "objects"` clause) or query `pg_policies` directly to confirm which layer is denying.

### 2.5 `project_media`

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `project_id` | `uuid` | NOT NULL, FK → `projects.id` ON DELETE CASCADE |
| `image_id` | `uuid` | NOT NULL, FK → `images.id` ON DELETE RESTRICT — the primary image when `image_after_id` is NULL, or the "before" image when `image_after_id` is non-NULL |
| `image_after_id` | `uuid` | NULL, FK → `images.id` ON DELETE RESTRICT — when non-NULL, this row renders as a before/after pair via `BeforeAfterMedia`; when NULL, the row renders as a single image |
| `caption` | `text` | NULL, CHECK `caption is null or char_length(caption) <= 280` — plain text, NOT Markdown (rendered as text content, never `dangerouslySetInnerHTML`; carve-out at PRD §7.2) |
| `order_index` | `integer` | NOT NULL, CHECK `order_index >= 0` — derived by the `save_project_media` RPC from array position via `WITH ORDINALITY`, not trusted from the client |
| `created_at` | `timestamptz` | NOT NULL, default `now()` |

**Shape discriminator.** `project_media` carries no explicit `kind` enum column. A row is a "single" when `image_after_id IS NULL` and a "pair" when `image_after_id` is non-NULL; the public render path branches on this nullability. Keeping the discriminator implicit in FK nullability avoids a redundant column that could disagree with FK presence, and removes the need for a synchronizing CHECK constraint to keep `kind` and `image_after_id` consistent. **T46 note:** the branch moved. `ProjectMedia.tsx` and `ProjectMediaCarouselParts.tsx` were deleted; `toSlides()` in `components/public/ProjectFrame.tsx` now flattens each row into one slide, or two when `imageAfterUrl` is present. The pair is presented as two sequential slides rather than a draggable before/after slider.

**Image FK delete semantics.** Both `image_id` and `image_after_id` use `ON DELETE RESTRICT` — deleting an `images` row still referenced by any `project_media` row raises an error. This is the inverse of the legacy `projects.image_id` / `projects.image_after_id` columns (migrations 001 + 009), which use `ON DELETE SET NULL`. The RESTRICT posture here makes media-row removal explicit: the admin must delete the `project_media` row first, which releases the FK and lets the image be cleaned. This protects published carousel slides from silent breakage during orphan cleanup at `/admin/images` (T27).

**Indexes:** compound `(project_id, order_index)` for the ordered public-listing query (`project_media_project_order_idx`). No unique constraint on `(project_id, order_index)` — ordering is rebuilt atomically by the `save_project_media` RPC each save, not maintained incrementally.

**Row-cap trigger (`project_media_rowcap_trigger`):** fires `BEFORE INSERT OR UPDATE OF project_id` and raises an exception when the count of existing rows for the same `project_id` is `>= 20`. Triggering on `UPDATE OF project_id` (in addition to INSERT) closes the move-row-between-projects bypass — a direct `update project_media set project_id = '<B>' where ...` against a project B already at the cap would otherwise sidestep the limit. PostgreSQL CHECK constraints are per-row, not per-FK-count, so the trigger is the canonical guard. Zod schema in `lib/admin-project-media-mutations-schemas.ts` enforces the same `<=20` cap as a defense layer above it.

**Pair distinctness:** CHECK constraint `project_media_before_after_distinct` — `image_after_id is null or image_after_id <> image_id`. A pair's before and after must be different images; a single (where `image_after_id IS NULL`) is unconstrained against `image_id` by definition.

**RLS (migration 010).** `project_media_admin_all` (authenticated, FOR ALL, USING + WITH CHECK both `true`) and `project_media_public_select` (anon, FOR SELECT, USING `exists (select 1 from public.projects p where p.id = public.project_media.project_id and p.status = 'published')`). The public-read policy re-resolves the parent's published status at query time, so a forged `project_id` cannot read an unpublished project's media via the anon role.

**Atomic save surface.** Writes go through the Server Action `saveProjectMedia(projectId, mediaRows[])` (one Server Action, atomic, via the `save_project_media(uuid, jsonb)` RPC defined in migration `010a`). The RPC does delete-then-insert-all inside a single Postgres transaction — see §6.6.9 for the RPC conventions established here and binding for future atomic-save surfaces.

**Storage bucket.** Reuses the existing `images` bucket per §2.4. No new bucket, no new `storage.objects` policy — CONSTRAINT-20 is N/A for migrations 010 / 010a. Storage-object access for media images is already gated by the `images` table's parent-published-status policy from migration 007.

**Public render surface.** The carousel that renders these rows is documented in §4.9. The schema is content-model; the carousel is the visual surface. **T46 note:** the schema is unchanged, but its consumer was replaced. Override 2 is retired and the carousel is hand-rolled, so CONSTRAINT-22 no longer has a consumer here; the rule itself still stands for the next library anyone proposes.

**Founder Brief:** entries 30 (atomic save, RPC pattern) and 34 (T46 redesign) in [`founder-brief.md`](founder-brief.md). Entries 29 and 31 record the retired embla decision and are historical.

### 2.6 `notes`

Added at T46 by migration `014_other_page_model.sql`. Backs the three text tiles on the Other page ("currently watching / reading / goal").

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `kicker` | `text` | NOT NULL, CHECK `length(btrim(kicker)) between 1 and 40`. The small label above the line |
| `line` | `text` | NOT NULL, CHECK `length(btrim(line)) between 1 and 120`. The tile's one sentence |
| `sort_order` | `integer` | NOT NULL, CHECK `notes_sort_order_non_negative` `(sort_order >= 0)`. **No column default** — the `default 0` from 014 was dropped in migration 016 and a `BEFORE INSERT` trigger appends new rows to the end; see the "Append-on-insert `sort_order`" note under §2.3 |
| `created_at` | `timestamptz` | NOT NULL, default `now()` |
| `updated_at` | `timestamptz` | NOT NULL, default `now()`, trigger on update |

**Indexes:** `notes_sort_order_idx` on `(sort_order, created_at DESC)`, mirroring `stats_sort_order_idx`.

**Triggers:** `notes_set_updated_at` (BEFORE UPDATE, per row) reuses the shared `public.set_updated_at()` function defined in migration 001 — no new function was written. `notes_set_sort_order_default` (BEFORE INSERT, per row, migration 016) is the append-on-insert trigger described under §2.3.

**RLS (migration 014).** `notes_public_select` (anon, FOR SELECT, USING `true`) and `notes_admin_all` (authenticated, FOR ALL, USING + WITH CHECK both `true`). Every note is public the moment it is written; there is no draft state, matching `stats` rather than `projects` / `posts`. `service_role` is deliberately not granted a policy: it bypasses RLS by definition, so adding one would be redundant and a footgun. RLS for `notes` is bundled into the same file as the table definition, following the migration 010 convention rather than the 002 through 005 split-file one.

**Not reachable by OpenClaw.** The `stats-ingest` Edge Function writes `stats` only. `notes` is admin-authored through the panel. This keeps CONSTRAINT-04's programmatic write surface as narrow as it was before the table existed.

**Why a separate table and not more `stats` rows.** A note is a kicker plus a line. It has no number, no unit and no category, so forcing it into `stats` would mean three NULL columns per row plus an implicit convention distinguishing "stat with a null value" from a real stat. A four-column table is cheaper than that convention and cannot be misread.

**Read path.** `getNotes()` in `lib/db.ts` returns an ordered `Note[]` using the same contract as `getOrderedStats`: `sort_order` ASC, `created_at` DESC as tiebreaker. `app/other/page.tsx` loads stats and notes in parallel, each behind its own `safeLoad` call, so one failing query degrades half the grid instead of blanking the page. Admin CRUD follows the established per-resource split: `lib/admin-queries-notes.ts` plus the `lib/admin-notes-mutations-{types,internal,schemas,}.ts` family (§6.6.6, §6.6.8).

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

**T46 read-surface changes.** `getStatsByCategory` was removed; `getOrderedStats()` and `getNotes()` replace it (§2.3, §2.6). `lib/post-summary.ts` was added with two pure helpers, `formatPostDate(createdAt)` and `excerptFromContent(content, maxChars = 180)`. The redesigned writing list shows a date string and a short excerpt per row; both are derived at render time from the `created_at` and `content` columns the `posts` table already has, rather than adding a `published_on` or `excerpt` column. The derivation is cheap, has no second source of truth to drift from, and needs no admin field or migration. If either ever needs to be authored by hand rather than derived, that is the point to add a column.

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
│   ├── layout.tsx                    # root layout: next/font on <html>, public CSS, no Tailwind
│   ├── page.tsx                      # Home
│   ├── projects/page.tsx             # no [slug] route, deleted at T46
│   ├── writing/page.tsx
│   ├── writing/[slug]/page.tsx
│   ├── other/page.tsx
│   ├── styles/                       # CSS files for the public site + admin
│   │   ├── colors_and_type.css       # public design tokens, imported by root layout
│   │   ├── base.css                  # public site base, imported by root layout
│   │   ├── public.css                # shared public shell (T46)
│   │   ├── public-home.css           # per-page sheets, each with its own 640px block (T46)
│   │   ├── public-projects.css
│   │   ├── public-writing.css
│   │   ├── public-other.css
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
│   ├── public/                       # one responsive tree, no mobile/ fork (T46)
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
│   ├── db.ts                         # public reads
│   ├── post-summary.ts               # formatPostDate + excerptFromContent (T46)
│   ├── admin-queries.ts              # admin reads — thin barrel re-exporting the per-resource modules (T37; see §6.6.8)
│   ├── admin-queries-{projects,posts,stats}.ts  # admin reads, split per resource (T37)
│   ├── admin-{projects,posts,stats}-mutations.ts  # admin writes (per-resource Server Actions; see §6.6.6)
│   ├── admin-{projects,posts,stats}-mutations-internal.ts  # throwing helpers (no 'use server')
│   ├── admin-{projects,posts,stats}-mutations-types.ts     # client-safe envelopes
│   ├── markdown.ts                   # marked + DOMPurify whitelist
│   ├── auth.ts                       # Server Action entry points (e.g., `signInWithMagicLink`)
│   ├── auth-internal.ts              # non-'use server' helpers (throwing, timing-sensitive)
│   ├── session.ts                    # assertAdminSession — no directive, deliberately (§6.6.10)
│   └── images.ts                     # Storage URL helpers
├── supabase/
│   ├── migrations/                   # SQL migrations, sequentially numbered
│   └── functions/
│       └── stats-ingest/index.ts     # Edge Function
├── middleware.ts                     # Next.js middleware: admin auth gate only (T46)
└── public/                           # static assets
```

### 4.2 Tailwind scoping (Decision 3 — resolves ASSUMPTION-04)

Tailwind is imported in exactly one place: `app/styles/admin.css`, which is in turn imported only by `app/(admin)/layout.tsx`. The plugin `tailwindcss-scoped-preflight` wraps Tailwind's Preflight reset under the `.admin-root` selector. Every admin page renders inside `<div className="admin-root">...</div>`.

The Tailwind config's `content` glob includes only `./app/(admin)/**/*` and `./components/admin/**/*` and `./components/ui/**/*`. Public components are excluded. The public bundle never sees a Tailwind utility class, and the Preflight reset never reaches public route HTML.

**Color token namespacing.** The admin uses an eight-token namespaced palette: 4 brand tokens (`--admin-bg`, `--admin-surface`, `--admin-fg`, `--admin-accent`) and 4 semantic tokens (`--admin-destructive`, `--admin-destructive-fg`, `--admin-border`, `--admin-muted-fg`). The semantic tokens map to shadcn slots (destructive, border, input, muted-foreground); the 3 sourced-from-public tokens match public-palette hexes verbatim (`--danger`, `--hairline`, `--fg-muted`) for brand coherence. The `--admin-*` prefix prevents cascade collisions if the public site's `:root` token definitions ever leak into the admin subtree (or vice versa). Tailwind config maps all 19 shadcn slots to these tokens, so utility class names (`bg-bg`, `text-fg`, `border-border`) stay clean in admin code — see CONSTRAINT-16 for the full slot table. Locked T15 — see Founder Brief #4 (Admin CSS token namespacing).

**Declaration site — `:root`, not `.admin-root` (amended 2026-05-19).** All eight `--admin-*` custom properties are declared at `:root` in `app/styles/admin.css`. The dark visual chrome — `background-color`, `color`, `font-family`, `min-height` — stays on the `.admin-root` selector, so the admin theme remains visually scoped to admin routes. Token NAMES and VALUES are unchanged from CONSTRAINT-16; only the DECLARATION SITE moved.

Why: Radix UI primitives (`Select`, `DropdownMenu`, `Popover`, `Tooltip`) render overlay content via `Portal` at `document.body` — outside the `.admin-root` subtree. CSS custom properties are scope-bound to the selector they are declared on, so popover utilities like `bg-popover` resolved to undefined when the overlay escaped `.admin-root`, producing transparent menus. Declaring the variables at `:root` makes them resolvable everywhere in the document. The variables are inert until referenced — the public site does not use any `--admin-*`-mapped utilities (Tailwind is admin-only per §4.2 above), so this is invisible on the public bundle.

Reverting the declaration back to `.admin-root` will re-break every Radix portal overlay in admin. Do not move the tokens back without first solving portal-resolvability another way (e.g., a portal target inside `.admin-root`, or token re-declaration on each Radix `Content` component).

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

**Admin segment error boundary — `app/(admin)/error.tsx` (added 2026-05-19).** The admin route group has a Next.js error boundary that catches any uncaught render-time throw from an admin Server Component or Client Component and renders a LOUD failure surface — `error.message` and `error.digest` are shown verbatim, with a `reset()`-wired retry button. There is no swallowed-error path: the boundary does not mask the failure behind a generic "Something went wrong" copy, per the LOUD-failure rule. The operator sees what broke immediately; the same error is also written to Vercel Runtime Logs by Next.js for post-hoc inspection.

**Founder Brief:** "UI-boundary error handling" in [`founder-brief.md`](founder-brief.md).

### 4.5 Server / Client prop boundary — `Nav` / `MobileNav` (retired at T46)

> **Retired.** `Nav` and `MobileNav` were deleted with the rest of the old component tree. Navigation is now `components/public/SiteHeader.tsx`, a single `'use client'` component that holds its own `NAV_ITEMS` array of plain `href` strings, renders `next/link` elements directly, and derives the active section from `usePathname()`. No caller passes link targets in at all, so the dual-prop dance below has no remaining consumer. `lib/nav-targets.ts` still exists in the tree but is no longer imported by anything.
>
> The underlying RSC rule is unchanged and still binding, which is why this section is kept rather than deleted: a Server Component cannot hand a function prop to a Client Component. Any future component that must accept link targets from both a Server Component page and a Client Component parent needs the same plain-data escape hatch.

Next.js 15 RSC forbids passing function props from a Server Component to a Client Component (`Event handlers cannot be passed to Client Component props.`). `Nav` and `MobileNav` were `'use client'` components used by both Server Component detail pages and Client Component list-render components.

Both Nav components accepted two parallel ways to specify link targets:

| Prop | Type | Caller boundary | Use when |
|---|---|---|---|
| `hrefs?: Record<string, string>` | plain data | Server Component OK | Detail pages pass `hrefs={NAV_PATHS}` (exported as a static const from `lib/nav-targets.ts`). |
| `resolveHref?: (id: string) => string` | function | Client Component only | List-render components pass `resolveHref={resolveNavPath}`. |
| `onNav?: (target: string) => void` | function | Client Component only | When SPA navigation via `router.push` is desired. Detail pages do NOT pass this — they let the browser navigate via the `href`. |

`hrefs` takes precedence over `resolveHref`. When neither is passed, the default `() => '#'` preserves byte-identical bundle render per CONSTRAINT-05's additive-prop carve-out.

**Founder Brief:** "Server-safe Nav props" in [`founder-brief.md`](founder-brief.md).

### 4.6 Image read pattern

Image IDs are resolved to signed Storage URLs on the server, at request time, before any markup is rendered. The pipeline (revised at T46):

1. Page (Server Component) calls a loader inside `safeLoad` (CONSTRAINT-14): `loadPublicProjects()` from `lib/public-projects.ts` for the projects list, `getPostBySlug` for a writing post.
2. The loader calls `getImageById(imageId)` to resolve the `images` row, then `getImageUrl(bucket_path)` for a signed URL with TTL 3600s, and attaches the result to the render-ready shape (`PublicProject.imageUrl` / `imageAfterUrl` / `media[]`).
3. The page hands the pre-signed shape to the client components (`ProjectCard`, `ProjectFrame`), which never touch the DB or Storage.
4. Resolution failures are isolated per row: a failed URL becomes `null` and is logged with project id and column name, but the row still renders without its image. Visitors never see a broken-image icon (EH-04).

**T46 change.** This used to run through per-image async Server Components, `<ProjectImage>` and `<PostImage>`, which each did their own `getImageById` + `getImageUrl` call at render time. Those components were deleted with the old component tree; the work moved up into the loader. CONSTRAINT-15 is unchanged (signed URLs only, TTL 3600s, centralized in `lib/images.ts::getImageUrl`); only the caller moved. Doing the resolution in one place also makes the per-row failure isolation explicit rather than a property of where the component happened to sit.

**Why server-side resolution, not client fetching:**
- SEO: search engines see the rendered `<img>` in the initial HTML.
- First paint: the URL is present at hydration, no extra round trip.
- `components/public/` is mostly `'use client'` for interactive UI (header, cards, carousel). Data loading is a different concern and a different runtime; keeping it above the client boundary means no component ever holds a Supabase client.

**Why signed URLs, not public:**
- The `images` bucket is private (migration `005_rls_images.sql`). Public URLs would 404. See CONSTRAINT-15.
- TTL 3600s: long enough for a typical reading session; short enough that a leaked URL expires quickly.

**Public surface (functions added in T13):**
- `getImageUrl(bucketPath: string, client?: SupabaseClient): Promise<string>` — `lib/images.ts`. Throws `ServiceError` on empty path or storage failure.
- `getImageById(id: string, client?: SupabaseClient): Promise<ImageRecord | null>` — `lib/db.ts`. Mirrors `getProjectBySlug` pattern (DI for tests, throws `ServiceError` on DB error).

**Tests:** Vitest + `@testing-library/react` for React component rendering. React 19 / Next 15 require testing-library v16+. See `tests/images.test.ts` and `tests/public-projects.test.ts` (`tests/ProjectImage.test.tsx` went with the component).

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

**Suite lifecycle (T47).** `playwright.config.ts` registers `tests/e2e/global-setup.ts` and `tests/e2e/global-teardown.ts`. Setup snapshots `projects.sort_order` before any test writes, then warms the routes the suite hits first. Teardown runs after the last test whether or not the run was green: it sweeps every fixture row and its Storage objects with a service-role client (`@supabase/supabase-js`, a devDependency — nothing here ships to the browser), restores the ordering from the snapshot, and verifies against a fresh read that nothing survived. It talks to Postgres directly rather than driving deletes through the admin UI because the suite writes to the production database (CONSTRAINT-02 — no staging project) and UI-driven cleanup left live rows behind on runs that reported green. A teardown failure fails the run. Both files execute in plain Node and must not import anything reaching `next/headers`.

**One worker, deliberately (T47).** `workers: 1` in `playwright.config.ts`. All eight spec files share a single `next dev` server; run in parallel they contend for it and the 20s per-step budgets in `admin-smoke.spec.ts` blow. The suite has never been verified green any other way, and serial is also faster here (1.7m vs 4.0m, measured Session 55). This subsumes the serial-mode requirement above at the config level; the per-spec `mode: 'serial'` declarations stay as the local statement of the constraint.

**Cross-references:** `tests/e2e/fixtures/auth.ts` (`loginAsAdmin()` helper), `tests/e2e/admin-logout.spec.ts` (consumer + serial-mode example), `tests/e2e/global-setup.ts` + `tests/e2e/global-teardown.ts` + `tests/e2e/fixtures/cleanup.ts` + `tests/e2e/fixtures/sort-order-snapshot.ts` (T47 lifecycle), `docs/plan-phase-2-admin.md` T19.2 (origin), `docs/founder-brief.md` entries 19 + 20.

### 4.9 Carousel surface: hand-rolled (T46)

> **Supersedes the previous §4.9 (Carousel surface, Override 2, T43).** Override 2 and its `embla-carousel-react` dependency are retired. The section below describes what ships now.

The project media carousel lives entirely in `components/public/ProjectFrame.tsx` (`'use client'`, no npm dependency). It imports `useRef` and `useState` from React and a type from `lib/types`, and nothing else.

**Mechanics.** A single track element is translated with `transform: translateX(-current * 100%)`, where `current` is a `useState` index. Navigation wraps modulo slide count. Dots (`.sb-dot`, one per slide, `aria-current` on the active one), previous / next arrows and a `n / total` counter render only when there is more than one slide. Touch handling is a `touchstart` / `touchend` delta with a named `SWIPE_THRESHOLD_PX = 40` constant; a smaller delta is treated as a tap and ignored. `toSlides(media)` flattens the `project_media` rows into the slide array, emitting two slides for a row that has an `imageAfterUrl` (§2.5).

**Why hand-rolled and not embla restyled.** The design export's carousel is a transformed track with dots and arrows and nothing else. Matching it directly was both more faithful to the export and one dependency fewer than importing a gesture engine and then suppressing most of what it does. The behaviors that justified embla at T43, drag physics, keyboard coordination, snap containment, are not present in the export's version, so paying 8 KB of route chunk for them bought nothing. `embla-carousel-react` and its two transitive packages were uninstalled. **The public site is back to zero runtime JS dependencies.**

**Public-site JS-library policy (CONSTRAINT-22) still applies.** Adding any runtime npm dependency to a public-site code path requires (a) a named Override entry in `design-decisions.md` with a Surface boundary listing every file the library touches, and (b) a build-time measurement showing the route-chunk delta on each affected production route stays at or under 15 KB gzip. Measurement source is `next build`'s First Load JS output on the route mounting the new code, not the published ESM size on npm: bundler tree-shaking and shared-chunk attribution make the published size a misleading proxy. Exceeding the budget escalates to `@cto`, not silent absorption. The constraint currently has zero consumers.

**Multi-instance safety.** `/projects` renders N project cards on one page, each mounting its own `ProjectFrame`. Every instance keeps its own `current` state and its accessibility wiring is label-based (`aria-label` referencing the project title) rather than id-based, so there are no cross-instance DOM id collisions to guard against. If a future change introduces an id-bearing attribute here, scope it per mount with `React.useId()`; a hardcoded id would collide on the second card and break screen-reader navigation for both.

**Client-component boundary.** Server Components above `ProjectFrame` pass already-resolved data: signed image URLs (TTL 3600s per CONSTRAINT-15), caption text, alt text and order. Nothing above the boundary reaches into the carousel's runtime state.

**Empty state.** A project with zero slides renders a `no preview yet` placeholder. There is no SVG-motif fallback: the motif set was deleted along with `thumb_kind` (§2.1). This makes a real screenshot a hard requirement for any project card that should look finished. See `founder-brief.md` entry 34.

**Cross-references:** `constraints.md` CONSTRAINT-05 (re-baselined) + CONSTRAINT-22 + `design-decisions.md` + §2.5 above (the schema the carousel renders) + §6.6.9 below (the atomic save RPC that still backs the admin write path).

### 4.10 Public render architecture: one responsive tree (T46)

**No device fork.** The `components/public/mobile/` tree is deleted, and with it the T10 `x-device-variant` header that `middleware.ts` set from the User-Agent. The public site is a single component tree with **one breakpoint at 640px**. Every public stylesheet carries its own `@media (max-width: 640px)` block; there is no second breakpoint anywhere.

Two components maintained in parallel is two places for a fix to land and one place for it to be forgotten, and server-side UA sniffing made every public response vary on a header, which is bad for caching and wrong at the edges of the UA string. The T46 design export is a single responsive layout, so the fork had nothing left to justify it.

**Middleware no longer runs on public requests.** The matcher narrowed from a catch-all negative lookahead to `['/admin/:path*']`. Middleware is now exactly the admin session gate (§6.2). That is one fewer edge invocation per public page view and removes a whole class of "did middleware do something to this response" question from public-route debugging.

**Stylesheet split.** Tokens live in `app/styles/colors_and_type.css`. Component classes are split across `app/styles/public.css` (the shared shell: header, nav, page frame) plus one sheet per page: `public-home.css`, `public-projects.css`, `public-writing.css`, `public-other.css`. Each page sheet owns its own responsive block, so a page's desktop and mobile rules sit next to each other in one file rather than in a shared bottom-of-file media query. All seven public sheets are imported by `app/layout.tsx`.

**Font variables go on `<html>`, not `<body>`.** `colors_and_type.css` composes `--font-serif`, `--font-sans` and `--font-mono` at `:root` from the three `next/font` variables. A CSS custom property is substituted where it is **declared**, not where it is used. With the `next/font` variable classes on `<body>`, the `--font-instrument-serif` and friends are not in scope at `:root`, so the composed families resolve to the guaranteed-invalid value, which silently invalidates every `font:` shorthand that references them. The site rendered entirely in Times New Roman with no error in the console. This was a real bug during the build, found and fixed by moving the classes to `<html>`. The comment in `app/layout.tsx` records it. Do not move them back.

**Palette inverted.** The public palette went from warm dark to light: `--bg` from `#1C1712` to `#F4F1EA` (warm cream), `--accent` from gold `#C9A84C` to deep green `#1F3D2F`. Admin deliberately stayed dark, so the four brand tokens in CONSTRAINT-16 are now admin-owned constants rather than values borrowed from the public palette, and must not be resynced to it. See §4.2 and the CONSTRAINT-16 T46 amendment.

**Routes.** `app/projects/[slug]/page.tsx` was deleted; `/writing/[slug]` is retained. A project card's "Writeup" action links to the linked post's own page (§2.1, Override 3 retirement note). The public route set is `/`, `/projects`, `/writing`, `/writing/[slug]`, `/other`.

**Remaining public components.** `SiteHeader`, `ProjectCard`, `ProjectFrame`, `MarkdownContent`, `home/SocialIcons`, and `pages/{Home,Projects,Writing,Other}`. Everything else formerly under `components/public/` was deleted: the entire `mobile/` tree (`MobileNav`, `MobileFooter`, `MobilePage`, `MobilePageTitle`, `MobileProjectCard`, `MobileProjectRow`, `mobile/pages/*`) plus `BeforeAfterMedia`, `BeforeAfterMediaScenes`, `DemoLoop`, `Footer`, `MorePointer`, `Nav`, `Page`, `PostImage`, `ProgressRing`, `ProjectImage`, `ProjectMedia`, `ProjectMediaCarousel`, `ProjectMediaCarouselParts`, `ProjectRow`, `ProjectThumb`, `SectionHead`, `SocialIcon`, `StatusPill`, `StillMedia`, `TweaksPanel`, `TypoIcon` and `Wordmark`. `lib/thumb-kinds.ts` went with them.

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

**Tables:** `projects`, `posts`, `stats`, `images`, `project_media`, `notes` — all with RLS enabled.
**Storage:** bucket `images` (private bucket — public read goes through signed URLs or RLS-checked policy). Max file size 2 MB and the JPEG/PNG/WebP MIME allowlist are codified in `supabase/migrations/008_storage_images_limits.sql` (see §2.4).
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
| `NEXT_PUBLIC_TWEAKS` | Vercel (preview only, never production) | yes (boolean) | Gated the tweaks panel. **Dead since T46:** `components/public/TweaksPanel.tsx` was deleted with the old component tree, so nothing reads this variable. Left documented rather than silently dropped; removing it from Vercel is a housekeeping item, not a code change |

`.env.example` lists every Next.js-runtime variable name with no values (SEC-01). The one exception is `STATS_INGEST_SECRET`: it is Edge-Function-only (read via `Deno.env.get`, never by the Next.js app), so it appears in `.env.example` only as a documented comment block — not as an assignable key — pointing at the Supabase secret-store lifecycle in `docs/openclaw-config.md`. Service role key is loaded only in server contexts; never imported in client components. `NEXT_PUBLIC_TWEAKS` is unset in production.

### 5.4 Reproducibility debt — operational unversioned config

The following operational configuration is NOT in version control and is tracked manually. A fresh project rebuild from `git clone` alone will not reproduce these settings; they must be re-applied by hand against the Supabase dashboard.

- **Supabase Auth — Site URL.** Set to the canonical apex per CONSTRAINT-21. Lives in the Supabase dashboard `Auth → URL Configuration`. Not tracked in any migration.
- **Supabase Auth — Redirect URL allowlist.** Magic-link callback origin(s). Lives in the Supabase dashboard `Auth → URL Configuration`. Not tracked in any migration.
- **Supabase Auth — Custom Magic Link email template.** The HTML/text body for the magic-link email. Lives in the Supabase dashboard `Auth → Email Templates → Magic Link`. Not tracked in any migration.

**Why this is debt, not design.** Supabase exposes these via the dashboard UI but has only partial CLI / declarative-config coverage as of 2026-05. The intended remediation is to adopt Supabase CLI-managed `config.toml` auth config, or `supabase functions deploy`-aligned config, once that surface stabilizes. Until then, the dashboard is the source of truth for these three settings and any rebuild needs to re-apply them by hand. Operationally low-risk because the project is single-environment (CONSTRAINT-02) — there is no staging/prod drift to manage, only a one-time re-apply on disaster recovery.

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
- `project_media_public_select`: role `anon`, FOR SELECT, USING an EXISTS check that re-resolves the parent project's `status='published'` at query time (migration 010; see §2.5).
- `project_media_admin_all`: role `authenticated`, FOR ALL, USING `true`, WITH CHECK `true`.

#### `notes`
- `notes_public_select`: role `anon`, FOR SELECT, USING `true` (notes are public, like stats; there is no draft state).
- `notes_admin_all`: role `authenticated`, FOR ALL, USING `true`, WITH CHECK `true`.
- **No policy for `service_role`,** deliberately: it bypasses RLS by definition. **No write path for OpenClaw:** the Edge Function writes `stats` only (CONSTRAINT-04).

#### Platform-side functions are in scope for the RPC grant idiom (migration 015, F-41)

`public.rls_auto_enable()` is Supabase platform infrastructure, not project authorship: it appears in no repo migration, `pg_proc` carries no creation timestamp so it cannot be dated, and it backs the `ensure_rls` event trigger that fires on `ddl_command_end` and switches row security on for every new table created in `public`. It is `SECURITY DEFINER` with `proconfig = ["search_path=pg_catalog"]`, and Supabase's default privileges had left `EXECUTE` granted to `public`, `anon` and `authenticated` — making a definer-privilege function reachable by an unauthenticated caller at `/rest/v1/rpc/rls_auto_enable`.

Migration `015_revoke_rls_auto_enable_execute.sql` revokes `EXECUTE` from all three, guarded by a `to_regprocedure` existence check so it is a no-op on an environment where the platform has not installed the function. Both the `public` revoke and the named `anon` / `authenticated` revokes are required — the same two-revoke rule as the project's own RPCs (§6.6.9, migrations 010a / 012a), because Supabase's bootstrap default privileges grant directly to those roles and that grant survives a revoke from `public`.

**Exploitability was nil and that is not the reason for the fix.** The body's first statement is `pg_event_trigger_ddl_commands()`, which raises outside a `ddl_command_end` context, so an RPC call to it does nothing. The fix is about not leaving a definer-privilege entry point internet-reachable: a future rewrite of that body would silently inherit an anon-callable definer path with no review step in between.

**The auto-enable behaviour is unaffected.** Postgres does not consult `EXECUTE` privilege when firing an event trigger — the function runs as part of the DDL transaction under the trigger's own ownership. Verified after apply: `proacl` reads `postgres=X | service_role=X`, a throwaway table created afterwards came back `relrowsecurity = true` and was dropped, and the Supabase security advisors went from 5 WARN to 3 (closing `anon_security_definer_function_executable` and `authenticated_security_definer_function_executable`).

**Forward rule:** platform-installed functions in `public` are inside the project's security surface even though no migration created them. Anything `SECURITY DEFINER` and `EXECUTE`-granted to `anon` or `authenticated` needs a justification or a revoke, regardless of who authored it.

### 6.2 Auth boundaries

- **Public routes** (`/`, `/projects`, `/writing`, `/writing/[slug]`, `/other`): no auth. Anon Supabase client. RLS is the only filter. Since T46 the middleware matcher is `['/admin/:path*']`, so middleware does not execute on these routes at all.
- **Admin routes** (`/admin/*`): middleware calls `supabase.auth.getUser()` and redirects to `/admin/login` when it errors or returns no user. `/admin/login` and `/admin/auth/callback` are ungated by exact-match (never prefix-match). The admin's email is enforced by the fact that there is exactly one user account; no role check is needed.
- **Admin mutations** (every Server Action that writes): `assertAdminSession()` at the top of the action body, independent of middleware. See §6.6.10.
- **Edge Function**: shared-secret header. Constant-time comparison (SEC-04 — timing attack mitigation).

**`getUser()`, not `getSession()` (F-40, audit 24b).** The middleware gate previously called `getSession()`, which decodes the SSR cookie and checks `exp` locally without verifying the JWT signature. A hand-forged cookie carrying a garbage-signed token with a future `exp` therefore passed the gate and rendered the admin shell — with no data, because PostgREST still rejected the unsigned JWT on every query, but with the page structure exposed. `getUser()` round-trips to Supabase and validates the token server-side. The cost is one auth round-trip per gated page load, which is the correct price for the only check standing in front of `/admin`. Do not swap it back for the local decode.

Admin allowlist is two-layer (`auth-flow.md` §3): the Supabase dashboard "Allow new users to sign up" is OFF (Layer 1), and `lib/auth-internal.ts::assertAllowlistedEmail` rejects any email != `ADMIN_ALLOWED_EMAIL` before invoking `signInWithOtp` (Layer 2). Callback route defense-in-depth (`app/(admin)/admin/auth/callback/route.ts`) re-checks the email post-`verifyOtp` so a session is never minted for a non-allowlisted user.

### 6.3 Threat model — top three

| # | Threat | Mitigation |
|---|---|---|
| 1 | XSS via untrusted Markdown in posts | DOMPurify whitelist (Section 7). Sanitization is applied at render time, every time. The DB stores raw Markdown, never HTML — meaning the sanitizer runs on every read, with no stored-HTML attack surface. |
| 2 | Unauthorized stat ingestion (spam or impersonation of OpenClaw) | Edge Function with shared secret. Constant-time comparison defeats timing oracles. Service role key is held only by the Edge Function runtime, never sent over the wire from a client. |
| 3 | Unauthorized admin access | Magic link auth (single account). Middleware verifies the token via `getUser()` and redirects anon requests on `/admin/*`. Every admin mutation Server Action additionally calls `assertAdminSession()` before it acts (§6.6.10) — middleware does not run on the Server Action dispatch path when the action ID is POSTed to a non-`/admin` URL. RLS remains the authoritative resource-level gate behind both. |

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

The middleware matcher does not cover `/api/*`. At the time of this finding the matcher was the negative-lookahead form `'/((?!api|_next/static|_next/image|favicon.ico).*)'`, which excluded `/api/*` explicitly; since T46 it is `['/admin/:path*']`, which excludes it by construction. Either way the conclusion below is unchanged, and the narrower matcher makes it more emphatic: nothing under `app/api/` is protected by middleware. No `/api/admin/*` routes exist today — the only route under `app/api/` is the `NODE_ENV`-gated test fixture `app/api/test/sign-in/route.ts` (§4.7), which self-protects via its own secret + env gates and is unreachable in production — but the natural growth path lands admin-only endpoints (image upload, batch operations, deletes) under `/api/admin/*`, where the middleware admin-gate would not run. To prevent silent bypass, every route handler added under `app/api/admin/**` MUST: (1) call `assertAdminSession()` from `lib/session.ts` at the top of the handler, before any business logic; (2) return `new Response(null, { status: 401 })` when it throws. **Amended at audit 24b:** this rule originally named `getServerSession()`, a boolean-ish presence check that has since been deleted from `lib/session.ts` (it had zero import sites and its JSDoc argued that a presence check was sufficient — reasoning now retired, F-39). `assertAdminSession()` is its throwing, signature-verifying replacement; see §6.6.10. Use the same uniform 401 across every admin API route — no body, no error detail — paralleling the SEC-09 redirect-uniformity contract that the page gate already satisfies. The alternative — tightening the middleware matcher to gate `/api/admin/*` directly — is acceptable but not preferred: per-handler protection keeps API routes self-protective and decouples them from the matcher's evolution. Document the choice when the first `/api/admin/*` route ships. **Code-review checklist:** any new file under `app/api/admin/**` must contain an `assertAdminSession()` call before any business logic. See `docs/security-report.md` audit-5 F-17 and audit-24b F-39.

#### 6.6.5 Build invariants (F-14, SEC-09)

Two invariants on the auth surface must hold across every build. Breaking either one is a security regression, not a refactor.

- **Server Action surface (F-14, audit pass 4):** every export of a `'use server'` module is a public Server Action with a stable hashed ID in the client bundle. After every build, `.next/server/server-reference-manifest.json` must list exactly the actions named in the test allowlist at `tests/server-actions-manifest.test.ts` — no more, no fewer. The allowlist is now nineteen IDs across eight modules: `signInWithMagicLink` (T17), `signOut` (T18), `createProject` / `updateProject` (T21), `deleteProject` (T22), `createPost` / `updatePost` / `deletePost` (T23), `insertStat` / `deleteStat` (T24), `updateStat` (T46), `uploadImage` (T26), `deleteOrphanImages` (T27), `saveProjectMedia` (T43), `saveProjectOrder` / `savePostOrder` (T44), and `createNote` / `updateNote` / `deleteNote` (T46, the `notes` admin CRUD from §2.6). Seventeen of the nineteen are admin mutations and carry the §6.6.10 auth guard; the two exceptions are `signInWithMagicLink` and `signOut` in `lib/auth.ts`. It stood at twelve across five modules through T27; each subsequent resource added its own module and its own entries. The fifth module is `lib/admin-images-mutations.ts`, which ships `uploadImage` and `deleteOrphanImages`; `uploadImage` shipped at T25 commit 2 but only entered the manifest at T26 when `ImageUpload.tsx` became imported by `ProjectForm` and `PostForm`, and `deleteOrphanImages` lands in the manifest at T27 when the `/admin/images` page renders `OrphanCleanup` (Next.js excludes Server Actions that are not reachable from any app/** route). The throwing helper for the orphan sweep lives in `lib/admin-images-cleanup.ts` (sibling to `lib/admin-images-orphan.ts`) — the cleanup-sweep concern is split from the orphan-on-swap concern under CQ-03 (single responsibility). Any PR that adds a new action ID without updating the test allowlist + auditing the new surface is a wire-level enumeration regression. See §6.6.1, §6.6.6, `docs/auth-flow.md` §2a point 4, `docs/security-report.md` audit-4 F-14 and audit-5 F-14a/c/d.
- **Middleware uniformity (SEC-09, audit pass 5):** every middleware redirect outcome on the admin auth gate must pad to `MIN_DURATION_MS = 750` and write zero `Set-Cookie` headers. Tests S1–S5 in `tests/middleware.test.ts` enforce this contract across the no-session, Supabase-error, and helper-throw branches; do not relax them without re-running `@security`. See `docs/security-report.md` audit-5 "Six-channel SEC-09 uniformity".

#### 6.6.6 Admin mutation surface — three-module file split, per resource

The mutation surface for admin CRUD splits into three modules **per resource family** (projects, posts, stats, images) because the client-side form must import the response-state shape without transitively pulling `next/headers`. Using projects as the worked example:

- **`lib/admin-projects-mutations-types.ts`** — pure types and consts. Exports the `ProjectMutationState` envelope (`{ status: 'idle' | 'ok' | 'error'; fieldErrors?; formError? }`) and the initial state. No runtime imports of Supabase, zod, or `next/headers`. Safe to import from `'use client'` components. This is the file that crosses the client/server boundary at the type level. The cross-resource `GENERIC_FORM_ERROR` string lives in `lib/auth-constants.ts` (single source of truth — wire copy must remain identical across resources to prevent enumeration via copy differences).
- **`lib/admin-projects-mutations-internal.ts`** — server-only helpers that may throw. Exports `createProjectInternal`, `updateProjectInternal`, `deleteProjectInternal`, the zod schemas, and the operation tags used in structured logs. NO `'use server'` directive — these are regular ES module functions, not Server Actions. Imports the Supabase server client and is therefore poisoned by `next/headers`; never import this module from a client component.
- **`lib/admin-projects-mutations.ts`** — `'use server'` directive. Exports ONLY the public Server Action entry points (`createProject`, `updateProject`, `deleteProject`). Each wrapper applies the four-channel uniformity contract: `try/finally` with `MIN_DURATION_MS = 750` floor (Channel 3), `try/catch` that converts `ZodError` to `fieldErrors` and any other throw to a generic `formError` (Channels 1, 2), no rethrow to the wire (Channel 6), no `Set-Cookie` writes (Channel 5). The first statement inside that `try` is `await assertAdminSession()` (§6.6.10). Every export here lands a stable hashed action ID in `.next/server/server-reference-manifest.json` (§6.6.5).

Posts, stats, notes, images, project-media and reorder follow the same shape. The trio has grown a fourth and, on projects, a fifth member as individual wrappers crossed CQ-02's 300-line budget; the split axis is always single responsibility, never line-count-driven code shuffling:

- **`-schemas.ts`** — the zod schemas and their derived types, lifted out of `-internal.ts`. Present on projects, stats, notes, project-media and reorder. `lib/admin-stats-mutations-schemas.ts` was extracted at audit 24b (321 → 238 + 114 lines), which brings stats onto the same four-file shape the notes surface already had.
- **`-formdata.ts`** — the `FormData` field readers and the `ZodError` → `fieldErrors` mapper, lifted out of the wrapper. Projects only, extracted at audit 24b: the wrapper had shipped over the 300-line cap at 309 during T46 and the auth guard pushed it to 319 (176 + 198 after the split). Extract this only when a wrapper's parsing bulk is what breaches the budget — the wrapper file itself must stay a list of Server Action entry points, so parsing helpers are the correct thing to move out and the entry points are not.

The form component for each resource (`components/admin/ProjectForm.tsx`, `PostForm.tsx`, `StatsInsertForm.tsx`) is `'use client'`, imports types from its sibling `-types.ts` only, and receives Server Action references via Next 15's transform — no runtime import of the wrapper module is needed on the client. `useActionState` threads the state envelope.

Why three files and not the two-file split from §6.6.1: the auth flow's client surface (`LoginForm`) never imports anything from `lib/auth-internal.ts` or `lib/auth.ts` at the type level — the form is fully ignorant of the action's return shape because magic-link auth returns `void`. Mutations are different: the form has to react to `fieldErrors` and `formError`, which requires importing the shape from somewhere. A two-file split (types co-located with internal helpers) breaks the build with `You're importing a component that needs "next/headers"` because the client component transitively pulls the Supabase server client. Pushing the types into `lib/types.ts` would pollute the domain-types module with admin-only UI state. The third file is the cleanest boundary — and it is binding for every future admin mutation task.

**Why per-resource and not shared (T25 evolution)** — the shared trio crossed CQ-02's 300-line service-file budget at T24 (admin-mutations.ts = 519, admin-mutations-internal.ts = 687); per-resource modules also reduce blast radius for future mutations, isolate test mocks, and decouple the slug-lock policy (projects/posts) from the schemaless write path (stats) and the file-handling path (images, T25).

**Code-review checklist:** any new `'use server'` admin mutation module must (1) keep its file scope to public Server Action wrappers only — no exported helpers, types, or consts; (2) import types from a `-types` sibling; (3) wrap the internal helper in the four-channel contract; (4) call `await assertAdminSession()` as the first statement inside that `try`, in every exported action (§6.6.10); (5) update `tests/server-actions-manifest.test.ts` in the same PR; (6) live in its own per-resource family — do NOT add a new mutation to a sibling resource's `-mutations.ts`. New resources get a new family.

#### 6.6.7 `useActionState` dispatch from inside a parent form

When a Server Action must dispatch from inside an existing parent `<form>` — e.g., an image upload widget embedded inside `ProjectForm` / `PostForm` — the inner client component CANNOT wrap itself in another `<form>`. HTML disallows nested forms; the browser silently drops the inner form and the outer form's submit handler intercepts everything, breaking the inner action. The pattern is:

- Render the inner component as `<div>` (NOT `<form action={...}>`).
- Trigger button is `<button type="button" onClick={handleUpload}>` (NOT `type="submit"`).
- `handleUpload` constructs `FormData` from refs / state and calls `startTransition(() => dispatch(formData))`.
- The `useActionState` envelope is preserved unchanged: `const [state, dispatch, isPending] = useActionState(action, INITIAL_STATE)`. Wrapping the dispatch in a `useTransition` is required for `isPending` to track the in-flight Server Action when called outside a `<form action>` binding.

The Server Action wrapper itself is byte-identical to the form-bound case — same wire shape, same RSC dispatch path, same six-channel uniformity contract. The fix is a client-side composition refactor only.

**Reference implementation:** `components/admin/ImageUpload.tsx`. **Regression pin:** `tests/ImageUpload.test.tsx` — the "renders no <form> element" test asserts `container.querySelector('form')` is `null`. **Origin:** BLOCKING-01 from T28's first smoke run, 2026-05-14 — surfaced because T15-T27 mocked the dispatch path in unit tests, so the nested-form bug only triggered against a real browser.

#### 6.6.8 Admin query surface — per-resource split + shared query-error helper (T37, CQ-02/CQ-07)

The admin read surface mirrors the per-resource decomposition of the mutation surface (§6.6.6), for the same reason: at T37 the single `lib/admin-queries.ts` had grown to 364 lines, over CQ-02's 300-line service-file budget. It was split into per-resource modules and `lib/admin-queries.ts` was retained as a thin re-export barrel at the original path, so no consumer import changed:

- **`lib/admin-queries-projects.ts`** — `ProjectFilter`, `ProjectRow`, `getAllProjects`, `getProjectById`.
- **`lib/admin-queries-posts.ts`** — `PostFilter`, `PostRow`, `getAllPosts`, `getPostById`.
- **`lib/admin-queries-stats.ts`** — `getAllStats`.
- **`lib/admin-queries.ts`** — barrel only; re-exports the symbols above. No logic.

The per-module structured-log helpers were duplicated across the three (a CQ-07 DRY violation). They were collapsed into a single `logQueryError(operation, error)` in `lib/admin-mutation-log.ts` — the same module that owns the mutation-side `logMutationError` — and imported by each query module. Admin reads do not route through `lib/safe-load.ts` (that boundary is public-Server-Component-only, EH-01); admin query failures are surfaced loud to the operator via `logQueryError` and an empty/typed result, not silently swallowed.

**Code-review checklist:** a new admin resource gets its own `admin-queries-<resource>.ts`; the barrel re-exports it; query-error logging goes through `logQueryError` — do not reintroduce per-module copies.

#### 6.6.9 Atomic save surface — Postgres RPC pattern

When a Server Action must atomically replace a child collection for one parent (delete-all-then-insert-all), wrap both statements in a single Postgres function call rather than running them sequentially from the application layer with a try/catch rollback. The application-layer "sequential delete then insert with rollback-on-error" approach has more failure modes — a Node crash between the two statements, a connection drop after the DELETE commits but before the INSERT issues, a partial INSERT that leaves the rollback compensating-delete to also fail — than wrapping both statements in one server-side transaction. Option A (RPC) is the preferred pattern. Option B (sequential with app-rollback) is acceptable only when the RPC route adds genuine schema cost — e.g., complex parameter shapes that don't translate cleanly to a `jsonb` payload, or callers that genuinely need per-statement progress reporting.

T43.E (`save_project_media` RPC) is the project's first instance of this pattern. Conventions established by it, binding for future RPCs of this kind:

- `LANGUAGE plpgsql`.
- `SECURITY INVOKER` — the function runs with the caller's role, so the table's existing admin RLS policy gates both the DELETE and the INSERT exactly as it would for direct table writes. No `SECURITY DEFINER` unless there is a specific reason to elevate; defaulting to `INVOKER` keeps RLS the single source of truth.
- `SET search_path = ''` with every reference qualified `public.*` (Supabase advisor `0011_function_search_path_mutable`).
- `EXECUTE` revoked from both `public` and `anon`, then granted only to `authenticated`. Supabase's project-bootstrap default-privileges run `grant execute ... to anon, authenticated, service_role` on every new function in `public` — so `anon` ends up with a direct grant that survives a `revoke from public`. Both revokes are required.
- Input shape guard at the top of the function body — `raise exception` on NULL or non-array `jsonb` payloads. Without this, `jsonb_array_elements(null)` returns zero rows silently and an unguarded DELETE-then-INSERT would silently wipe the collection.
- Where ordering matters, derive `order_index` from array position via `WITH ORDINALITY` rather than trusting a caller-supplied `order_index` field. The array IS the order; this eliminates the "two rows with the same order_index" failure mode at the source.

**Forward applicability:** any future Server Action that does atomic multi-statement writes on a parent-children pair should follow this pattern. Reference implementation: `supabase/migrations/010a_save_project_media_rpc.sql`.

#### 6.6.10 Application-layer auth guard on admin mutations — `assertAdminSession()` (F-39, audit 24b)

`lib/session.ts` exports one function, `assertAdminSession(client?: SupabaseClient): Promise<void>`. It is called as the first statement inside the `try` of **every one of the 17 admin mutation Server Actions**, across all seven wrapper modules: `admin-projects-mutations.ts`, `admin-posts-mutations.ts`, `admin-stats-mutations.ts`, `admin-notes-mutations.ts`, `admin-images-mutations.ts`, `admin-project-media-mutations.ts` and `admin-reorder-mutations.ts`. `lib/auth.ts` (`signInWithMagicLink`, `signOut`) is deliberately excluded — guarding the sign-in path would lock the single user out of their own login.

**Why it exists.** Before this, admin authorization was **single-layered on Postgres RLS**. SEC-04 requires two checks, authenticated AND authorized, and only the second existed. That gap is larger than it looks because of how Next.js dispatches Server Actions: the action is selected by the `Next-Action` request header against whatever URL is POSTed, not against the route the action nominally belongs to. Since T46 narrowed the middleware matcher to `/admin/:path*` (§4.10), an action ID lifted out of the client bundle could be POSTed to `/` — a path middleware never sees — and the action body would run in full, with only the RLS policy refusing the write. One bad policy in any future migration would have been an immediate unauthenticated write path with nothing behind it. The guard does not replace RLS; RLS stays the authoritative resource-level gate. This is the authentication half.

Four design properties, each load-bearing:

- **Wrapper layer, not `-internal.ts`.** The `'use server'` wrappers are the client-reachable boundary (§6.6.1); the internal helpers are ordinary ES module functions with no wire address. Guarding the internals would put the check behind the boundary it is supposed to defend, and would fire redundantly on server-side call chains.
- **Inside the existing `try`, not before it.** The wrapper's `finally { await padToFloor(start) }` therefore still covers a guard rejection, so an unauthenticated call is padded to `MIN_DURATION_MS = 750` like every other outcome (SEC-09 Channel 3, §6.6.2), and the wrapper's `catch` still converts the throw to the uniform `GENERIC_FORM_ERROR` envelope (Channel 2). An unauthenticated caller receives a response byte-identical to a failed validation.
- **It throws; it does not return a boolean.** A guard whose failure mode is a falsy return is one forgotten `if` away from being a no-op. `ServiceError` on every failure mode — absent session, Supabase error, network throw. Logs carry the operation tag and error name only, never token contents, session, email or raw error message (SEC-05, EH-02).
- **It lives in a directive-free module.** `lib/session.ts` has no `'use server'`. Exporting the guard from a `'use server'` module would promote it to a publicly callable Server Action and hand any client a wire-level "is an admin session currently present?" oracle — a probe channel orthogonal to the six-channel uniformity contract (SEC-08).

**`getUser()`, not `getSession()`,** for the same reason as the middleware gate (§6.2): the local cookie decode verifies nothing but `exp`. The dead `getServerSession()` that previously occupied `lib/session.ts` was deleted in the same change — zero import sites outside its own test, and its JSDoc actively argued that a presence check was sufficient. That reasoning is retired.

**Code-review checklist:** every export of an admin `*-mutations.ts` module contains `await assertAdminSession()` as the first statement inside its `try`. A new mutation without it is a security regression, not a style nit.

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
