# Security Report: swarnimbagre.com

**Last audit:** 2026-05-23 (audit 23 — T43.I documentation-only close-out: Override 2 finalized + CONSTRAINT-22 codified + T43 closed; CLEAR with 1 LOW opened-and-closed in-session)
**Scope:** T43.I delta. Modified — `docs/design-decisions.md` (Override 2 Surface boundary), `docs/constraints.md` (CONSTRAINT-22 + CONSTRAINT-05 amendment + summary table), `docs/architecture.md` (new §2.5 + §4.9), `docs/founder-brief.md` (Index #31 + entry #31), `docs/content-model-expansion.md` (T43-furthered-by line), `docs/plan-phase-4-launch.md` (T43 Status + T43.I Closed + amended T43.I acceptance criteria), `manifest.md` (Project Identity + Current plan file). Zero runtime code modified in T43.I. Out of scope: all source files in `components/`, `lib/`, `app/`, `supabase/migrations/`, `tests/` — none touched this session.
**Status:** CLEAR
**Summary:** 0 Critical / 0 High / 2 Medium / ~19 Low (carry-forward F-3, F-4 Mediums unchanged; F-37 Low unchanged). **F-38 (Low) opened and closed in-session** — `architecture.md` §2.5 schema table named a `kind` column + `updated_at` column/trigger + `ON DELETE CASCADE` on image FKs that did not match migration 010 (real schema: discriminator implicit in `image_after_id IS NULL`, no `updated_at`, image FKs `ON DELETE RESTRICT`). §2.5 corrected verbatim against migration 010 before close-out. Pre-existing audit 22's "Opened: None / Closed: None" framing extended: audit 23 opened F-38, closed F-38, no other status changes.

**Unresolved Critical/High findings:** None

---

## Audit-number gap note

This file previously recorded **audit 20** (T43.F). The T43.G session handoff records that an **audit 21** ran on the T43.G public-carousel surface and returned CLEAR, but that audit was apparently never written to `docs/security-report.md` — the durable record skipped from 20 to this entry. This audit is therefore **audit 22**. Audit 21's CLEAR verdict on `ProjectMediaCarousel` / `ProjectMediaCarouselParts` / `BeforeAfterMedia` is taken as the established baseline for those files; T43.H does not modify them, so they are not re-walked here. The gap is recorded for the audit trail — no security artifact was lost, only a documentation write was missed.

---

## Verdict

CLEAR. Zero Critical, zero High, zero new findings. T43.H is render-only prop-plumbing: it threads two new optional props (`media`, `view`) through `ProjectMedia` → `ProjectCard` / `MobileProjectCard` and through the two `/projects` list pages, and adds one new data-load call (`loadPublicProjectMedia`) on the project detail route. It introduces no new Server Action, no new auth surface, no new raw SQL, no new dependency, and no new logging. The one new surface — the `loadPublicProjectMedia(project.id)` call on `app/projects/[slug]/page.tsx` — is a read of RLS-protected published data through a parameterized query, wrapped in the page-boundary `safeLoad` so a query failure degrades to an empty carousel rather than a 500. Captions and alt text render exclusively as React text content and React-escaped attributes — no `dangerouslySetInnerHTML` anywhere on the carousel path.

---

## Audit 22 (2026-05-21) — T43.H review

### SEC-01 — No secrets in source code — PASS

All eight modified source/test files and the one new test file (`tests/ProjectCard.test.tsx`) reviewed. The new code carries only prop-plumbing, JSDoc comment text, and literal `'list'` / `'detail'` view-context strings. The three test files use synthetic `https://example.com/...` URLs and short literal ids (`'m1'`, `'a'`, `'b'`) — no real Supabase URL, no key, no environment value, no env-var fallback to a real default. The new import in `app/projects/[slug]/page.tsx` (`loadPublicProjectMedia` from `@/lib/public-project-media`) pulls in pre-existing audited code; it adds no credential.

### SEC-02 — Validate and sanitize all inputs at boundaries — PASS

T43.H introduces no new client-input boundary. The `media` and `view` props are server-resolved data, not user input: `media` is the output of `loadPublicProjectMedia` (which resolves `project_media` rows already validated at write time by the `saveProjectMedia` zod boundary and the migration-010 row-cap trigger); `view` is a hardcoded `'list'` / `'detail'` literal set by the orchestrator, never a user value. The TypeScript prop type `view?: 'list' | 'detail'` constrains it at compile time, and `ProjectMedia` defaults it to `'list'` when omitted.

The one new runtime call — `loadPublicProjectMedia(project.id)` — receives `project.id`, a UUID read from a project row already fetched via `getProjectBySlug(slug)`; the page calls `notFound()` before the media load when no project resolves. `getProjectMediaByProject` additionally rejects a non-string or empty `projectId` with a `ServiceError` before issuing any query (`lib/db.ts:267`). The input is never attacker-controlled — `slug` is the only user-supplied value on this route and it is consumed by `getProjectBySlug`, not by the media load.

### SEC-03 — Parameterized queries — PASS

The new call path `loadPublicProjectMedia` → `getProjectMediaByProject` issues `supabase.from('project_media').select(PROJECT_MEDIA_COLUMNS).eq('project_id', projectId).order('order_index', { ascending: true })` — a parameter-bound Supabase query builder, no string concatenation. Image resolution inside `toPublicMediaItem` uses `getImageById` (also builder-based). T43.H introduces no raw SQL.

### SEC-04 — Authentication and authorization — PASS

`loadPublicProjectMedia` is a public-site read and is correctly served through the anon-role path: the `project_media` table's `project_media_public_select` RLS policy (migration 010, lines 105–116) grants `anon` SELECT **only** for rows whose parent `projects` row has `status = 'published'` (`exists (select 1 from public.projects p where p.id = project_media.project_id and p.status = 'published')`). An unpublished project's media rows are not readable by the anon role even though `project.id` is known to the render path — RLS is the gate, and it is parent-published-scoped. There is no horizontal-privilege surface: the public site is read-only and single-tenant; `media` and `view` cannot be used to reach another resource because the row set is RLS-bounded to the already-resolved published project.

The detail route applies `safeLoad` to the media load (`'page:projects/[slug]:media'`) so a query error degrades to `[]` (empty carousel) rather than leaking an error to the wire — the access-control failure mode is fail-closed, not fail-open.

### SEC-05 — Never log or expose sensitive data — PASS

T43.H adds no `console.*` calls in any of the six modified component/page files. The pre-existing logging in `loadPublicProjectMedia`'s `resolveMediaImage` helper (`console.error` on a per-image signing failure) and in `safeLoad`'s `logLoadFailure` is server-side structured logging of operation context — no credential, no token, no PII; it carries `projectId` / `mediaId` / `imageId` / `columnName` / error message + stack, which are non-sensitive operational identifiers. None of that reaches the client: `safeLoad` returns the `[]` fallback to the render path; the page never serializes the error. The carousel surfaces only the resolved media items (image URLs, alt text, captions) — all intended public content.

### SEC-06 — HTTPS / encryption at rest — N/A

No new transport surface, no new at-rest storage. Vercel HTTPS + Supabase TLS + the private `images` bucket (signed-URL reads) all pre-exist and are untouched by T43.H.

### SEC-07 — Never commit sensitive files — PASS

`git status --porcelain` shows only T43.H application code + tests: six modified component/page files, two modified test files, and one new untracked test file (`tests/ProjectCard.test.tsx`). No SEC-07 file (`docs/session-log.md`, `docs/session-handoff.md`, `docs/framework-issues.md`, `docs/testing-setup.md`, `profile.md`, `content/`, `CLAUDE.md`, `manifest.md`, `.env` / `.env.local` / `.env.*.local`) is staged, modified, or untracked-without-protection. The new `tests/ProjectCard.test.tsx` sits under `tests/` — application test code, not on the SEC-07 list, correctly committable and not `.gitignore`-matched. `docs/security-report.md` (this file) is intentionally tracked — not on the SEC-07 list. No SEC-07 file appears in the working tree changes; recent commit history (`6fea8c6` … `ba91b7c`) carries only application code and approved docs.

### SEC-08 — Server Action surface minimization — PASS

T43.H creates no `'use server'` module and adds no export to one. `app/projects/[slug]/page.tsx` is an async Server **Component** (a route page), not a `'use server'` action file — its default export is a page renderer, not a callable Server Action, and Next.js does not emit it to `server-reference-manifest.json`. `loadPublicProjectMedia` lives in the plain module `lib/public-project-media.ts` (no `'use server'` directive — confirmed) and is called only server-side from the page; it is not a client-reachable action. The six modified component files (`ProjectMedia`, `ProjectCard`, `MobileProjectCard`, the two `Projects` pages) are `'use client'` components — none exports a Server Action. The Server Action allowlist (13 IDs) is unchanged by T43.H.

### SEC-09 — Auth-flow uniformity — PASS (not an auth flow)

T43.H touches no auth flow — it is a public read-and-render surface. SEC-09 does not apply. No branch on email or account state, no `Set-Cookie`, no constant-time concern.

### Additional vulnerability-pattern review

- **XSS / injection on the caption + alt-text render path — closed.** This was the named focus of the audit. The carousel renders `caption` and alt text exclusively as React-managed values: `Caption` in `ProjectMediaCarouselParts.tsx` renders `{text}` as a JSX text child (React auto-escapes); `MediaSlide` renders alt text as `<img alt={item.imageAlt}>` — a React-escaped attribute; the `ProjectMediaCarousel` aria-live region interpolates `slideAlt(...)` into a JSX template-literal child, again auto-escaped. There is **no `dangerouslySetInnerHTML` anywhere on the T43.H carousel path** (or in the carousel files it wires to). A caption or alt-text value containing `<script>` or an event-handler attribute renders as inert literal text. T43.H itself adds no rendering of user text — it only forwards the already-safe `media` array; the render code it reaches was audited at T43.G (audit 21).
- **Mass assignment / parameter pollution — not applicable.** No write surface in T43.H. The `media` array is server-constructed; there is no client-supplied object that could carry extra keys.
- **Broken access control / IDOR — closed.** `project.id` flows from an already-resolved published project; the `project_media_public_select` RLS policy re-checks parent-published status at query time, so even a hypothetically forged id cannot read an unpublished project's media via the anon role.
- **Insecure dependencies** — T43.H adds zero new dependencies. `embla-carousel-react` was added and budgeted at T43.B and is wired (not introduced) here. The pre-existing `npm audit` moderate finding set is unchanged and out of scope.
- **Error-handling / fail-open** — the new `loadPublicProjectMedia` call is wrapped in `safeLoad` with an `[]` fallback; a media-query failure degrades to an empty carousel and the page still renders. Fail-closed, no error leakage to the wire.
- **F-37 class (render-side scheme guard)** — considered: the only URLs the carousel path renders (`item.imageUrl`, `item.imageAfterUrl`) are server-generated Supabase Storage signed URLs, not user-typed values. No new instance of the F-37 class introduced by T43.H.

### Informational (not a finding)

The detail-page media load runs inside the same `Promise.all` as the two legacy image resolvers, each independently `safeLoad`-wrapped. This is correct — one failing load cannot reject the batch. No action needed; noted only to confirm the new call was placed inside, not outside, the boundary wrapper.

---

## Carry-forward (prior audits, not re-walked — audit 22 is a T43.H delta audit)

### Medium
- **F-3** — `EMAIL_SCHEMA` length cap (`lib/auth-internal.ts:20`). Recommend `z.string().min(3).max(254).email()`. Carry-forward, unchanged — T43.H does not touch this file.
- **F-4** — Callback handler OTP type set width (`app/(admin)/admin/auth/callback/route.ts`). Recommend narrowing to `new Set(['email', 'magiclink'])`. Carry-forward, unchanged — T43.H does not touch this file.

### Low
F-6–F-11, F-20–F-25, F-27, F-28 — prior-audit carry-forwards. F-31–F-35 — audit 16 Lows. F-37 — audit 18 Low (render-side scheme guard on TypoIcon), deferred carry-forward. F-36 — RESOLVED in re-audit 17b.

---

## Summary Table

| Severity | Count | F-codes |
|---|---|---|
| Critical | 0 | — |
| High | 0 | — |
| Medium | 2 | F-3 (carry), F-4 (carry) |
| Low | ~19 | F-31–F-35 (audit 16); F-37 (audit 18); F-6–F-11, F-20–F-25, F-27, F-28 (carry) |

**Opened audit 22:** None.
**Closed audit 22:** None.
**Verdict:** CLEAR — no Critical or High findings. T43.H ships. Next security review point: T43.I close-out.

---

## Audit 23 (2026-05-23) — T43.I documentation-only close-out

### Scope and method

Audit pass for T43.I, the documentation close-out task for T43 (project media multi-image carousel + first public-site JS library). Zero runtime code modified this session — the changeset is seven documentation files. The audit method is therefore different from a code audit: instead of walking SEC-NN rules over runtime behavior, the focus is on whether the new documentation accurately describes the existing security-relevant posture (RLS gates, plain-text caption render, client-component boundary, Server Action count, build-discipline framing of CONSTRAINT-22) without introducing false claims that would mislead a future audit reasoning from the docs.

### Findings

**§2.5 RLS claim accuracy — PASS.** `architecture.md` §2.5 paragraph on `project_media_admin_all` + `project_media_public_select` matches migration `010_project_media.sql` (lines 105–116, 125–131) verbatim in semantics. The doc claim "the public-read policy re-resolves the parent's published status at query time, so a forged `project_id` cannot read an unpublished project's media via the anon role" is correct — the `exists (... p.status = 'published')` subquery is evaluated per row at query time.

**§4.9 client-component boundary claim — PASS.** `ProjectMediaCarousel.tsx` + `ProjectMediaCarouselParts.tsx` both declare `'use client'`; neither file imports `next/headers`, calls `cookies()`, references `server-only`, or uses `dangerouslySetInnerHTML`. Caption + alt render exclusively as React text children and JSX attributes (auto-escaped). The doc claim that the carousel receives only pre-resolved data (signed URLs per CONSTRAINT-15, plain-text strings) matches the `PublicProjectMediaItem` interface at `lib/types.ts:126`.

**§2.5 caption/alt plain-text claim — PASS.** Caption render: `ProjectMediaCarouselParts.tsx` `<div>{text}</div>` — React-escaped. Alt render: `alt={item.imageAlt}` JSX attribute — React-escaped. No `marked()` or `dangerouslySetInnerHTML` on the carousel path. Repo-wide grep for `dangerouslySetInnerHTML` in `components/public/` returns only the pre-existing `MarkdownContent.tsx:27` post-content surface (audited in prior cycles), not on any T43 path.

**Server Action manifest = 13 IDs — PASS.** `tests/server-actions-manifest.test.ts` `SERVER_ACTION_ALLOWLIST` confirmed at exactly 13 entries (`signInWithMagicLink`, `signOut`, `createProject`, `updateProject`, `deleteProject`, `createPost`, `updatePost`, `deletePost`, `insertStat`, `deleteStat`, `uploadImage`, `deleteOrphanImages`, `saveProjectMedia`). T43.I adds zero Server Actions.

**CONSTRAINT-22 wording security accuracy — PASS.** `constraints.md` CONSTRAINT-22, `architecture.md` §4.9, and `founder-brief.md` entry #31 all frame the 15 KB budget as a build-discipline policy (route-chunk drift cap measured against `next build` First Load JS), never as a dependency-vulnerability protection or supply-chain audit mechanism. No overclaim. "What this closes off" correctly frames reversal as drift from CONSTRAINT-05's verbatim-bundle posture, not as a security regression.

**No new auth / public-write / env-var / cross-origin surface — PASS.** T43.I introduces zero new claims about authentication, public-write paths (the existing `saveProjectMedia` Server Action + `save_project_media` RPC were audited at audit 19 and unchanged), environment variables, or cross-origin behavior. `embla-carousel-react` was added at T43.B and audited as part of that delta; T43.I does not introduce additional dependencies.

**Carry-forwards preserved — PASS.** F-3 Medium (`EMAIL_SCHEMA` length cap, `lib/auth-internal.ts:20`), F-4 Medium (callback handler OTP type set width, `app/(admin)/admin/auth/callback/route.ts`), F-37 Low (TypoIcon render-side scheme guard), and ~19 prior-audit Low carry-forwards remain tracked with status unchanged. T43.I does not touch any file underlying these findings.

### F-38 (Low, OPENED and CLOSED audit 23) — §2.5 schema table drifted from migration 010

**Severity:** Low. Not a runtime security regression — the live RLS, FK, and trigger gates are correct against the actual on-disk schema. The risk is doc-driven future error: a subsequent audit, migration author, or `@cto` consult reading §2.5 as ground truth would reason against a phantom schema.

**Discovery:** Caught during this audit's Q1 (§2.5 RLS claim accuracy cross-check) by comparing `architecture.md` §2.5 column list against `supabase/migrations/010_project_media.sql` lines 54–75.

**What was wrong (initial T43.I write of §2.5):**
- Named a `kind text NOT NULL CHECK (kind IN ('single','pair'))` column — migration 010 has no such column; the shape discriminator is the nullable `image_after_id` FK.
- Named an `updated_at timestamptz NOT NULL default now(), trigger on update` row — migration 010 has no `updated_at` column and no trigger on update.
- Declared `image_id` and `image_after_id` as `ON DELETE CASCADE` — migration 010 uses `ON DELETE RESTRICT` on both, an inversion of the legacy `projects.image_id` / `projects.image_after_id` `ON DELETE SET NULL` semantics (the RESTRICT posture is deliberate: it prevents orphan cleanup at `/admin/images` from silently breaking a published carousel slide).
- The pair-distinctness CHECK was described with informal wording rather than the migration's actual SQL form (`image_after_id is null or image_after_id <> image_id`).

**Resolution (in-session, before close-out commit):** `architecture.md` §2.5 rewritten verbatim against migration 010 — removed the `kind` row, removed the `updated_at` row, changed both image FKs to `ON DELETE RESTRICT`, restated the pair-distinctness CHECK using the migration's actual SQL, added a new "Shape discriminator" paragraph explaining the implicit nullability-based discrimination, and added a new "Image FK delete semantics" paragraph explaining the RESTRICT posture and its difference from the legacy slot columns. Row-cap trigger description also tightened to record that it fires on `BEFORE INSERT OR UPDATE OF project_id` (not just INSERT) — closing the move-row-between-projects bypass per the migration's existing trigger scope and `@cto` pre-apply review note in the migration header.

**Status:** CLOSED in same audit (opened and resolved within T43.I).

**Root cause for the discipline note:** mirroring §2.1's schema-table shape was the right pattern, but verifying each row against the actual migration SQL was skipped. The "mirror templates — read for sense" memory feedback (caught at T23 PostForm + ProjectForm; same class of latent bug) applies here too. Future schema-doc edits must source from migration SQL, not from intent.

### Summary Table (audit 23)

| Severity | Count | F-codes |
|---|---|---|
| Critical | 0 | — |
| High | 0 | — |
| Medium | 2 | F-3 (carry), F-4 (carry) |
| Low | ~19 | F-31–F-35 (audit 16); F-37 (audit 18); F-6–F-11, F-20–F-25, F-27, F-28 (carry) |

**Opened audit 23:** F-38 (architecture.md §2.5 schema-vs-migration-010 drift, Low).
**Closed audit 23:** F-38 (corrected in-session before close-out).
**Verdict:** CLEAR — no Critical or High findings. T43.I ships. T43 fully closed. Next security review point: T40 (content addition + pre-launch hygiene sweep).
