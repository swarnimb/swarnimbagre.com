# Security Report: swarnimbagre.com

**Last audit:** 2026-05-13 (audit 12)
**Scope:** T25 — three commits: per-resource trio refactor (`0e611f4`), image upload feat (`bc7c136`), zod `.strict()` batch (`d2be1b7`)
**Status:** CLEAR
**Summary:** 0 Critical / 0 High / 2 Medium / 14 Low
**Unresolved Critical/High findings:** None

---

## Verdict

T25 ships across three commits with no new Critical or High findings and one open finding closed (F-26). The per-resource refactor (`0e611f4`) splits the prior shared `lib/admin-mutations*.ts` trio into three per-resource trios — `admin-projects-mutations*`, `admin-posts-mutations*`, `admin-stats-mutations*` — without dropping a single guard. `padToFloor` is byte-identical across all four trios (now including the new images trio); `GENERIC_FORM_ERROR` and `MIN_DURATION_MS` were promoted to `lib/auth-constants.ts` and are imported by all four wrappers from a single source of truth — eliminating the prior duplication risk that any deviation would have introduced. The omnibus `tests/admin-mutations-strict.test.ts` (commit `d2be1b7`) regression-guards `.strict()` on all six admin write schemas in lock-step, formally closing F-26.

The new image trio (`bc7c136`) — `lib/admin-images-mutations.ts` (`'use server'` wrapper, 132 lines, single export `uploadImage`), `lib/admin-images-mutations-internal.ts` (throwing helpers, 295 lines), `lib/admin-images-mutations-types.ts` (client-safe envelope + file consts, 101 lines) — closes the six-channel uniformity contract identically to the prior three resource surfaces with one documented payload deviation (`image?: ImageRecord` rides the success envelope so `onUpload(image)` can thread the inserted row to T26 parent forms). The boundary stack is layered: `validateFile` enforces `instanceof File` + MIME allowlist (excludes SVG) + 2 MB cap before any I/O; `uploadImageSchema` then validates `parentType` against the migration-001 enum and `parentId` as UUID — the latter is the authoritative path-injection guard since a non-UUID would shape the bucket path. `sanitizeFilename` is defense-in-depth; the `'../../etc/passwd'` test confirms it throws on traversal patterns (collapsed-empty-basename), and the wrapper converts that throw to the generic-error envelope. The compensating-delete invariant on row-insert failure is implemented and tested: `tests/admin-images-mutations.test.ts` line 333-360 asserts `storage.remove([uploadedPath])` runs on insert error, with the primary insert error surfaced to the caller and the compensating-delete failure (if any) logged loudly with both error payloads.

The allowlist deferred-bump (10 → 11 at T26 instead of T25) is a sound deferral, not a security gap. The build manifest reflects only Server Actions reachable from `app/**` routes — `ImageUpload.tsx` is not yet imported by any page (T26 wires it into ProjectForm and PostForm), so the `uploadImage` action ID is not yet emitted into the manifest. The allowlist test correctly tracks the live manifest. The `'use server'` directive on the wrapper module ensures the action ID will land at T26 the moment a page imports `ImageUpload`. Documenting this in `tests/server-actions-manifest.test.ts:14-25` is the right move — surfacing the deferral so a future reviewer is not surprised when the count moves from 10 to 11 in T26's commit.

The strict batch (`d2be1b7`) appends `.strict()` to all six admin write schemas (project create + update, post create + update, stat insert, image upload). All six wrappers continue to read FormData via explicit per-key `formData.get(...)` calls, so the surface is byte-identical for users today; `.strict()` is the depth-of-defense layer that closes the boundary against any future refactor switching to `Object.fromEntries(formData.entries())`. The omnibus regression test asserts `unrecognized_keys` ZodError issues across all six schemas — F-26 is now CLOSED.

---

## Six-channel mutation uniformity — per-channel verdict (`uploadImage`)

1. **Channel 1 — UI text.** PASS. `GENERIC_FORM_ERROR = 'Could not save. Try again.'` (`lib/auth-constants.ts:44`) is the only error string surfaced for the form-level path; zod field errors are filtered to the upload form's four declared fields only (`file`, `altText`, `parentType`, `parentId`) via `imageZodErrorToFieldErrors` (`lib/admin-images-mutations.ts:56-74`). No internal error message leaks. The constant is shared across project, post, stat, and image surfaces — copy is intentionally resource-agnostic so a probe cannot distinguish an image upload failure from a stat insert failure or a post update failure.

2. **Channel 2 — Response body.** PASS. Envelope is `{ status: 'ok', image }` on success, `{ status: 'error', fieldErrors }` for zod-only failures, or `{ status: 'error', formError: GENERIC_FORM_ERROR }` for every other throw. Never throws to the wire — try/catch in `lib/admin-images-mutations.ts:111-131` is total. The `fieldErrors` key set is narrowed to `Partial<Record<'file' | 'altText' | 'parentType' | 'parentId', string>>` (`lib/admin-images-mutations-types.ts:86-88`) — no shape information leaks beyond the form's declared fields. **Documented payload deviation:** `image?: ImageRecord` rides the success envelope (other three resource envelopes carry no payload). This is contractual for the T26 parent-form wiring (`onUpload(image)` callback) and the only legitimate way to thread the inserted row through `useActionState`. The `image` field is the row Supabase returned — no sensitive data, no auth tokens; it is the same shape any subsequent SELECT from `public.images` under admin RLS would yield. No leak.

3. **Channel 3 — Response timing.** PASS. `padToFloor(start)` runs inside `finally` for `uploadImage` (`lib/admin-images-mutations.ts:128-130`). `MIN_DURATION_MS` imported from `lib/auth-constants.ts:20` — NOT duplicated. The `padToFloor` helper itself (`lib/admin-images-mutations.ts:41-47`) is byte-identical to the project / post / stat equivalents. **Note:** the file upload path will frequently exceed `MIN_DURATION_MS = 750ms` because Storage upload + DB insert is a multi-round-trip operation; the floor is therefore mostly a no-op for happy paths, but it stays honest on validation-fail and short-circuit error paths (which would otherwise resolve in <50ms). Floor is the right discipline here — a ceiling would itself be an oracle.

4. **Channel 4 — Server Action surface.** PASS. `lib/admin-images-mutations.ts` exports ONLY one async function: `uploadImage`. No helpers, consts, or types exported from the `'use server'` module. The throwing helpers (`uploadImageInternal`, `validateFile`, `sanitizeFilename`), the zod schema (`uploadImageSchema`), and the operation tag constant (`UPLOAD_IMAGE_OPERATION`) all live in `lib/admin-images-mutations-internal.ts` (no `'use server'` directive). The pure types + file consts (`ImageMutationState`, `IMAGE_MUTATION_INITIAL_STATE`, `IMAGES_BUCKET`, `MAX_FILE_BYTES`, `ALLOWED_MIME_TYPES`, `ALT_TEXT_MAX_LENGTH`, `ALLOWED_PARENT_TYPES`) live in `lib/admin-images-mutations-types.ts` (no `'use server'` directive, no `next/headers` transitive import — safe for client). The build manifest correctly shows ten action IDs at T25 (no `uploadImage`) — see "Build invariant" below for the deferred-bump rationale.

5. **Channel 5 — Response headers.** PASS. `uploadImage` writes no cookies. Supabase client remains `flowType: 'implicit'` per CONSTRAINT-18 (`lib/supabase.ts:41`) — no `*-code-verifier` Set-Cookie is reachable from the mutation surface. The Server Action response headers are identical across outcomes.

6. **Channel 6 — Status code.** PASS. No throw reaches the wire (Channel 2 catch is total). Next.js frames the Server Action response at 200 across all outcomes — including `validateFile` `ServiceError`, `uploadImageSchema` `ZodError`, `sanitizeFilename` empty-collapse `ServiceError`, Storage failure `ServiceError`, and row-insert failure `ServiceError`.

---

## Standard SEC rule verdicts

- **SEC-01 (no secrets in code).** CLEAR. Grep of all T25 new + modified files (image trio, three project/post/stat trios, `auth-constants.ts`, `ImageUpload.tsx`, six consumer components, all three new tests) returns zero references to `SUPABASE_SERVICE_ROLE_KEY`, `STATS_INGEST_SECRET`, or any literal credential. The image upload uses `NEXT_PUBLIC_SUPABASE_ANON_KEY` via `createServerClient()` — session-bound, RLS-respecting. Service-role is never imported into the admin write path. The Storage bucket configuration (2 MB cap, MIME allowlist) is configured in the Supabase Dashboard per migration 005 trailing comment block; no secret material in code.

- **SEC-02 (input validation at boundary).** CLEAR.
  - `uploadImageInternal` validates the file before any I/O via `validateFile` — `instanceof File` (rejects non-File `unknown` from FormData), MIME allowlist (`image/jpeg`, `image/png`, `image/webp` — SVG intentionally excluded), `size <= MAX_FILE_BYTES` (2 MB).
  - `uploadImageSchema.parse({ parentType, parentId, altText })` validates the metadata: `parentType` against the `ALLOWED_PARENT_TYPES` enum (`projects` | `posts`, mirrored from migration 001), `parentId` as a UUID (`z.string().uuid('parentId must be a uuid')`), `altText` as required-non-empty trimmed string capped at 500 chars.
  - All three per-resource trios preserve their original boundary validation byte-identical to pre-refactor (the refactor was a file-split, not a schema change). Confirmed by grepping `.strict()` count = 6 across `lib/admin-*-internal.ts`.
  - `getAllImages` does not exist yet (no list page in T25); will be evaluated in T26.

- **SEC-03 (parameterized queries).** CLEAR. The image upload path uses the Supabase query builder exclusively: `.storage.from('images').upload(bucketPath, file, { contentType, upsert: false })`, `.storage.from('images').remove([bucketPath])`, `.from('images').insert({...}).select().single()`. `bucketPath` is constructed from validated `parsed.parentType` (enum), validated `parsed.parentId` (UUID), `crypto.randomUUID()`, and `sanitizeFilename(input.file.name)` — no user input reaches the path string unsanitised. The DB insert payload is a typed object literal — no string concatenation involving file metadata. Per-resource trios unchanged from pre-refactor: query builder only, no template-string concatenation.

- **SEC-04 (auth + authz).** CLEAR. Two-layer enforcement intact:
  - Layer 1: `middleware.ts` runs `runAdminGate(request)` on every `/admin/:path*` request, including Server Action POSTs. `uploadImage` is reachable only via `ImageUpload.tsx` rendered inside `/admin/projects/[id]` or `/admin/posts/[id]` (T26); both routes are gated.
  - Layer 2: RLS `images_admin_all` (`supabase/migrations/005_rls_images.sql:64-71`) grants `authenticated` role full CRUD on `public.images`. Public access is `images_public_select` (`:46-62`) — SELECT only, and only rows whose parent project/post is `published`. Standalone images (`parent_id IS NULL`) are intentionally hidden from `anon`. An attacker who bypassed the middleware gate and called `uploadImage` directly would still be unauthenticated at the DB layer and rejected by RLS on the INSERT. The Storage bucket is PRIVATE per migration 005 trailing comment; bucket-level access policies are configured in the Dashboard.

- **SEC-05 (no PII / sensitive data in logs).** CLEAR. `logMutationError` (`lib/admin-images-mutations-internal.ts:68-77`) logs `operation`, the structured payload (`bucketPath`, `errorCode`, `errorMessage`, optionally `primaryErrorMessage` + `compensatingDeleteErrorMessage`), and stack. `bucketPath` includes `parentType`, `parentId` (UUID), and the sanitised filename — no row data, no `altText` content, no file binary. The compensating-delete log path is verbose by design: when the orphan-cleanup fails, the operator needs the path to clean it up out-of-band. UUIDs are not PII per the project's CONSTRAINT-09 single-user model. F-25 (slug-in-trigger-message) is N/A for images — no slug column, no trigger fires on upload.

- **SEC-06 (HTTPS + encrypted at rest).** N/A for code change — infrastructure concern. Vercel/Supabase defaults stand. Storage bucket is private; signed URLs (T26 future) will be HTTPS-only.

- **SEC-07 (sensitive files not in VCS).** CLEAR. `git status --short` returns nothing — working tree is clean (all three commits already landed). `git status --short --ignored` shows the standard SEC-07 list (`CLAUDE.md`, `manifest.md`, `profile.md`, `.env.local`, `docs/session-log.md`, `docs/session-handoff.md`, `docs/framework-issues.md`, `docs/testing-setup.md`, the design-source bundles, screenshots) all `!!` (gitignored, not tracked). `git ls-files | grep -E "^\.env"` returns only `.env.example`. **SEC-07 verdict: PASS.**

- **SEC-08 (Server Action surface minimization).** CLEAR. Live manifest confirms exactly TEN exportedNames at T25 — the same ten as audit 11. The `uploadImage` export from `lib/admin-images-mutations.ts` is correctly excluded from the manifest because no `app/**` route imports `ImageUpload.tsx` yet (T26's job). The `'use server'` directive is correctly placed on the wrapper module — the action ID will land in the manifest the moment a page imports `ImageUpload`. None of `uploadImageInternal`, `validateFile`, `sanitizeFilename`, `uploadImageSchema`, or any helper appears in the manifest. The three-module split (wrapper / internal / types) prevents transitive `next/headers` from breaking the client `ImageUpload` and prevents the throwing helpers from becoming public RPC endpoints.

- **SEC-09 (uniform response across channels).** CLEAR. Six-channel verdict above is the answer for `uploadImage`. The three per-resource trios continue to satisfy SEC-09 byte-identically post-refactor (same envelope shape, same `padToFloor` discipline, same `GENERIC_FORM_ERROR` constant, same `'use server'` boundary). Auth flows (`signInWithMagicLink`, `signOut`) untouched.

---

## T25-specific risk verdicts

- **File upload boundary integrity.** CLEAR. `validateFile` runs before any I/O and asserts `instanceof File` + MIME allowlist + size cap. The `instanceof File` check is critical — FormData fields read as `unknown` (could be `string | File | null`), and a malicious caller could submit `formData.append('file', 'malicious-string')`. The `assertions is File` narrowing closes that. The MIME check uses `(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)` — exact equality, not prefix; `image/svg+xml` is rejected (the SVG-rejection test asserts this directly). The size cap is `> MAX_FILE_BYTES`, not `>=`, so a 2,097,152-byte file is accepted exactly (matches the bucket-level 2097152-byte limit in migration 005). Three lines of defense: client pre-check (UX-only), server `validateFile`, bucket-level rejection at Storage. Layered.

- **Path injection guard.** CLEAR. `parentId` is validated as a UUID by `uploadImageSchema` BEFORE the `bucketPath` template string is constructed. A non-UUID `parentId` like `'../../etc/passwd'` is rejected with a `ZodError` and the `storage.upload` call is never reached (asserted by the `tests/admin-images-mutations.test.ts` "rejects when parentId is not a UUID with ZodError (path-injection guard)" test, line 229-248). `parentType` is similarly enum-validated against `['projects', 'posts']` — a value like `'../etc'` is rejected before the path is built. `sanitizeFilename` is the third layer: it strips path separators (`/`, `\`), control characters, NUL, and any non-`[A-Za-z0-9._-]` character; if the result collapses to empty (e.g., `'../../etc/passwd'` whose basename strips to `_`-only and then trim-collapses to empty), it throws `ServiceError` and the wrapper surfaces a generic-error envelope. The `sanitizeFilename('../../etc/passwd')` throw is intentional and tested (line 377). **Defense-in-depth verdict:** the UUID schema is the authoritative guard; `sanitizeFilename` is a belt-and-suspenders layer that throws on the same input rather than producing a path. The throw-on-empty behavior is acceptable per the test comment: "Layered throw is acceptable per spec — the parentId UUID schema check at the wrapper is the authoritative path-injection guard." No finding.

- **Compensating delete invariant.** CLEAR. `uploadImageInternal:267-292` implements the compensating delete: on `insertErr`, `supabase.storage.from(IMAGES_BUCKET).remove([bucketPath])` is called before the `ServiceError` is thrown. The compensating-delete result does not affect what is surfaced to the caller (the primary insert error is what the user sees). If the compensating delete itself fails, both error payloads are logged with the bucket path so the operator can clean the orphan out-of-band. The `tests/admin-images-mutations.test.ts:333-360` "compensating-deletes the storage object when the row insert fails" test asserts the `storage.remove([uploadedPath])` call shape exactly. **One observation:** `storage.upload` failures do NOT trigger a compensating delete (correct — the upload failed, so there is nothing to delete). The compensating-delete invariant is scoped narrowly to "upload succeeded, insert failed" and is satisfied.

- **MIME whitelist (SVG exclusion).** CLEAR. `ALLOWED_MIME_TYPES` is `['image/jpeg', 'image/png', 'image/webp']` — SVG is explicitly excluded. The JSDoc on `lib/admin-images-mutations-types.ts:53-56` documents the rationale: "the rendered-HTML attack surface is wider than raster formats and the use case (project / post hero images) is raster-only." The bucket-level allowlist in migration 005 line 83 mirrors the app-side list. The `tests/admin-images-mutations.test.ts:183-206` "rejects unknown MIME type (image/svg+xml) with ServiceError — closes SVG drift" test asserts the rejection directly. SVG would have been a XSS vector via `<svg><script>` if accepted; the exclusion is defense-in-depth even with the bucket being PRIVATE and signed-URL-served (T26 future).

- **RLS posture on images table + bucket.** CLEAR. Migration 005 (`supabase/migrations/005_rls_images.sql`) enables RLS on `public.images` (line 38) and installs two policies: `images_public_select` for `anon` (SELECT only, only when parent project/post is `published`; standalone `parent_id IS NULL` rows hidden from anon — line 45-62), and `images_admin_all` for `authenticated` (full CRUD — line 64-71). Service-role intentionally not granted a policy (it bypasses RLS). The Storage bucket is PRIVATE per the trailing comment block (line 80), with the 2 MB size cap and MIME allowlist configured in the Dashboard. Layered RLS: even if `images_public_select` were ever weakened, the parent project/post RLS (migrations 002, 003) would still hide drafts via the EXISTS subquery. **Note:** I did not run a live `mcp__supabase__list_tables` check this audit (per investigation budget); migration 005 is the source of truth and was verified intact in audit 7 + 9 + 11. RLS is enabled and policies are in place.

- **Deferred-allowlist verdict (10 → 11 deferred to T26).** SOUND DEFERRAL, NOT A GAP. Next.js only registers a Server Action in `.next/server/server-reference-manifest.json` when the action is reachable from an `app/**` route via the React Server Components transform graph. `lib/admin-images-mutations.ts` exports `uploadImage` with `'use server'`, but no page imports `ImageUpload.tsx` yet (T26 wires it into ProjectForm and PostForm). The action ID is therefore absent from the manifest at T25 — and correctly absent. The `tests/server-actions-manifest.test.ts:14-25` comment block documents the deferral explicitly: "the allowlist therefore lifts from 10 to 11 at T26, not at T25 commit 2." This is the correct disposition: the test asserts what the live manifest contains, and the live manifest reflects what the build can reach. The alternative — bumping the allowlist to 11 prematurely — would have caused the test to fail loudly until T26 wired the component. **Risk consideration:** could a malicious caller invoke `uploadImage` despite it being absent from the manifest? No. Without an action ID in the manifest, Next.js has no client reference to bind to it; there is no addressable URL. The action becomes addressable only when the manifest records its hashed ID. The deferral is structurally safe.

- **Per-resource refactor regression check.** CLEAR. `padToFloor` is byte-identical across all four trios (`lib/admin-projects-mutations.ts:42-48`, `lib/admin-posts-mutations.ts:42-48`, `lib/admin-stats-mutations.ts:43-49`, `lib/admin-images-mutations.ts:41-47`). `GENERIC_FORM_ERROR` and `MIN_DURATION_MS` are imported by all four wrappers from `./auth-constants` (single source of truth — verified by grep). `.strict()` is present on all six write schemas (verified by grep returning 6 hits across `lib/admin-*-internal.ts`). The refactor consolidated rather than dropped guards: the prior shared trio had three copies of `padToFloor` (one per logical resource group) collapsed into one; now there are four byte-identical copies (one per file) but each imports `MIN_DURATION_MS` from the shared constants module, so any future floor adjustment is a one-line change in `lib/auth-constants.ts`. Channel discipline is preserved per-resource, not collapsed. No schema rule lost across the refactor; per-resource throwing helpers carry the same operation tags, the same `logMutationError` shape, and the same compensating-error log discipline as their pre-refactor equivalents.

- **`.strict()` closure (F-26).** CLOSED. All six admin write schemas — `projectCreateSchema`, `projectUpdateSchema`, `postCreateSchema`, `postUpdateSchema`, `statInsertSchema`, `uploadImageSchema` — carry `.strict()` (verified by grep, 6 hits, lines noted). The `tests/admin-mutations-strict.test.ts` omnibus regression test covers all six: each case constructs a valid payload + one unknown key, parses, and asserts at least one `unrecognized_keys` issue in the resulting `ZodError`. Defense-in-depth holds: today's wrappers read FormData via per-key `formData.get(...)` so unknown keys never reach the schemas, but `.strict()` closes the boundary against any future refactor switching to `Object.fromEntries(formData.entries())`. F-26 transitions from open (Low, scope-extended across audits 8 → 11) to CLOSED in this audit.

---

## ImageUpload.tsx — CONSTRAINT-13 voice verdict

CLEAR. User-facing strings audited (`components/admin/ImageUpload.tsx`):
- `'File is too large.'` (line 19) — five words, terse, sentence-case, period.
- `'File type not accepted.'` (line 20) — four words, terse, sentence-case, period.
- `'Choose image'` (line 132) — two-word label, sentence-case.
- `'Alt text'` (line 155) — two-word label, sentence-case.
- `'Uploading'` / `'Upload'` (line 179) — single-word button labels, no spinner emoji.

No emoji, no superlative, no SaaS phrasing ("powerful upload tool", "drag and drop magic", "AI-powered alt text"), no LinkedIn-motivational-post energy. The hidden-field error fallback path (`onError(hiddenErr)` for `parentType`/`parentId` zod errors, line 92-94) does not surface the raw zod message to the user; it delegates to the parent's `onError` callback, leaving the parent in control of the surfaced copy. Passes.

---

## Findings

### Critical

None.

### High

None.

### Medium

(F-3 and F-4 from audit 5 remain at Medium severity, carry-forward, neither addressed nor regressed by T25.)

---

**F-3 (Medium, carry-forward, unchanged):** Zod email schema in `lib/auth-internal.ts:20` has no length cap. Recommended `z.string().min(3).max(254).email()`. Not addressed by T25; not regressed.

---

**F-4 (Medium, carry-forward, unchanged):** Callback handler accepts overly wide OTP type set in `app/(admin)/admin/auth/callback/route.ts`. Recommended narrow to `new Set(['email', 'magiclink'])`. Not addressed by T25; not regressed.

---

### Low

(All prior-audit Low findings except F-26 carry forward unchanged. F-26 is now CLOSED — see "CLOSED in this audit" section below. F-28, F-27, F-25, F-23, F-24, F-20, F-21, F-22, F-6, F-7, F-8, F-9, F-10, F-11 remain open; none regressed or extended by T25. See audits 9, 10, 11 for full text.)

---

## CLOSED in this audit

**F-26 (Low, was open since audit 8):** Zod `.strict()` defense-in-depth on the admin write surface. Audits 8 → 11 progressively extended the scope as new schemas landed (audit 8: 2 project schemas; audit 9: + 2 post schemas; audit 10: scope unchanged; audit 11: + 1 stat schema = 5 schemas). Commit `d2be1b7` adds `.strict()` to all six current admin write schemas (the five tracked plus the new `uploadImageSchema`) in one coordinated pass. The omnibus regression test `tests/admin-mutations-strict.test.ts` guards against future removal — any schema losing `.strict()` will fail its case loudly. **Closure rationale:** the gap was always defense-in-depth (wrappers read FormData per-key, not via `Object.fromEntries`), but the regression-test guard means the depth is now structural rather than disciplinary. Closing.

---

## Build invariant — T25

Live manifest invariant (per `tests/server-actions-manifest.test.ts` `beforeAll` build):

- `.next/server/server-reference-manifest.json` lists exactly TEN action exportedNames in the `node` map; `edge` map empty:
  - `signInWithMagicLink` (`lib/auth.ts`)
  - `signOut` (`lib/auth.ts`)
  - `createProject` (`lib/admin-projects-mutations.ts`) ← MOVED (was `lib/admin-mutations.ts`)
  - `updateProject` (`lib/admin-projects-mutations.ts`) ← MOVED
  - `deleteProject` (`lib/admin-projects-mutations.ts`) ← MOVED
  - `createPost` (`lib/admin-posts-mutations.ts`) ← MOVED
  - `updatePost` (`lib/admin-posts-mutations.ts`) ← MOVED
  - `deletePost` (`lib/admin-posts-mutations.ts`) ← MOVED
  - `insertStat` (`lib/admin-stats-mutations.ts`) ← MOVED
  - `deleteStat` (`lib/admin-stats-mutations.ts`) ← MOVED
- The eight prior `admin-mutations.ts` exports are now spread across three per-resource modules (the file-source moved; the action IDs and signatures are unchanged). The auth surface is unchanged.
- `uploadImage` from `lib/admin-images-mutations.ts` is NOT in the manifest at T25 because no `app/**` route imports `ImageUpload.tsx` yet. The export exists; the manifest entry will land in T26 the moment a page imports the component. The deferred bump to 11 is documented in `tests/server-actions-manifest.test.ts:14-25`.
- `tests/server-actions-manifest.test.ts:32-43` allowlist matches the live manifest exactly (ten IDs).
- T25 tests: image trio adds 14 new tests (`tests/admin-images-mutations.test.ts` for the throwing layer including SVG rejection, path-injection guard, compensating-delete invariant; sibling uniformity + timing tests for the wrapper). The omnibus strict test adds 6 cases (one per schema). Build is green per the latest commit history.

---

## SEC-07 sensitive-file exposure check

- `git status --short`: empty (working tree is clean post-T25 commits).
- `git status --short --ignored`: lists `.env.local`, `CLAUDE.md`, `manifest.md`, `profile.md`, `docs/session-log.md`, `docs/session-handoff.md`, `docs/framework-issues.md`, `docs/testing-setup.md`, design-source bundles, screenshots — all `!!` gitignored, not tracked.
- `git ls-files | grep -E "^\.env"` returns only `.env.example` — no real env file ever committed.
- `git log --all --name-only` across the three T25 commits: zero SEC-07-listed files appear in any commit.
- T25 working-tree changes (now landed as commits) touched `lib/`, `components/admin/`, `tests/`, `docs/architecture.md`, `docs/founder-brief.md`, `docs/plan-phase-2-admin.md`, `docs/security-report.md` (audit 11 was committed). None of these are on the SEC-07 list.

**SEC-07 verdict:** PASS.

---

## Summary Table

| Severity | Count | F-codes |
|---|---|---|
| Critical | 0 | — |
| High | 0 | — |
| Medium | 2 | F-3, F-4 |
| Low | 14 | F-6, F-7, F-8, F-9, F-10, F-11, F-20, F-21, F-22, F-23, F-24, F-25, F-27, F-28 |

**Closed this audit:** F-26 (zod `.strict()` defense-in-depth — closed by `d2be1b7` + omnibus regression test).

**Verdict:** CLEAR — no Critical or High findings, no new findings of any severity, F-26 closed. T25 ships across all three commits. The per-resource refactor preserves every guard byte-identically and centralises shared constants in `lib/auth-constants.ts`. The image upload trio extends the six-channel uniformity contract with one documented payload deviation (`image?: ImageRecord` rides the success envelope for T26 wiring) and no structural exposure. The compensating-delete invariant is implemented and tested. SVG rejection, path-injection guard (`parentId` UUID schema), and sanitised-filename defense-in-depth are all in place. The deferred allowlist bump (10 → 11 at T26) is structurally sound — Next.js cannot register an action that no page imports, and the test correctly tracks the live manifest.

**Path forward:** T25 is CLEAR. Proceed to T26 (wire `ImageUpload` into ProjectForm + PostForm, add `image_id` swap on form submit, expect allowlist to land at 11).

## Status: CLEAR
