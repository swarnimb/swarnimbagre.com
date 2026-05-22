# Security Report: swarnimbagre.com

**Last audit:** 2026-05-21 (audit 22 — T43.H wires `ProjectMediaCarousel` into public project cards + detail page + list pages; CLEAR)
**Scope:** T43.H delta. Modified — `app/projects/[slug]/page.tsx`, `components/public/ProjectMedia.tsx`, `components/public/ProjectCard.tsx`, `components/public/mobile/MobileProjectCard.tsx`, `components/public/pages/Projects.tsx`, `components/public/mobile/pages/Projects.tsx`, `tests/ProjectMedia.test.tsx`, `tests/MobileProjectCard.test.tsx`. Created — `tests/ProjectCard.test.tsx`. Out of scope: `ProjectMediaCarousel` / `ProjectMediaCarouselParts` / `BeforeAfterMedia` (audited CLEAR in audit 21 — T43.G, unchanged by T43.H); `loadPublicProjectMedia` + `getProjectMediaByProject` + migration 010 RLS (audited CLEAR in prior audits, unchanged); the `saveProjectMedia` Server Action + RPC + migration 010a (audited CLEAR in audit 19, unchanged).
**Status:** CLEAR
**Summary:** 0 Critical / 0 High / 2 Medium / ~19 Low (carry-forward F-3, F-4 Mediums unchanged; F-37 Low unchanged; no new findings opened in audit 22)

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
