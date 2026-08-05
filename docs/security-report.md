# Security Report: swarnimbagre.com

**Last audit:** 2026-08-04 (audit 24 — T46 full public-site redesign, retroactive: the release was built, migrated to production and shipped in Session 51 with no security pass. CLEAR.)
**Scope:** Commit `228f76f` in full — 127 files, +6013/-7076. Rewritten `middleware.ts` (matcher narrowed to `/admin/:path*`); new `'use server'` surface `lib/admin-notes-mutations.ts` + its `-internal` / `-schemas` / `-types` siblings; extended `lib/admin-stats-mutations*`; migrations `013_project_card_fields.sql` + `014_other_page_model.sql` (already applied to production); the whole rebuilt public surface (22 components deleted, `ProjectFrame.tsx` hand-rolled carousel replacing `embla-carousel-react`, new `SiteHeader`, `home/SocialIcons`, `lib/post-summary.ts`, `lib/social-links.ts`); SEC-07 sensitive-file sweep and SEC-01 secret scan across the whole tracked tree. Live production state (`oosretprveorrjzjcbxb`) verified directly via `pg_policies`, `pg_proc.proacl`, `pg_tables.rowsecurity` and the advisor API — not inferred from the `.sql` files.
**Status:** CLEAR
**Summary:** 0 Critical / 0 High / 2 Medium / ~26 Low **after in-session remediation**. Audit 24 opened F-39, F-40, F-41 (Medium) and F-42 through F-48 (Low). **All three Mediums were fixed and verified in the same session** — see "Audit 24b" at the end of this file. Remaining Mediums are the two carry-forwards F-3 and F-4, both re-verified still open. F-37 and the ~19 prior Lows unchanged; F-42 through F-48 remain open (Low).

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

---

## Audit 24 (2026-08-04) — T46 full public-site redesign (retroactive)

### Scope and method

T46 was designed, built, migrated to production and committed in a single session (S51) with no security pass at any point. This audit is therefore retroactive: the code is already on `main` and migrations `013` / `014` are already applied to the live database. That changes the remediation calculus — findings here are not "fix before shipping", they are "already shipped, decide whether to roll forward".

Four parallel review tracks were run over the `228f76f` delta (middleware + auth; Server Action surface; migrations + live RLS; public surface + SEC-07 + SEC-01). Every gating-relevant claim was then re-verified directly in the main thread rather than accepted from the track reports, per the standing audit-delegation discipline: the middleware matcher and gate logic were read in full; `tests/server-actions-manifest.test.ts` and `tests/middleware.test.ts` were executed against a **fresh** `next build` (exit 0) so the SEC-08 manifest check could not false-positive on a stale `.next`; `pg_policies`, `pg_proc.proacl`, `prosrc` and the security-advisor API were queried against production directly; SEC-07 history checks were re-run in the main thread.

**Audit numbering note.** This is audit 24. Audits 20–23 covered T43.F through T43.I. T44 (Session 46) ran an audit that returned `0/0/0/0` and was recorded in `manifest.md` but, like audit 21 before it, never written to this file. T45, T46 and the S47–S50 sessions ran no audit. The T46 delta is consequently the largest unaudited surface in the project's history.

---

### Verdict

CLEAR. Zero Critical, zero High.

The two changes that carried the most risk both hold up. The middleware matcher narrowing — the single most dangerous edit in the release — is correct: `/admin/:path*` compiles to a regex whose path-segment group is optional, so the bare `/admin` is matched, and all eleven admin routes on disk plus their RSC/prefetch variants fall inside it. Nothing that was gated before T46 lost coverage; what the public routes lost was only the T10 `x-device-variant` header, which no longer has a consumer anywhere in the tree. The gate fails **closed** on every path — error, absent session, thrown exception and missing env all return the same padded login redirect, and no branch allows the request through on failure.

The new `notes` write surface is likewise sound. Live `pg_policies` confirms all twelve public-schema policies: `anon` holds SELECT and nothing else on every one of the six tables, and every `*_admin_all` policy is scoped `to authenticated`. No policy anywhere grants INSERT, UPDATE or DELETE to `anon` or `public`. Migrations 013 and 014 create no functions, no foreign keys, no grants and no new buckets, and production schema matches the `.sql` files exactly — no drift. The three project RPCs still carry the full T43.E idiom (`security invoker`, `search_path=''`, EXECUTE revoked from both `public` and `anon`), verified in `proacl` rather than in the migration text.

Input validation on the new surface is genuinely good: every schema is `.strict()`, every free-text field carries a length cap mirroring its migration-014 CHECK, and there is no `z.any`, `z.unknown` or `.passthrough` anywhere in `lib/`. The wire envelope is uniform and leaks nothing — one constant `'Could not save. Try again.'`, zod messages filtered to an allowlisted key set, no stack, no Postgres code. The SEC-08 four-file split was mirrored correctly: `lib/admin-notes-mutations.ts` carries `'use server'` and exports exactly the three intended actions, its three siblings carry no directive, and the allowlist moved 15 → 19 in the same commit as the code, with **zero drift** against the real build manifest.

The hand-rolled carousel that replaced `embla-carousel-react` introduced no XSS surface. There is exactly one `dangerouslySetInnerHTML` in the repo, on the pre-existing post-body path, behind a `marked` + DOMPurify whitelist that permits no `script`, `iframe`, `svg`, `style` or event-handler attribute. The new `lib/post-summary.ts` produces plain text only and is rendered as an escaped React text child. `ProjectFrame` uses no DOM ids at all, so the old CONSTRAINT-22 multi-instance collision requirement is moot rather than violated.

SEC-07 and SEC-01 are clean outright. Every one of the eleven SEC-07 paths is covered by an explicit `.gitignore` line, absent from `git ls-files`, and absent from `git log --all`; `.env.example` is the only `.env*` file ever committed, and it holds no values. No JWT, service-role key, private key or bearer token appears anywhere in the tracked tree.

What keeps this from being a clean bill of health is a structural point rather than a bug: **admin authorization rests on exactly one layer.** See F-39.

---

### F-39 (Medium, OPENED) — Server Actions perform no authentication check; RLS is the sole authorization layer

**Rule violated:** SEC-04 — "Both checks are required. Auth middleware alone is not sufficient — resource-level authorization must also be implemented."

**Founder Brief**
**Decided:** Not one of your nineteen Server Actions checks whether the caller is signed in. The only thing standing between an anonymous internet request and a write to your database is a Postgres row-security policy.
**Means for your product:** Today, nothing — the policies are correct, so the write is refused. The exposure is that your admin panel has no second lock. If any future migration gets a policy wrong on any table, that mistake becomes an immediate unauthenticated write path with nothing else to catch it. Normally a bad RLS policy is a near-miss; here it is the whole system.
**Check before approving:** Confirm you are comfortable that a single Postgres policy mistake is a production incident rather than a caught error. If you want the second layer, the fix is one shared helper called at the top of each action — roughly an hour, no schema change.
**What this closes off:** Nothing. Adding the check is purely additive and does not alter any existing behaviour.

**What is wrong:** No `getUser()`, `getSession()` or `requireSession()` call exists anywhere in `lib/admin-*-mutations*.ts`. Every action builds its client via `const supabase = client ?? (await createServerClient());` (`lib/admin-notes-mutations-internal.ts:88`, `:134`, `:181`; `lib/admin-stats-mutations-internal.ts:166`, `:226`, `:285`), and `createServerClient` (`lib/supabase.ts:34-38`) uses `NEXT_PUBLIC_SUPABASE_ANON_KEY` plus whatever session cookies the request happened to carry. The helper that would satisfy SEC-04 — `getServerSession` at `lib/session.ts:30` — has zero import sites in `app/`, `lib/` or `components/`; it is referenced only by `tests/session.test.ts:22`. It is dead code. The admin route group does not compensate: `app/(admin)/layout.tsx` is purely presentational, and `app/(admin)/admin/page.tsx:6-7` states the assumption outright — "Auth is enforced at the middleware layer — this never runs for an unauthenticated request."

**What could go wrong:** Server Actions dispatch on the `Next-Action` request header against whatever URL is POSTed, not against the URL the action nominally belongs to. Since T46 narrowed the matcher to `/admin/:path*`, an attacker who lifts the `createNote` action ID from the public client bundle can POST it to `https://swarnimbagre.com/` — a path middleware never sees — and the action body executes in full. It builds an anon-role client and issues the INSERT. Only `notes_admin_all ... to authenticated` refuses it. Every table is one policy edit away from that request succeeding.

**Mitigating, and why this is Medium rather than High:** the refusal currently holds on every table (verified live, all twelve policies). No service-role key is reachable from any Server Action — `SUPABASE_SERVICE_ROLE_KEY` appears only in `supabase/functions/stats-ingest/index.ts:252`, the 404-gated `app/api/test/sign-in/route.ts:133`, `scripts/seed-test-fixture.ts` and `playwright.config.ts`. And the `authenticated` role is effectively one person: `lib/auth-internal.ts:110` enforces the email allowlist and `:115` sets `shouldCreateUser: false`.

**How to fix it:** Add one `assertAdminSession()` helper wrapping `supabase.auth.getUser()`, called as the first statement of each of the nineteen actions (or once inside the shared `-internal` entry points). Throw before any DB call on absence. Wire `lib/session.ts:30` in rather than leaving it dead.

**Pre-existing, extended by T46.** The pattern dates to T21 and is identical across all eight mutation modules; T46 added four more actions on the same footing. It is opened now because this is the first audit to enumerate the full nineteen-action surface against the matcher change that made the off-path reachability concrete.

---

### F-40 (Medium, OPENED) — The admin gate trusts `getSession()`, which does not verify the token signature

**Rule violated:** SEC-04, and `@supabase/ssr`'s own documented server-side guidance.

**Founder Brief**
**Decided:** The middleware decides whether to let someone into `/admin` by reading the session cookie and checking its expiry date — not by asking Supabase whether the token is genuine.
**Means for your product:** Someone could hand-craft a cookie with a fake but unexpired token and get the admin interface to render for them. They would see the shell and the layout, not your data — the database still rejects the forged token the moment any query runs. It is a locked display case with an unlocked door.
**Check before approving:** The fix is a one-word change (`getSession` to `getUser`) that costs one network round-trip per admin page load. Confirm you would rather pay that than render admin chrome to a forged cookie.
**What this closes off:** Nothing.

**What is wrong:** `middleware.ts:97` — `const { data, error } = await supabase.auth.getSession();`. In server context `getSession()` decodes the cookie and checks `exp` locally; it does not round-trip to the auth server and does not verify the JWT signature. `getUser()` does. The project uses `getUser()` correctly everywhere it is *not* the gate (`app/(admin)/admin/login/page.tsx:12`, `app/(admin)/admin/auth/callback/route.ts:81`) and uses the weaker call at the one place that decides access. `lib/session.ts:17-21` documents the tradeoff and names the compensating control accurately: PostgREST rejects an unsigned JWT on the next real query.

**What could go wrong:** Forge an `sb-<ref>-auth-token` cookie carrying a garbage-signed JWT with a future `exp`. Middleware passes it; `/admin/posts`, `/admin/stats` and `/admin/notes` render as anon-behind-RLS. Impact is limited to UI structure and any already-published rows — no draft content, no writes. Combined with F-39, however, this is the second of two layers that both degrade to "RLS is the only real gate".

**How to fix it:** Replace `getSession()` with `getUser()` at `middleware.ts:97` and branch on `data.user` instead of `data.session`. Update the `lib/session.ts:17-21` rationale comment and the corresponding middleware tests.

**Pre-existing.** `runAdminGate` is byte-identical across the T46 diff.

---

### F-41 (Medium, OPENED) — `public.rls_auto_enable()` is SECURITY DEFINER and EXECUTE-granted to `anon`

**Rule violated:** SEC-04, and the project's own RPC idiom (CONSTRAINT-08 discipline as implemented at T43.E / T44.A).

**Founder Brief**
**Decided:** There is a function in your database that runs with owner-level privilege and that anyone on the internet is permitted to call. It is not one of yours and it is not in any migration file.
**Means for your product:** In practice it cannot do anything — calling it from outside its intended context makes it error out on its first statement. But it is the exact shape of problem that turns into a real one after a future edit, and Supabase's own linter flags it twice. It is also the only place in your database that breaks the permission rule you follow everywhere else.
**Check before approving:** This is a one-line revoke with zero functional cost. Verify afterwards that new tables still get row security switched on automatically.
**What this closes off:** Nothing.

**What is wrong:** Verified live — `pg_proc` for `public.rls_auto_enable()` returns `prosecdef = true`, `proconfig = ["search_path=pg_catalog"]`, and `proacl` includes `=X/postgres | anon=X/postgres | authenticated=X/postgres`. It backs a `ddl_command_end` event trigger and appears in no repo migration. Supabase's security advisor raises it twice: `anon_security_definer_function_executable` and `authenticated_security_definer_function_executable`, both WARN, both EXTERNAL-facing, both naming `/rest/v1/rpc/rls_auto_enable` as the reachable path. Every other function in the schema either has no elevated privilege or, in the case of the three project RPCs, correctly has no `anon` grant at all.

**What could go wrong:** `anon` POSTs `/rest/v1/rpc/rls_auto_enable`. The body's first statement is `SELECT * FROM pg_event_trigger_ddl_commands()` (source read directly from `prosrc`), which raises outside a `ddl_command_end` event-trigger context, so the loop never executes and no privilege is escalated. Exploitability today is nil. The finding is that an event-trigger function never needs an EXECUTE grant to any role, and this one has the maximum grant while running as definer — so any future rewrite of that body inherits an internet-reachable definer-privilege entry point.

**How to fix it:** `revoke execute on function public.rls_auto_enable() from public, anon, authenticated;`. Event triggers fire as the owner and do not consult EXECUTE grants, so auto-enable behaviour is unaffected. Record it as a migration so the state is versioned rather than dashboard-only.

**Note on provenance:** this function is not created by 013 or 014 and appears in no migration; it could not be dated from `pg_proc`, which carries no creation timestamp. Treat it as platform-side infrastructure, not T46 authorship.

---

### Corrected record — the T46 advisor claim in `manifest.md` does not match production

`manifest.md` states T46 produced an "advisor delta exactly 1 new WARN, the standard `rls_policy_always_true` accepted under CONSTRAINT-09". Queried live this audit, **no lint by that name exists in the output at all.** The actual current security advisor set is five WARNs: `function_search_path_mutable` on `set_updated_at` and on `prevent_slug_change_after_publish` (both pre-existing, migrations 001 and 006); the two `rls_auto_enable` definer lints above; and `auth_leaked_password_protection`, which is moot under CONSTRAINT-09 since the project has no passwords. Performance advisors are seven INFO (six unindexed FKs, all pre-existing; one unused index from migration 012). **Zero advisor findings are attributable to migrations 013 or 014** — neither creates a function, an FK, or an always-true policy that was not already the established house pattern. The manifest sentence should be corrected; it is not a security defect, but it is a false baseline for the next audit.

---

### Low findings opened this audit

- **F-42** — `docs/plan-phase-4-launch.md:254` records `bagreswarnim@gmail.com` as the value of `ADMIN_ALLOWED_EMAIL`, in a tracked file, in a line whose checklist item is explicitly about the admin allowlist. Commit `f8181ae` was titled in part "admin-email redaction", so a redaction pass existed and missed this occurrence. The address itself is already public (rendered as a `mailto:` on `/`), so what leaks is the *pairing* — an attacker reading the public repo learns exactly which identity to target for magic-link phishing rather than having to guess.
- **F-43** — `lib/admin-mutation-log.ts:53-56` writes `error?.message` from the raw Supabase error into server logs. The project's own remediation for this class, `toLogSafeError` (`lib/errors.ts:64-74`, which closed F-29), explicitly drops `message` because "Supabase `AuthError.message` can echo the submitted email or rate-limit detail" — but the mutation-log path does not use it. Server-log only; never reaches the wire. Now on the new T46 paths via `admin-notes-mutations-internal.ts:99,146,185` and `admin-stats-mutations-internal.ts:181,242,288`.
- **F-44** — `assertSlug` (`lib/db-internal.ts:26-33`) validates type and non-emptiness only. SEC-02 requires "type, **format, length**, and allowed values". Stored slugs are `[a-z0-9-]{1,200}`, so a crafted slug can only miss and 404; there is no injection path, because `supabase-js` `.eq()` percent-encodes through `URLSearchParams`. The residual is a cheap amplification nuisance — `GET /writing/<400KB>` is forwarded verbatim into the upstream PostgREST query string. Fix is a `^[a-z0-9-]{1,200}$` guard before the query.
- **F-45** — migration `014_other_page_model.sql:99-102` attaches the new `notes` table to `set_updated_at()`, a function the advisor flags for mutable `search_path`. Migration 012 pinned `search_path = ''` on its own trigger functions; 001's `set_updated_at` was never retrofitted, and T46 extended its blast radius to a new table instead of fixing it. Low risk — it is SECURITY INVOKER, so no privilege escalation is available — but it keeps a standing WARN alive.
- **F-46** — the reviewer-facing map of the attack surface is stale in two places. `tests/server-actions-manifest.test.ts:16` says "The allowlist is eighteen IDs" when the enforced `Set` holds nineteen, and `:25` omits `updateStat` from its per-module comment. `lib/auth.ts:17-18` claims "this module is the project's only `'use server'` file" — there are eight. The enforced artifacts are correct in both cases; only the prose misleads. It matters because a future auditor counting against these comments will under-scope.
- **F-47** — migrations 013 and 014 are registered in the production ledger as `project_card_fields` and `other_page_model`, without their numeric prefixes, breaking the sequential convention `docs/architecture.md:45` asserts. Ordering is still correct via timestamps, but a future auditor diffing repo filenames against the ledger gets a false "not applied" signal.
- **F-48** — `package.json` declares `"next": "^15.0.0"`. The range's floor is vulnerable to CVE-2025-29927, in which the `x-middleware-subrequest` header bypasses middleware entirely — which, given F-39, would be a complete admin compromise rather than a partial one. `package-lock.json` pins **15.5.18**, which is patched, and `^` only resolves upward, so this is not currently exploitable. Flagged solely because the entire admin gate rests on middleware executing; raising the floor to `^15.2.3` costs nothing.

---

### Non-security observations for the builder

Neither is a finding; both are worth knowing before content authoring.

- **`/other` has no draft state.** `notes_public_select` and `stats_public_select` are both `using (true)` for `anon` (verified live). Anything saved in the admin notes or stats form is world-readable the instant it is written — there is no `status` column and no unpublished state on either table. This is intentional per `014:36-37`, but it differs from how projects and posts behave, and the admin UI does not say so.
- **`stats.sort_order` has no append-on-insert trigger.** Migration `014:51` gives it `DEFAULT 0`, whereas `projects` and `posts` received `*_set_sort_order_default` BEFORE INSERT triggers at `012_sort_order.sql:134-178`. Every new stat therefore lands at position 0 and ties with every other stat. That is an ordering bug in the `/other` page you are about to populate, not a security issue — worth fixing before the seven rows go in rather than after.

---

### Summary Table (audit 24)

| Severity | Count | F-codes |
|---|---|---|
| Critical | 0 | — |
| High | 0 | — |
| Medium | 5 | F-39, F-40, F-41 (opened); F-3, F-4 (carry, re-verified open) |
| Low | ~26 | F-42–F-48 (opened); F-37 (audit 18); F-31–F-35 (audit 16); F-6–F-11, F-20–F-25, F-27, F-28 (carry) |

**Opened audit 24:** F-39, F-40, F-41 (Medium); F-42, F-43, F-44, F-45, F-46, F-47, F-48 (Low).
**Closed audit 24:** None.
**Carry-forward re-verified this audit:** F-3 — `EMAIL_SCHEMA` at `lib/auth-internal.ts:20` is still `z.string().min(1).email()` with no `.max(254)`. F-4 — `VALID_EMAIL_OTP_TYPES` at `app/(admin)/admin/auth/callback/route.ts:17-22` still includes `recovery` and `email_change` alongside `magiclink`. Both unchanged since audit 19.

**Verdict:** CLEAR — no Critical or High findings. T46 stands as shipped; nothing requires a rollback or an emergency fix. The five Mediums are documented and tracked, not blocking.

**Recommended order if these are addressed:** F-41 first (one-line revoke, zero risk, closes two advisor WARNs), then F-40 (one-word change), then F-39 (the real work, and the one that actually changes the security posture). F-42 and F-48 are minutes each. Next security review point: after builder content authoring, as part of the T40 close-out.

---

## Audit 24b (2026-08-04) — remediation of F-39, F-40, F-41

The builder elected to close all three Mediums immediately rather than carry them. This section records what was changed and how each fix was verified. It is a remediation record, not a fresh audit pass — the audit-24 findings above stand as written, with the three entries below now marked CLOSED.

### F-41 — CLOSED. EXECUTE revoked from `rls_auto_enable()`

`supabase/migrations/015_revoke_rls_auto_enable_execute.sql` created and applied to production. Idempotent, guarded by a `to_regprocedure` existence check so it does not fail on an environment where the platform has not installed the function. Revokes EXECUTE from `public`, `anon` and `authenticated` individually — naming all three matters, because Supabase's default privileges grant directly to `anon` and `authenticated` in a way that survives a revoke from `public` alone (the same trap 010a and 012a document).

**Verified three ways, all post-apply:**
- `pg_proc.proacl` for `rls_auto_enable` now reads `postgres=X/postgres | service_role=X/postgres`. The `anon` and `authenticated` grants are gone.
- **The auto-enable behaviour still works.** This was the one real risk in the fix, so it was tested rather than assumed: a throwaway table `public._rls_guard_check` was created, `pg_class.relrowsecurity` read back as `true`, and the table dropped (`leftover = 0`). Postgres does not consult EXECUTE privilege when firing an event trigger, so revoking the grants removed the PostgREST RPC path without touching the DDL hook. Had this come back `false`, every future table would have shipped with row security off — hence the empirical check.
- Supabase security advisors went from **5 WARN to 3**. Both `anon_security_definer_function_executable` and `authenticated_security_definer_function_executable` cleared. The three remaining are the two pre-existing `function_search_path_mutable` lints (F-45's `set_updated_at`, and `prevent_slug_change_after_publish`) and `auth_leaked_password_protection`, which stays moot under CONSTRAINT-09.

Migration ledger is now `[007, 009, 010, 010a, 011, 012, 012a, 013, 014, 015]`.

### F-40 — CLOSED. The admin gate now verifies the token

`middleware.ts` switched from `supabase.auth.getSession()` to `supabase.auth.getUser()`, branching on `data.user` instead of `data.session`. A forged cookie with a valid-looking `exp` no longer passes the gate — `getUser()` round-trips to Supabase and validates the signature server-side. Cost is one auth request per gated admin page load, which is the correct price for the only check standing in front of `/admin`.

**Test-suite consequence worth recording.** `tests/middleware.test.ts` stubbed `{ auth: { getSession } }`. When the source switched to `getUser`, only **2 of 15** tests failed — which is a worse signal than 15 failing. The reason: `getUser` was `undefined` on the stub, so every call threw, and every test that did not explicitly assert on the redirect reason folded silently into the outcome-D "unexpected error" branch. S1-S6 uniformity, both F-16 boundary tests and L1 were all passing green while exercising one branch three times over. The stubs now stub `getUser` and resolve the `{ data: { user }, error }` shape, so those tests exercise the branches they name.

A second latent gap surfaced in the same file: the `should-never-leak-access` / `should-never-leak-refresh` sentinel values existed only on the `'present'` fixture, while the SEC-05 no-leak test L1 looped over `none | error | throw`. Those strings could never have appeared in any log L1 inspected — the assertion passed by construction. Sentinels are now planted on every object the gate could serialize (the user object, the returned error, and the thrown cause), L1's loop covers `present` as well, and a `not.toContain('should-never-leak')` assertion was added. **L1 was strengthened, not weakened, as part of closing F-40.**

### F-39 — CLOSED. Admin Server Actions now authenticate before they act

New guard `assertAdminSession(client?)` at `lib/session.ts`, wired into **all 17 admin mutation Server Actions** across 7 modules: `admin-projects-mutations` (3), `admin-posts-mutations` (3), `admin-stats-mutations` (3), `admin-notes-mutations` (3), `admin-images-mutations` (2), `admin-project-media-mutations` (1), `admin-reorder-mutations` (2).

**`lib/auth.ts` was deliberately left alone.** `signInWithMagicLink` and `signOut` must remain callable without an existing session; guarding them would lock the builder out of their own login.

Four design decisions, each load-bearing:

1. **The guard sits at the wrapper layer, not the internal layer.** The `'use server'` wrappers are the client-reachable boundary — the `-internal.ts` helpers are not addressable via `Next-Action` at all. Guarding the wrappers closes the hole exactly, and leaves the internal helpers' DI seam and pure-throwing contract intact, which is why roughly ten stub-based test files needed no changes.
2. **The call goes INSIDE the existing `try`, as its first statement.** Placing it before the `try` would have put the rejection outside `finally { await padToFloor(start); }`, making an unauthenticated caller distinguishable by response time (SEC-09 Channel 3), and outside the `catch` that converts throws into the uniform envelope (Channel 2). Inside the `try`, an unauthenticated response is byte-identical and time-identical to any other failure.
3. **It throws rather than returning a boolean.** A guard whose failure mode is a falsy return is one forgotten `if` away from being a no-op.
4. **It lives in a directive-free module.** Exporting it from any `'use server'` file would promote it to a Server Action and hand every client a wire-level "is an admin session present?" oracle — a probe channel orthogonal to the six-channel contract (SEC-08).

The guard uses `getUser()`, not `getSession()`, for the same reason as F-40. The dead `getServerSession()` that previously occupied `lib/session.ts` — zero import sites outside its own test, and the module's JSDoc actively argued that a presence check was sufficient — was removed. That reasoning is retired, and the CQ-05 dead-code instance went with it.

**Collateral fix (CQ-02).** `lib/admin-projects-mutations.ts` had shipped at 309 lines in T46, already over the 300-line cap, and the guard wiring pushed it to 319. Rather than defer a third time, the FormData readers and the zod-error field mapper were split into a new directive-free `lib/admin-projects-mutations-formdata.ts`. Those helpers were previously module-private inside the `'use server'` file, which is what kept them off the action surface; a directive-free module preserves that property exactly. Result: 176 + 198 lines, both under the cap.

### Verification gates, all run after the full change set

- `npx tsc --noEmit` — clean.
- `npx vitest run` — **393 passed / 393, 51 files, 0 failures.** Net +11 tests: 7 new TS-01 error-case tests (one per wrapper module, each asserting the guard's rejection produces that module's exact envelope via `toEqual` and that the internal helper is never called), plus `tests/session.test.ts` rewritten 7 → 11 against the new guard contract including a SEC-05 aggregate no-leak assertion. A new `tests/admin-notes-mutations.test.ts` was created because the notes surface shipped in T46 with **no test file at all** — a TS-01 gap that this remediation incidentally closed.
- `npm run build` — exit 0, 18 routes.
- `tests/server-actions-manifest.test.ts` — **re-run against the fresh build**, green. The allowlist is still exactly 19 IDs, confirming that importing `assertAdminSession` into seven `'use server'` modules added no new action ID. This is the check that matters most for SEC-08 after a change of this shape, and it was deliberately run post-build rather than against a stale `.next`.
- Live advisor delta re-queried post-migration: 5 WARN → 3 WARN.

### Posture change

Admin authorization was single-layered on Postgres RLS. It is now two-layered: an authentication check in application code at every client-reachable mutation boundary, plus RLS as the authoritative resource-level gate. A future bad RLS policy is once again a caught error rather than an immediate unauthenticated write path — which was the whole point of F-39.

**Still open from audit 24:** F-3, F-4 (Medium, carry-forward, pre-date this session), and the Lows F-42 through F-48. F-45 in particular is now the last remaining source of a live advisor WARN and is a one-line fix whenever `set_updated_at` is next touched.

**Not yet deployed.** All of the above is committed locally but not pushed. The middleware and Server Action changes alter production auth behaviour on every admin request, so the deploy is a deliberate builder decision, not an automatic consequence of the fix.
