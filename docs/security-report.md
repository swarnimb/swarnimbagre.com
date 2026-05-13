# Security Report: swarnimbagre.com

**Last audit:** 2026-05-13 (audit 10)
**Scope:** T23 — posts admin CRUD with raw Markdown storage and slug-lock (commit `c50b144`)
**Status:** CLEAR
**Summary:** 0 Critical / 0 High / 2 Medium / 14 Low
**Unresolved Critical/High findings:** None

---

## Verdict

T23 ships. The three new posts-side mutation Server Actions — `createPost`, `updatePost`, `deletePost` — close all six channels of the SEC-09 uniformity contract identically to the T20-T22 projects-side actions they mirror. The three-module split (`lib/admin-mutations.ts` `'use server'` wrapper / `lib/admin-mutations-internal.ts` throwing helper / `lib/admin-mutations-types.ts` pure types) is preserved exactly: the new wrappers live in `lib/admin-mutations.ts`, the new throwing helpers live in `lib/admin-mutations-internal.ts`, and the new `PostMutationState` + `POST_MUTATION_INITIAL_STATE` live in `lib/admin-mutations-types.ts`. `GENERIC_FORM_ERROR` is shared across project and post surfaces — resource-agnostic so cross-resource enumeration via copy differences is impossible.

Build is green. The live `.next/server/server-reference-manifest.json` lists exactly eight Server Action exportedNames: `signInWithMagicLink`, `signOut`, `createProject`, `updateProject`, `deleteProject`, `createPost`, `updatePost`, `deletePost`. The three new IDs are purely additive — no `*Internal` helper appears in the manifest. `tests/server-actions-manifest.test.ts` allowlist updated 5 → 8 in lock-step.

The slug-lock defense-in-depth holds for posts: `updatePostInternal` pre-fetches `status` and omits `slug` from the update payload when the existing row is `published` (`lib/admin-mutations-internal.ts:447-464`); the migration 006 trigger `posts_prevent_slug_change` (`supabase/migrations/006_slug_lock_triggers.sql:62-66`) is the layer-two DB guard. A regression in the app-side omit logic surfaces uniformly through the wrapper's catch as the generic form error envelope — wire shape stays indistinguishable.

Raw Markdown storage per CONSTRAINT-06 is enforced: `createPostInternal` and `updatePostInternal` pass the `content` string from FormData through zod's required-non-empty check (no transform, no trim) and on to the Supabase query builder verbatim. Render-time sanitization is the T12 `MarkdownContent` pipeline on the public-site read path (`app/writing/[slug]/page.tsx:121-129`), unchanged by T23. No new XSS surface is introduced — T23 does not render `content` as HTML anywhere; the admin edit view uses a plain `<Textarea>` (`components/admin/PostForm.tsx:144-152`), which renders the string as text, not HTML.

No new findings recorded. F-3 and F-4 carry forward from audit 5 unchanged. F-23, F-24, F-25, F-26, F-27 and F-6 through F-11, F-20 through F-22 carry forward from prior audits unchanged. F-26 (zod `.strict()` gap) now extends in principle to `postCreateSchema` and `postUpdateSchema` — same parse-the-form-only pattern, same low-grade defense-in-depth concern, no escalation.

---

## Six-channel mutation uniformity — per-channel verdict (`createPost` / `updatePost` / `deletePost`)

1. **Channel 1 — UI text.** PASS. `GENERIC_FORM_ERROR = 'Could not save. Try again.'` (`lib/admin-mutations-types.ts:73`) is the only error string surfaced for the form-level path; zod field errors are filtered to the post form's three declared fields only (`title`, `content`, `status`) via `postZodErrorToFieldErrors` (`lib/admin-mutations.ts:223-236`). No internal error message leak. The constant is shared with the project surface — copy is intentionally resource-agnostic so a probe cannot distinguish a post failure from a project failure.

2. **Channel 2 — Response body.** PASS. Envelope is `{ status: 'ok' }` on success, `{ status: 'error', fieldErrors }` for zod-only failures, or `{ status: 'error', formError: GENERIC_FORM_ERROR }` for every other throw. Never throws to the wire — try/catch in `lib/admin-mutations.ts:282-298` (create), `:317-335` (update), `:365-377` (delete) is total. The `fieldErrors` key set for posts is narrowed to `Partial<Record<'title' | 'content' | 'status', string>>` (`lib/admin-mutations-types.ts:53`) — no shape information leaks beyond the form's declared fields.

3. **Channel 3 — Response timing.** PASS. `padToFloor(start)` runs inside `finally` for all three actions (`lib/admin-mutations.ts:295-297`, `:332-334`, `:374-376`). `MIN_DURATION_MS` imported from `lib/auth-constants.ts:17` — NOT duplicated (verified: only one import reference in the mutation modules). All three new actions reuse the same `padToFloor` helper as the project surface.

4. **Channel 4 — Server Action surface.** PASS. Post-build manifest inspected directly:
   - `createPost`, `updateProject`, `deletePost`, `createProject`, `deleteProject`, `signInWithMagicLink`, `signOut`, `updatePost` → exactly eight entries; edge map empty.
   - `lib/admin-mutations.ts` exports ONLY six async functions (`createProject`, `updateProject`, `deleteProject`, `createPost`, `updatePost`, `deletePost`) — no helpers, consts, or types exported from the `'use server'` module. The three throwing internals (`createPostInternal`, `updatePostInternal`, `deletePostInternal`) and the three schemas (`postCreateSchema`, `postUpdateSchema`) live in `lib/admin-mutations-internal.ts` (no `'use server'` directive) and so do NOT enter the manifest.
   - `tests/server-actions-manifest.test.ts:21-30` allowlist updated to eight IDs; the test passes against the live manifest.
   - `components/admin/PostForm.tsx` and `components/admin/DeletePostButton.tsx` are `'use client'` only — no `'use server'` cross-leak.

5. **Channel 5 — Response headers.** PASS. None of the three post actions write cookies. Supabase client remains `flowType: 'implicit'` per CONSTRAINT-18 (`lib/supabase.ts:41`) — no `*-code-verifier` Set-Cookie is reachable from the mutation surface. The Server Action response headers are identical across outcomes.

6. **Channel 6 — Status code.** PASS. No throw reaches the wire (Channel 2 catch is total). Next.js frames the Server Action response at 200 across all outcomes.

---

## Standard SEC rule verdicts

- **SEC-01 (no secrets in code).** CLEAR. Grep of all twelve T23 files returns zero references to `SUPABASE_SERVICE_ROLE_KEY` or any literal credential. Only project-wide reference is `lib/env.ts:4` (env-presence list). The mutation surface uses `NEXT_PUBLIC_SUPABASE_ANON_KEY` via `createServerClient()` — session-bound, RLS-respecting. Service-role is never imported into the admin write path.
- **SEC-02 (input validation at boundary).** CLEAR.
  - `createPostInternal` / `updatePostInternal` parse `input` via `postCreateSchema` / `postUpdateSchema` (`lib/admin-mutations-internal.ts:315-319`, `:330-334`) — required-non-empty, 200-char title cap matching the DB CHECK, status enum locked to `'draft' | 'published'`.
  - `updatePostInternal` validates `typeof id === 'string' && id.length > 0` BEFORE the schema parse and BEFORE `createServerClient()` (`:426-431`).
  - `deletePostInternal` validates `typeof id === 'string' && id.trim().length > 0` BEFORE any DB call (`:510-515`).
- **SEC-03 (parameterized queries).** CLEAR. All three new mutation paths use the Supabase query builder exclusively: `.from('posts').insert(...)`, `.from('posts').update(...).eq('id', id)`, `.from('posts').delete().eq('id', id)`. No string concatenation involving `id`, `title`, `content`, `status`, or `slug` anywhere in the call chain. Grep for backtick-template-with-id across the new files returns no matches.
- **SEC-04 (auth + authz).** CLEAR. Two-layer enforcement intact:
  - Layer 1: `middleware.ts:151-157` runs `runAdminGate(request)` on every `/admin/:path*` request including Server Action POSTs (matcher at `:159-165` does not exclude POST). Unauthenticated → redirect to `/admin/login`, padded to `MIN_DURATION_MS` (`:69-75`).
  - Layer 2: RLS `posts_admin_all` (`supabase/migrations/003_rls_posts.sql:42-47`) grants `authenticated` role full CRUD; unauthenticated callers hit `anon` role and are denied. An attacker who bypassed the middleware gate and called `createPost`/`updatePost`/`deletePost` directly would still be unauthenticated at the DB layer and rejected by RLS.
- **SEC-05 (no PII / sensitive data in logs).** CLEAR. `logMutationError` (`lib/admin-mutations-internal.ts:96-106`) logs only `operation`, `errorCode`, `errorMessage`, and `stack`. No row data, no `content` body, no `id`, no `title` is logged. F-25's slug-in-trigger-message concern extends in principle to the new `updatePostInternal` (the trigger raise includes the slug), but the threat model is the same: an attacker who can read server logs already has worse access than an enumeration channel.
- **SEC-06 (HTTPS + encrypted at rest).** N/A for code change — infrastructure concern. Vercel/Supabase defaults stand.
- **SEC-07 (sensitive files not in VCS).** CLEAR. `git show --name-only c50b144` lists 12 files — all are application code or tests. No SEC-07-listed file appears in the commit or in `git log --all --name-only` (other than the allowed `.env.example`). `.gitignore:46-54` covers `CLAUDE.md`, `manifest.md`, `profile.md`, `content/`, `docs/session-log.md`, `docs/session-handoff.md`, `docs/testing-setup.md`, `docs/framework-issues.md`. Working tree clean post-commit.
- **SEC-08 (Server Action surface minimization).** CLEAR. Live manifest confirms exactly eight exportedNames — the six action wrappers in `lib/admin-mutations.ts` plus the two in `lib/auth.ts`. None of `createPostInternal`, `updatePostInternal`, `deletePostInternal`, `postCreateSchema`, `postUpdateSchema`, or `logMutationError` appears in the manifest. The three-module split prevents a transitive `next/headers` import from breaking the client `PostForm`; the `'use server'` discipline prevents the throwing helpers from becoming public RPC endpoints.
- **SEC-09 (uniform response across channels).** CLEAR. Six-channel verdict above is the answer for the mutation surface. Auth flows (`signInWithMagicLink`, `signOut`) untouched by T23.

---

## T23-specific risk verdicts

- **Raw Markdown XSS surface.** N/A for T23. CONSTRAINT-06: `content` is stored verbatim. The admin edit view renders it inside a `<Textarea>` (`PostForm.tsx:144-152`) which is HTML-text-only (the value attribute, not innerHTML). The public render path (`app/writing/[slug]/page.tsx:121-129`) routes through `MarkdownContent`, which uses the existing `marked` + `dompurify` sanitizer pipeline — unchanged by T23. F-9 (existing audit-5 finding — XSS regression test gap on the public sanitizer) carries forward; T23 does not introduce a new render surface.
- **Slug-lock CONSTRAINT-12.** CLEAR. Layer one: `updatePostInternal:447-464` omits `slug` from the update payload when `existing.status === 'published'`. The omit uses payload-key-construction, not `payload.slug = undefined` — the property is absent, not present-with-undefined (verified by `tests/admin-mutations.test.ts:454`: `Object.prototype.hasOwnProperty.call(payload, 'slug') === false`). Layer two: `supabase/migrations/006_slug_lock_triggers.sql:62-66` installs `posts_prevent_slug_change BEFORE UPDATE OF slug ON public.posts`. The trigger raises if a published row's slug changes; the wrapper's catch swallows to the uniform error envelope. Note: the commit message refers to "migration 008" — the actual migration is 006. Doc-text drift only, not a code or security gap.
- **No length cap on `content`.** Acceptable. `postCreateSchema.content: z.string().min(1)` has no `.max()` cap. The DB CHECK is `length > 0` (no upper bound). The threat model is admin-only (single user, authenticated, CONSTRAINT-09); a malicious admin attacking their own DB via a multi-megabyte body is not a realistic vector. No finding.
- **CSRF.** CLEAR. Next 15 Server Actions are CSRF-protected by signed action IDs + same-origin enforcement (framework default). `next.config.ts` has no `serverActions.allowedOrigins` opt-out. The three new action IDs are hashed and ship in the client bundle bound to the same-origin check.
- **IDOR / horizontal escalation.** N/A. Single-user system per CONSTRAINT-09; RLS `authenticated`-role policy is the gate either way. There is no notion of "your post vs. another user's post" — the admin owns every row.
- **`getPostById` / `getAllPosts` exposure.** CLEAR. Both admin queries use the session-bound `createServerClient()` and rely on RLS `posts_admin_all` for visibility. `getPostById` maps `PGRST116` to `null` (404 surface via `notFound()` in the page) — no error-text leak. `getAllPosts` defaults `pageSize=50`, hard-caps `MAX_PAGE=10_000` in the page (`app/(admin)/admin/posts/page.tsx:9`) to guard against abusive `OFFSET` values.
- **XSS via post title in confirm modal.** CLEAR. `DeletePostButton` passes `name={post.title}` to the reused `DeleteConfirmModal` (`components/admin/DeletePostButton.tsx:107`). The modal renders the name via JSX text children (verified in audit 9 against the same component) — React's default escaping handles every character. No `dangerouslySetInnerHTML` in `components/admin/`.

---

## PostForm / DeletePostButton — CONSTRAINT-13 voice verdict

CLEAR. User-facing strings audited:
- `'Saved.'` (`PostForm.tsx:25`) — single word, period.
- `'Deleted.'` (`DeletePostButton.tsx:12`) — single word, period.
- `'Edit post'` / `'New post'` (`PostForm.tsx:113`) — two-word sentence-case labels.
- `'Title'`, `'Content'`, `'Status'`, `'Slug'`, `'Draft'`, `'Published'` — single-word labels, no decoration.
- `'Saving'`, `'Save'`, `'Delete'`, `'Cancel'`, `'Deleting'` — single-word labels, no spinner emoji.
- `'Slug locked after publish. Edit the title only affects drafts.'` (`PostForm.tsx:181`) — terse, factual; slight grammar trip but not a CONSTRAINT-13 voice violation (no SaaS, no emoji, no superlative). Noting for `@cpo` polish, not a security finding.

No emoji, no superlative, no LinkedIn-motivational-post energy. Passes.

---

## Findings

### Critical

None.

### High

None.

### Medium

(F-3 and F-4 from audit 5 remain at Medium severity, carry-forward, neither addressed nor regressed by T23.)

---

**F-3 (Medium, carry-forward, unchanged):** Zod email schema in `lib/auth-internal.ts:20` has no length cap. Recommended `z.string().min(3).max(254).email()`. Not addressed by T23; not regressed.

---

**F-4 (Medium, carry-forward, unchanged):** Callback handler accepts overly wide OTP type set in `app/(admin)/admin/auth/callback/route.ts`. Recommended narrow to `new Set(['email', 'magiclink'])`. Not addressed by T23; not regressed.

---

### Low

---

**F-26 (Low, scope extended, carry-forward from audit 8):** Zod schemas lack `.strict()`. **Scope now includes `postCreateSchema` and `postUpdateSchema`** (`lib/admin-mutations-internal.ts:315-319`, `:330-334`) — same parse-FormData-only pattern, same low-grade defense-in-depth concern. Extra FormData keys (e.g., a probe sending `?role=admin`) are ignored by `formData.get('title' | 'content' | 'status')`, so the surface is non-exploitable in practice. Defense-in-depth fix: add `.strict()` to all four schemas (two project + two post) in one pass.

---

(All other prior-audit Low findings carry forward unchanged: F-27, F-25, F-23, F-24, F-20, F-21, F-22, F-6, F-7, F-8, F-9, F-10, F-11. None regressed or extended by T23. See audit 9 for full text.)

---

## Build invariant — T23

Post-`npm run build` (2026-05-13, audit 10):

- `.next/server/server-reference-manifest.json` lists exactly EIGHT action exportedNames in the `node` map; `edge` map empty:
  - `signInWithMagicLink` (`lib/auth.ts`)
  - `signOut` (`lib/auth.ts`)
  - `createProject` (`lib/admin-mutations.ts`)
  - `updateProject` (`lib/admin-mutations.ts`)
  - `deleteProject` (`lib/admin-mutations.ts`)
  - `createPost` (`lib/admin-mutations.ts`) ← NEW (T23)
  - `updatePost` (`lib/admin-mutations.ts`) ← NEW (T23)
  - `deletePost` (`lib/admin-mutations.ts`) ← NEW (T23)
  The five prior exportedNames are unchanged from audit 9 — the three new entries are purely additive. No `*Internal` helper or schema appears in either map.
- `tests/server-actions-manifest.test.ts:21-30` allowlist matches the live manifest exactly (eight IDs).
- T23 tests: `npm test` count moved 138 → 141 (+3 TS-04: raw-Markdown round-trip, slug-lock on published update, delete-row internal). Per commit message.

---

## SEC-07 sensitive-file exposure check

- `.env.local` exists locally and is matched by `.gitignore` rule `.env*` (with `!.env.example` exception).
- `git ls-files | grep -E "^\.env"` returns only `.env.example` — no real env file ever committed.
- `git show --name-only c50b144`: 12 files, all application code or tests. Zero SEC-07 files.
- `git log --all --name-only` across full history: zero SEC-07 files (only `.env.example`, which is allowed).
- Framework files (`CLAUDE.md`, `manifest.md`, `profile.md`, `docs/session-*.md`, `content/`) gitignored per existing project convention.

**SEC-07 verdict:** PASS.

---

## Summary Table

| Severity | Count | F-codes |
|---|---|---|
| Critical | 0 | — |
| High | 0 | — |
| Medium | 2 | F-3, F-4 |
| Low | 14 | F-6, F-7, F-8, F-9, F-10, F-11, F-20, F-21, F-22, F-23, F-24, F-25, F-26 (scope extended), F-27 |

**Verdict:** CLEAR — no Critical or High findings. T23 ships. The six-channel uniformity contract extends to the three new post mutation Server Actions with no regression and no new structural exposure. No new findings recorded; F-26 scope formally extended to cover the two new zod schemas (defense-in-depth, not exploitable in practice).

**Path forward:** T23 is CLEAR. Proceed to T24.
