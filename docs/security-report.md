# Security Report: swarnimbagre.com

**Last audit:** 2026-05-13 (audit 8)
**Scope:** T21 — projects admin create + edit forms (commit `ba8e367`)
**Status:** CLEAR
**Summary:** 0 Critical / 0 High / 2 Medium / 13 Low
**Unresolved Critical/High findings:** None

---

## Verdict

T21 ships. The mutation surface is the project's first application of the six-channel uniformity contract to a state-changing endpoint, extending the precedent set by `signInWithMagicLink` (T17). All six channels are correctly closed for BOTH `createProject` AND `updateProject`. The three-module split (`lib/admin-mutations.ts` `'use server'` wrapper / `lib/admin-mutations-internal.ts` throwing helpers / `lib/admin-mutations-types.ts` pure types) is the documented pattern in `docs/architecture.md` §6.6.6 and is implemented exactly as specified.

Build is green. `npm test` → 125/125 passing across 22 test files (matches expected count). Manifest contains exactly four action IDs: `signInWithMagicLink`, `signOut`, `createProject`, `updateProject`. No new code introduces a service-role import, raw SQL string, PII log payload, or mass-assignment escape hatch. CONSTRAINT-12 slug lock is layered correctly: app-level omit in `updateProjectInternal` AND DB-level trigger in `supabase/migrations/006_slug_lock_triggers.sql`.

Two new Low findings are recorded (F-25, F-26) — both informational, neither blocking. F-23 and F-24 from audit 7 carry forward unchanged; they were no-fix-accepted then and remain so. F-20 doc polish carries forward.

---

## Six-channel mutation uniformity — per-channel verdict

For BOTH `createProject` and `updateProject`:

1. **Channel 1 — UI text.** PASS. `GENERIC_FORM_ERROR = 'Could not save. Try again.'` is the single form-level error string (`lib/admin-mutations-types.ts:47`) and is surfaced for every non-zod throw via the catch in `lib/admin-mutations.ts:114-118` and `:151-155`. Zod field errors are the only carve-out (Channel 1 exception per `docs/auth-flow.md` §2a point 1) and are filtered through `zodErrorToFieldErrors` to only the form's three declared fields (`title`, `description`, `status`) — no leak of unexpected zod path information.

2. **Channel 2 — Response body.** PASS. The wire envelope `{ status, fieldErrors?, formError? }` is uniform. `try/catch` in `lib/admin-mutations.ts:111-122` and `:146-159` swallows every throw — ZodError → field-error envelope; any other throw → generic form-error envelope. Never rethrows to the wire. `tests/admin-mutations.uniformity.test.ts` exercises ok / zod / generic-throw / trigger-raise paths for both actions and asserts the wire shape.

3. **Channel 3 — Response timing.** PASS. `MIN_DURATION_MS = 750` sourced from `lib/auth-constants.ts:20` (NOT duplicated). `padToFloor` runs inside `finally` for both wrappers, padding success AND throw paths. `tests/admin-mutations.timing.test.ts` covers `createProject` success path, `createProject` throw path, and `updateProject` throw path with fake timers; all three assert the resolution does not settle before `MIN_DURATION_MS - 1`.

4. **Channel 4 — Server Action surface.** PASS. `.next/server/server-reference-manifest.json` inspected post-build: exactly 4 action IDs, matching the SEC-09 allowlist:
   - `406f1b2acd...` → `signInWithMagicLink` (`lib/auth.ts`)
   - `0034145551...` → `signOut` (`lib/auth.ts`)
   - `603dfa713b...` → `createProject` (`lib/admin-mutations.ts`)
   - `60a54cafff...` → `updateProject` (`lib/admin-mutations.ts`)
   `lib/admin-mutations.ts` exports ONLY two async functions — no helpers, no types, no consts. `lib/admin-mutations-internal.ts` has NO `'use server'` directive (verified — module note at lines 11-26 explicitly documents this). `tests/server-actions-manifest.test.ts` passes with allowlist size 4.

5. **Channel 5 — Response headers.** PASS. Neither wrapper writes any cookie. The Supabase client used (`lib/supabase.ts::createServerClient`) is constructed with `auth: { flowType: 'implicit' }` per CONSTRAINT-18 — no `*-code-verifier` Set-Cookie is emitted on any path. The mutation flow does not invoke `signInWithOtp` or `verifyOtp`, so the auth-cookie write path is not reachable from this surface at all.

6. **Channel 6 — Status code.** PASS. No `throw` reaches the wire (Channel 2 catch is total). No explicit non-200 response is constructed. Next.js frames the Server Action response at 200 across all outcomes.

---

## Standard SEC rule verdicts

- **SEC-01 (server-only secrets).** CLEAR. Grep of `lib/admin-mutations*.ts` returns zero references to `SUPABASE_SERVICE_ROLE_KEY`. The only project-wide reference is in `lib/env.ts` (env-presence assertion list). Mutations run via the request-scoped server client and hit RLS as the authenticated admin — no superuser privilege escalation.
- **SEC-02 (input validation).** CLEAR. `projectCreateSchema` and `projectUpdateSchema` in `lib/admin-mutations-internal.ts:56-75` validate title (trim, 1-200 chars), description (trim, ≥1 char), status (enum `['draft','published']`). Parse happens BEFORE any DB call in both helpers. `slugify(parsed.title)` runs on the validated title, not raw input — defense against slug injection via mismatched title parse.
- **SEC-03 (parameterized queries).** CLEAR. All DB access via Supabase query builder (`from().insert()`, `from().select().eq()`, `from().update().eq()`). No raw SQL strings present in commit.
- **SEC-04 (enumeration resistance).** CLEAR. Six-channel contract above is the verdict.
- **SEC-05 (no PII in logs).** CLEAR. `logMutationError` (`lib/admin-mutations-internal.ts:85-95`) and `logDbError` (`lib/admin-queries.ts:61-68`) log only `operation`, `errorCode`, `errorMessage`, `stack`. No row data, no user-supplied title/description, no email. (See F-25 below — `errorMessage` from Postgres trigger-raise CAN include the slug verbatim per migration 006 raise text. Low / informational only.)
- **SEC-06 (authentication enforcement).** CLEAR. Wrappers do not re-check auth — middleware (T17) gates the page surface and RLS (`projects_admin_all`) gates the DB surface. Wrappers use `createServerClient()` (cookie-bound, anon-key, session-aware) — NOT the anon client and NOT a service-role client. RLS sees the authenticated admin and allows the CRUD.
- **SEC-07 (sensitive file exposure).** CLEAR. `git ls-files | grep -E "^\.env"` returns only `.env.example`. `.gitignore` rule `.env*` with `!.env.example` exception correctly excludes `.env`, `.env.local`, etc. `git check-ignore -v .env.local` confirms `.gitignore:6:.env*` matches. `git log --name-only` across recent commits shows zero SEC-07 files committed. Framework files (`CLAUDE.md`, `manifest.md`, `profile.md`, `docs/session-*.md`, `docs/framework-issues.md`) gitignored per existing convention.
- **SEC-08 (`'use server'` module discipline).** CLEAR. Project-wide grep for `'use server'`: appears only at file top of `lib/auth.ts:1` and `lib/admin-mutations.ts:1`. `lib/admin-mutations-internal.ts` and `lib/admin-mutations-types.ts` correctly lack the directive. Manifest count of 4 action IDs is the live invariant.
- **SEC-09 (middleware uniformity).** N/A — T21 made no middleware changes. The middleware admin-gate uniformity (F-5 / F-16 / F-17 / F-18 mitigations) remains intact and out of scope for this audit.

---

## Additional check verdicts

- **Slug-lock defense in depth.** CLEAR. App-side: `updateProjectInternal` pre-fetches `existing.status` (lines 187-198) and omits `slug` from the update payload when `isPublished === true` (lines 201-215). The `slug` key is ABSENT from the payload object, not merely `undefined` — `tests/admin-mutations.test.ts:213` asserts via `hasOwnProperty`. DB-side: migration `006_slug_lock_triggers.sql` defines `prevent_slug_change_after_publish()` PL/pgSQL function plus `projects_prevent_slug_change` BEFORE UPDATE OF slug trigger — raises an exception if `old.status='published' AND old.slug IS DISTINCT FROM new.slug`. Both layers present.
- **Mass assignment.** CLEAR. The zod schemas declare only `title`, `description`, `status`. `readFormData` in `lib/admin-mutations.ts:72-78` reads ONLY those three keys from `FormData` — `id`, `created_at`, `updated_at`, `slug`, `image_id` are unreachable through the form payload. The `id` for `updateProject` is read separately from a hidden `id` field — used as the WHERE filter, never as a SET column. Note: zod schemas don't carry `.strict()`, but `readFormData`'s narrow-key construction is functionally equivalent — only the three keys ever flow into `parsed`. (See F-26 below for a Low finding on belt-and-braces tightening.)
- **CSRF.** CLEAR. No `Access-Control-Allow-Origin` config in the repo. Next.js Server Action CSRF protection (signed action IDs + same-origin) applies via framework default.
- **Race condition: slug uniqueness.** Single-user system; race surface is theoretical. UNIQUE constraint on `projects.slug` (`migrations/001_create_schema.sql:89`) is the DB-side guarantee — a true collision surfaces as Postgres 23505 and is wrapped in `ServiceError`, then converted to the uniform error envelope. Not a finding.
- **404 vs 403 on edit page.** CLEAR. RLS `projects_admin_all` allows the admin to SELECT every row regardless of status, so the RLS-hides-the-row branch is unreachable in the single-admin model. `notFound()` fires only for genuine PGRST116 / non-existent IDs. Single-admin context makes a 403-vs-404 leak academically uninteresting and operationally absent.
- **Form sanitization on render.** CLEAR. `ProjectForm` renders user-supplied `title`, `description`, `slug` via JSX text children (`{project.title}`, `defaultValue={project?.title}`, `value={project.slug}`). React's default escaping is sufficient — no `dangerouslySetInnerHTML` anywhere in admin code. (The only `dangerouslySetInnerHTML` site in the repo is `components/public/MarkdownContent.tsx`, gated by the marked + DOMPurify pipeline per CONSTRAINT-06; out of scope for T21.)
- **CONSTRAINT-13 voice.** CLEAR. User-facing strings audited:
  - `'Could not save. Try again.'` — dry, terse, no SaaS phrasing.
  - `'Saved.'` — single word, no emoji, no superlative.
  - `'Slug locked after publish. Edit the title only affects drafts.'` — terse, factual. (Minor grammatical note: "Edit the title" should arguably be "Editing the title" — but this is voice-clean and not a security concern.)
  - `'title is required'`, `'description is required'` — lowercase, zod-default style; passes voice.
  - Form labels (`Title`, `Description`, `Status`, `Slug`, `New project`, `Edit project`, `Save`, `Saving`) — all dry single-word/short-phrase labels.
- **CONSTRAINT-19.** N/A — no new dev-only API routes in T21.

---

## Findings

### Critical

None.

### High

None.

### Medium

(F-3 and F-4 from audit 5 remain at Medium severity, carry-forward, neither addressed nor regressed by T21.)

---

**F-3 (Medium, carry-forward, unchanged):** Zod email schema in `lib/auth-internal.ts:20` has no length cap. Recommended `z.string().min(3).max(254).email()`. Not addressed by T21; not regressed by T21.

---

**F-4 (Medium, carry-forward, unchanged):** Callback handler accepts overly wide OTP type set in `app/(admin)/admin/auth/callback/route.ts`. Recommended narrow to `new Set(['email', 'magiclink'])`. Not addressed by T21; not regressed.

---

### Low

---

**F-25 (NEW): Postgres trigger-raise message embeds the slug verbatim in `errorMessage` log**

- **Severity:** Low
- **Rule violated:** SEC-05 (no PII in logs) — informational; slug is not PII but is user-content-derived.
- **Where:** `lib/admin-mutations-internal.ts:91` logs `errorMessage: error?.message ?? null`. When the slug-lock trigger raises (`supabase/migrations/006_slug_lock_triggers.sql:39-41`), the raise text includes the old + new slug values verbatim: `'Cannot change slug on published % (old=%, new=%)...'`. Those slug strings are derived from the admin-supplied title, so they end up in stderr structured logs.
- **Threat:** The slug is already in the URL of a published row (public), so logging it is not a confidentiality breach. The finding is recorded for completeness — it's the only path where user-supplied content (via the title → slug derivation) reaches the log message field. In multi-user systems this would matter; in the single-admin model the admin is the only producer.
- **Mitigation status:** accepted no-fix. Slug values are public-domain (they appear in published URLs). Log retention is local stderr only — no log aggregation in scope.
- **Recommended fix:** None required. Optional: scrub `errorMessage` of slug substrings before logging if log aggregation is added in Phase 4. Trivial when needed.
- **Effort:** trivial (or skip).

---

**F-26 (NEW): Zod schemas do not declare `.strict()` — defense-in-depth gap on mass-assignment**

- **Severity:** Low
- **Rule violated:** SEC-02 (input validation at boundary) — defense-in-depth.
- **Where:** `lib/admin-mutations-internal.ts:56-75`. `projectCreateSchema` and `projectUpdateSchema` are `z.object({...})` without `.strict()`. By zod default, unknown keys are silently stripped from the parsed output, so the practical behavior is correct. The gap is that `readFormData` is the only thing keeping unknown fields out — if a future contributor changes `readFormData` to forward the whole `FormData` (e.g., `Object.fromEntries(formData)`), zod's default-strip behavior would silently drop the extras rather than failing loudly. `.strict()` would make a future regression surface as a ZodError rather than a silent strip.
- **Threat:** Today: none. The two-layer defense (`readFormData` narrow read + zod default-strip) closes the surface. The finding is about regression visibility, not current behavior.
- **Mitigation status:** functionally mitigated. Defense-in-depth fix is one line per schema.
- **Recommended fix:** Add `.strict()` to both schemas:
  ```ts
  export const projectCreateSchema = z.object({...}).strict();
  export const projectUpdateSchema = z.object({...}).strict();
  ```
  This converts a silent default-strip into a loud `ZodError` if any unknown key ever reaches the parser. The mutation wrapper's existing catch path converts the ZodError into the uniform error envelope, so wire shape is unaffected.
- **Effort:** trivial.

---

**F-23 (Low, carry-forward from audit 7, unchanged):** Length pre-check in `assertFixtureSecret` is a length oracle (irrelevant to threat model). Production gate-1 ordering absorbs the surface. No-fix accepted per audit 7.

---

**F-24 (Low, carry-forward from audit 7, unchanged):** F-19 cookie-jar regex misses chunked variants and a non-existent refresh-token cookie. False-negative ceiling on the assertion; current production reality (implicit-flow tokens ≤3180 bytes) fits the current regex. No-fix accepted per audit 7.

---

**F-20 (Low, carry-forward from audit 7, unchanged):** Stale JSDoc wording in `lib/auth.ts:20` references T19.1 as "to be enforced by" rather than "enforced by". T19.1 has shipped; the wording lags. Doc-polish only.

---

**F-6 through F-11 (Low, carry-forward, unchanged from audit 5):**

- **F-6:** No CSP — defer to Phase 4 launch prep.
- **F-7:** `@types/dompurify@3.0.5` stale.
- **F-8:** Caret pins on `marked` and `dompurify` — mitigated by `package-lock.json`.
- **F-9:** XSS regression test gap on the public Markdown sanitizer.
- **F-10:** Cookie hardening implicit (relies on `@supabase/ssr` defaults).
- **F-11:** No app-level rate limit on `signInWithMagicLink`.

See audit 5 for full text. None affected by T21.

---

**F-21, F-22 (Low, carry-forward, unchanged):** `next.config.ts` CSRF-posture comment + Server Action IDs documented as non-secret. Both still recommended doc-polish; T21 has no effect on them.

---

## Build invariant — T21

Post-`npm run build` (2026-05-13, audit 8 re-verify):

- `.next/server/server-reference-manifest.json` lists exactly FOUR action IDs:
  - `406f1b2acd793c144567457943dc9cafa48d09501a` → `signInWithMagicLink` (`lib/auth.ts`)
  - `0034145551c16de429added00b69a97d379a3c909b` → `signOut` (`lib/auth.ts`)
  - `603dfa713b7470102e8166225f877d61a24d8e6020` → `createProject` (`lib/admin-mutations.ts`)
  - `60a54cafff864199a8998514e6dbc2c549708270a2` → `updateProject` (`lib/admin-mutations.ts`)
  Edge map empty. (Action IDs are hashed function references — the previous two IDs are unchanged from audit 7; the two new IDs are bound to the new `lib/admin-mutations.ts` exports.)
- `/admin/projects/new` appears as a static (○) route at 134 B; `/admin/projects/[id]` appears as a dynamic (ƒ) route at 134 B — confirms minimal client-bundle footprint for the page shells (the form weight is shared via the `admin/projects` chunk).
- `npx vitest run tests/server-actions-manifest.test.ts` → 1 test passed; manifest export set `{signInWithMagicLink, signOut, createProject, updateProject}` matches the SEC-09 allowlist exactly.
- `npm test` → 125 tests across 22 files, all passing.

---

## SEC-07 sensitive-file exposure check

- `.env.local` exists locally and is matched by `.gitignore` rule `.env*` (with `!.env.example` exception). `git check-ignore -v .env.local` confirms `.gitignore:6:.env*` matches.
- `git ls-files | grep -E "^\.env"` returns only `.env.example` — no real env file ever committed.
- `git log --name-only -20` shows zero SEC-07 files in recent commits.
- Framework files (`CLAUDE.md`, `manifest.md`, `profile.md`, `docs/session-log.md`, `docs/session-handoff.md`, `docs/framework-issues.md`, `content/`) gitignored per existing project convention; not staged.
- `TEST_FIXTURE_SECRET` and `TEST_FIXTURE_EMAIL` remain placeholders in `.env.example` from T19.2; no real values committed.

**SEC-07 verdict:** PASS.

---

## Summary Table

| Severity | Count | F-codes |
|---|---|---|
| Critical | 0 | — |
| High | 0 | — |
| Medium | 2 | F-3, F-4 |
| Low | 13 | F-6, F-7, F-8, F-9, F-10, F-11, F-20, F-21, F-22, F-23, F-24, F-25, F-26 |

**Verdict:** CLEAR — no Critical or High findings. T21 ships. The six-channel uniformity contract is correctly extended from the auth surface to the mutation surface. The three-module file split codified in `docs/architecture.md` §6.6.6 is the binding pattern for T22/T23/T24/T25 and is implemented correctly here. Two new Low findings (F-25, F-26) recorded for defense-in-depth tightening; neither blocks ship.

**Path forward:** T21 is CLEAR. Proceed to T22.
