# Content Model Expansion (planning artifact)

**STATUS: SUPERSEDED by T42 (2026-05-19).** This document proposed Shape C (new tables + JSONB) for the project content-model expansion. T42 shipped Shape A (6 nullable columns, zero new tables) after `@cto` pre-migration consult on 2026-05-19. See `docs/plan-phase-4-launch.md` T42 + this doc's Schema-deltas section for Shape A vs Shape C rationale. Kept as historical reference.

**Further superseded by T43 (2026-05-23).** Project media (multi-row carousel with captions, optional before/after pairs, atomic save) replaces the single `image_id` / `image_after_id` slot pattern referenced in this doc's inventory. The new `project_media` table is documented at `docs/architecture.md` §2.5; the public-render carousel surface at §4.9 + `docs/design-decisions.md` "Override 2: Project media carousel"; the public-site JS-library policy at `docs/constraints.md` CONSTRAINT-22. The legacy `projects.image_id` / `image_after_id` columns remain in the schema for backward compatibility — see the deprecation JSDoc on `Project.image_id` / `Project.image_after_id` in `lib/types.ts`.

**Date surfaced:** 2026-05-11 (during T11)
**Status:** Awaiting `@cpo` + `@designer` pickup as a plan amendment
**Owner:** unassigned — recommended: `@cpo` for scope, `@designer` for visual contract, `@cto` for migration shape

---

## Why this doc exists

The design bundle's list pages render fields the current schema (`docs/architecture.md` §2, mirrored in `lib/types.ts`) does not back. T11 was unblocked by hoisting the bundle's hardcoded data arrays into typed defaults — DB rows flow through where they exist, and bundle defaults fall through where they don't. This doc captures the schema gap so it can be closed in a deliberate plan amendment, rather than ad-hoc during admin build-out.

This is a routing artifact, not a plan. It enumerates the mismatches, sketches options, and lists open questions. `@cpo` decides scope; `@designer` confirms the visual contract; `@cto` picks the migration shape.

---

## Inventory of mismatches

Enumerated by reading the 6 bundle list pages (`components/public/pages/{Projects,Writing,Other}.tsx` and `components/public/mobile/pages/{Projects,Writing,Other}.tsx`) and comparing fields used against `lib/types.ts`.

| Bundle surface | Bundle field(s) | Current DB representation | Status |
|---|---|---|---|
| Projects list — row | `title` | `projects.title` | Backed |
| Projects list — row | `blurb` (1-line) | `projects.description` (rename via mapper, OR rename column) | Acceptable as-is OR cosmetic rename |
| Projects list — row | `status` — literal vocabulary: `"active"`, `"dormant"`, `"abandoned fondly"` | enum `project_status` = `'draft' \| 'published'` only (CONSTRAINT-11) | **Schema gap** — vocabulary collision |
| Projects list — row | `demo: { kind, variant }` — `kind` ∈ `"demo" \| "still" \| "before-after"`; `variant` ∈ `"rings" \| "agent" \| "bars" \| "wave"` (when `kind="demo"`) | not represented | **Schema gap** |
| Projects list — row | `links: [{ kind, href }]` — `kind` ∈ `"github" \| "live" \| "post"`; multiple per row | not represented | **Schema gap** |
| Writing list — row | `title` | `posts.title` | Backed |
| Writing list — row | `date` — display format `"APR 2026"` | derived from `posts.created_at` via mapper | Acceptable as-is |
| Writing list — row | `desc` (1-line) | derived from `posts.content` first-line OR new `posts.excerpt` column | Acceptable as-is, OR small additive |
| Other — stats wall | `{ label, value, unit }` | `stats` table fully backs this (no `category` use on this surface — flat list) | Backed (already wired in T11) |
| Other — `watching` list | `string[]` | not represented | **Hardcoded — intentional, low-churn** |
| Other — `considering` list | `string[]` | not represented | **Hardcoded — intentional, low-churn** |
| Other — `collections` empty-state copy | literal | not represented | **Hardcoded — design placeholder** |

**Notes on the inventory above:**

- The CONSTRAINT-11 `draft \| published` enum is a *visibility* state. The bundle's `active \| dormant \| abandoned fondly` is a *lifecycle* state. These are two orthogonal axes. The schema gap is that lifecycle has nowhere to live — not that publish-visibility is wrong.
- `links` ordering matters on the bundle (github first, then live, then post). Any normalized representation needs an explicit `display_order` or implicit ordering by `kind`.
- The Other-page stats surface uses `label`/`value`/`unit` only — it does NOT use `category` on the page. `category` is in the schema for grouping during ingest from OpenClaw and for admin filtering. No gap on stats.

---

## Recommended scope for the amendment

**In scope (worth schema work):**

- **Projects.** Add a `lifecycle` axis distinct from `status`. Add a representation for `demo` and `links`. Optionally rename `description` → `blurb` (cosmetic; mapper-only is fine).
- **Posts.** Optional `excerpt` column (with derived fallback for backward compat). Low priority — the mapper from `content`'s first line is acceptable for launch.

**Out of scope (keep hardcoded for now):**

- `watching` / `considering` — personal taste lists, low-churn. Promoting them to a `lists` table later is cheap if needed.
- `collections` empty-state — design placeholder, not real data yet.

---

## Schema deltas (option sketches)

### Option A — JSONB columns on `projects`

- Add `projects.lifecycle text` with CHECK constraint over the closed vocabulary (e.g., `'active' | 'dormant' | 'abandoned fondly'`). Nullable; admin sets it.
- Add `projects.demo jsonb` (NULL allowed; shape `{ kind: 'demo' | 'still' | 'before-after', variant?: string }`).
- Add `projects.links jsonb` (NULL allowed; shape `[{ kind: string, href: string }]`).
- Admin UI: JSON-aware structured forms or row repeaters; no extra tables.
- **Pros:** minimum schema churn, fastest to ship, no FK juggling.
- **Cons:** no DB-level validation of inner structure beyond a CHECK; not relationally queryable.

### Option B — Normalized tables

- New `project_links (id, project_id FK, kind, href, display_order)` with `ON DELETE CASCADE`.
- New `project_demos (project_id FK PK, kind, variant, config jsonb)` — one-to-one with `projects`, or table-per-project if multiple demos ever needed.
- Add `projects.lifecycle` as above (or a separate enum type).
- Admin UI: nested form / row repeater for links; single form for demo.
- **Pros:** structured, queryable, FK integrity.
- **Cons:** more migrations, more admin UI surface, more RLS policies to write (CONSTRAINT-08 applies to every new table).

### Option C — Hybrid (recommended default)

- Normalize `links` (it's a 1-to-many with a known closed `kind` vocabulary — the natural fit).
- JSONB for `demo` (typically one-per-project, varying shape — JSONB keeps the shape flexible while staying scoped to a single row).
- `lifecycle` as a CHECK-constrained text column on `projects` (or a separate enum type — `@cto` call).

**Default recommendation:** Option C. Reason: `links` benefits from FK integrity and ordering, `demo` doesn't.

---

## Admin UI implications

Phase 2 (`docs/plan-phase-2-admin.md`) currently scopes:

- **T20** — projects list view (columns: Title, Slug, Status, Created). Would grow: add Lifecycle column, optionally surface link count.
- **T21** — projects create/edit form (fields: title, description, status, slug). Would grow: add `lifecycle` field, `demo` editor (single form), `links` editor (row repeater). Bound by `<ProjectForm>` ≤200 lines (CQ-02) — likely needs splitting into sub-components.
- **T22** — projects delete: unchanged.
- **T23** — posts CRUD: minor — add optional `excerpt` field to `<PostForm>`. Otherwise unchanged.
- **T24, T25, T26, T27** — stats, images: unchanged.

shadcn supports row repeaters, structured forms, and JSON-editing surfaces natively. Cost is bounded — no new dependencies needed.

---

## OpenClaw ingest impact

**None.** OpenClaw writes only to `stats` via the `stats-ingest` Edge Function (CONSTRAINT-04). The content-model expansion touches `projects` and `posts` only. No change to the Edge Function contract, no change to its shared-secret handling, no new ingest path.

---

## Sequencing options

- **Bundle into Phase 2 admin scope.** Schema deltas land in the same phase as the admin UI that uses them. T20–T23 widen to include the new fields. Cheapest — one migration series, one admin UI pass.
- **Pre-Phase-2 schema-only amendment.** Run migrations as a small batch before Phase 2 starts. Admin UI catches them as part of normal Phase 2 work. Slightly more sequential; lets Phase 2 tasks start with the final shape.
- **Defer to Phase 4.** Ship Phase 1+2 with DB-driven rows where they exist and bundle defaults for the gap fields. Probably wrong — admin needs to manage `lifecycle`, `demo`, and `links` from the moment projects are editable, or the public surface stays frozen on bundle defaults.

**Default recommendation:** Bundle into Phase 2. T20/T21 are the natural carriers.

---

## Open questions for `@cpo`

1. Should `watching` / `considering` be data-backed long-term, or is hardcoded permanent? If data-backed, when — Phase 2 or post-launch?
2. What is the final `lifecycle` vocabulary? Bundle currently uses `"active"`, `"dormant"`, `"abandoned fondly"`. Are these the closed set, or are more values expected (e.g., `"shipped"`, `"in progress"`, `"retired"`)?
3. Is `lifecycle` admin-only metadata, or does it need its own visibility rule (e.g., hide `"abandoned fondly"` projects from the public list)?
4. Should `posts.excerpt` be hand-authored or derived from `content`'s first paragraph? If derived, is the mapper-only approach acceptable for launch?

## Open questions for `@designer`

1. Is the `demo.kind` vocabulary closed (`"demo" \| "still" \| "before-after"`) or open? If a new `kind` is added later, what is the visual contract?
2. Is the `demo.variant` vocabulary closed (`"rings" \| "agent" \| "bars" \| "wave"`) or open? Each variant maps to a different visual in the bundle — adding one is a design change, not a config change.
3. Is the `links.kind` vocabulary closed (`"github" \| "live" \| "post"`) or open? Each `kind` likely maps to a specific icon / label in the bundle.
4. Are there additional bundle surfaces beyond this inventory that should be data-backed in the same amendment (e.g., home-page hero data, footer copy)?
5. Should `lifecycle` render as a pill on every project card, or only when non-default? The bundle currently shows it on every row.

## Open question for `@cto`

1. JSONB vs normalized — Options A/B/C above. Trade-off is admin form complexity vs. queryability. Default recommendation is C (normalize `links`, JSONB for `demo`), but worth a binding decision.
2. Should `lifecycle` be a Postgres enum type (like `project_status`) or a CHECK-constrained text column? Enum is stricter; CHECK is easier to widen.

---

## Pickup mechanism

`@modify-plan` is the natural framework command for this, but it currently gates on PRD presence (see `docs/framework-issues.md`). Practical path:

1. `@cpo` reads this doc, answers the open questions above, decides scope and sequencing.
2. `@designer` confirms the visual contract for `demo`, `links`, `lifecycle` rendering.
3. `@cto` picks Option A / B / C and the enum-vs-CHECK shape.
4. Then either: (a) invoke `@modify-plan` once the gating issue is patched, or (b) write the amendment manually into `docs/plan-phase-2-admin.md` as new tasks (e.g., T20a, T21a) or expanded acceptance criteria on T20/T21/T23.

Until pickup, T11 stays unblocked via bundle defaults. No production code depends on this doc.
