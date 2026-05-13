# Security Report: swarnimbagre.com

**Last audit:** 2026-05-13 (audit 9)
**Scope:** T22 — projects admin delete with confirm modal (commit `971991e`)
**Status:** CLEAR
**Summary:** 0 Critical / 0 High / 2 Medium / 14 Low
**Unresolved Critical/High findings:** None

---

## Verdict

T22 ships. The third mutation Server Action — `deleteProject` — closes all six channels of the SEC-09 uniformity contract identically to `createProject` / `updateProject` from T21. The three-module split (`lib/admin-mutations.ts` `'use server'` wrapper / `lib/admin-mutations-internal.ts` throwing helper / `lib/admin-mutations-types.ts` pure types) is preserved exactly: `deleteProject` lives in the wrapper, `deleteProjectInternal` in the internal helper, and `ProjectMutationState` is reused with no new type added.

Build is green. `npm test` → 138/138 passing across 23 test files (matches expected count). Manifest contains exactly five action IDs: `signInWithMagicLink`, `signOut`, `createProject`, `updateProject`, `deleteProject`. The new ID (`40ee7ffd4b...` → `deleteProject` in `lib/admin-mutations.ts`) is the only delta from audit 8.

`deleteProjectInternal` validates `id` is a non-empty/non-whitespace string before any DB call (SEC-02), uses the Supabase query builder for `.delete().eq('id', id)` (SEC-03), uses the request-scoped session-bound server client (SEC-06 / RLS), and never references `SUPABASE_SERVICE_ROLE_KEY` (SEC-01). The DeleteConfirmModal is a generic component reused across future delete surfaces (T23 / T24 / T27); the title interpolates the row title via standard JSX text children (React-escaped — no XSS surface).

One new Low finding recorded (F-27: post-resolution side effects in `DeleteProjectButton` fire unconditionally after modal close — soft UX glitch, not a security issue, single-admin model). F-25, F-26 from audit 8 carry forward unchanged. F-23, F-24, F-20 from audit 7 carry forward unchanged. F-26's scope is confirmed bounded to T21 — `deleteProjectInternal` has no zod schema (uses typeof + trim guards directly), so the `.strict()` concern does not extend.

---

## Six-channel mutation uniformity — per-channel verdict (`deleteProject`)

1. **Channel 1 — UI text.** PASS. `GENERIC_FORM_ERROR = 'Could not save. Try again.'` (`lib/admin-mutations-types.ts:47`) is the only error string surfaced. `lib/admin-mutations.ts:196-198` returns it for every catch path; no rethrow, no internal error message leak. `DeleteProjectButton.tsx:87` calls `toast.error(result.formError ?? GENERIC_FORM_ERROR)` — the fallback nullish-coalesce is belt-and-braces (the wrapper always sets `formError`, but if it somehow didn't, the constant is the fallback, not an undefined toast).

2. **Channel 2 — Response body.** PASS. Envelope is `{ status: 'ok' }` on success or `{ status: 'error', formError: GENERIC_FORM_ERROR }` on every throw. No `fieldErrors` branch (no zod schema; `id` is a direct argument). `tests/admin-mutations.uniformity.test.ts:134-155` covers both paths; the throw-path assertion verifies `formError` does not contain `'permission'` (no internal-error-text leak).

3. **Channel 3 — Response timing.** PASS. `padToFloor(start)` runs inside `finally` (`lib/admin-mutations.ts:199`). `MIN_DURATION_MS` imported from `lib/auth-constants.ts:20` — NOT duplicated (verified by grep: only `lib/admin-mutations.ts:13` import references it across the mutation modules). `tests/admin-mutations.timing.test.ts:126-166` covers both success and throw paths; both assert non-settlement before `MIN_DURATION_MS - 1` and settlement at `MIN_DURATION_MS`.

4. **Channel 4 — Server Action surface.** PASS. Post-build manifest inspected directly:
   - `406f1b2acd...` → `signInWithMagicLink` (`lib/auth.ts`)
   - `0034145551...` → `signOut` (`lib/auth.ts`)
   - `603dfa713b...` → `createProject` (`lib/admin-mutations.ts`)
   - `60a54cafff...` → `updateProject` (`lib/admin-mutations.ts`)
   - `40ee7ffd4b...` → `deleteProject` (`lib/admin-mutations.ts`)
   Exactly five entries; edge map empty. `lib/admin-mutations.ts` exports ONLY three async functions (verified — no helpers, consts, or types). `lib/admin-mutations-internal.ts` and `lib/admin-mutations-types.ts` do not carry `'use server'`. The new `components/admin/DeleteConfirmModal.tsx` and `components/admin/DeleteProjectButton.tsx` are `'use client'` only (verified). `tests/server-actions-manifest.test.ts:19-25` allowlist updated to include `deleteProject`; the test passes against the live manifest.

5. **Channel 5 — Response headers.** PASS. `deleteProject` writes no cookies. Supabase client remains `flowType: 'implicit'` per CONSTRAINT-18 (`lib/supabase.ts:41`) — no `*-code-verifier` Set-Cookie is reachable from the mutation surface.

6. **Channel 6 — Status code.** PASS. No throw reaches the wire (Channel 2 catch is total). Next.js frames the Server Action response at 200 across all outcomes.

---

## Standard SEC rule verdicts

- **SEC-01 (server-only secrets).** CLEAR. Grep of `lib/admin-mutations*.ts` and `components/admin/Delete*.tsx` returns zero references to `SUPABASE_SERVICE_ROLE_KEY`. Only project-wide reference is `lib/env.ts:4` (env-presence list). No hardcoded URLs / tokens / API keys in any new file.
- **SEC-02 (input validation).** CLEAR. `deleteProjectInternal` validates `typeof id === 'string' && id.trim().length > 0` BEFORE `createServerClient()` and BEFORE `.from().delete().eq()` (`lib/admin-mutations-internal.ts:263-268`). Both empty-string and whitespace-only id cases are tested (`tests/admin-mutations.test.ts:343-353`).
- **SEC-03 (parameterized queries).** CLEAR. Single DB call: `supabase.from('projects').delete().eq('id', id)` (`lib/admin-mutations-internal.ts:270`). Pure query-builder; no string concat involving `id`. Grep for `\`.*\${id}` and `id.*\+.*['"]` across the mutation files returns no matches.
- **SEC-04 (enumeration resistance).** CLEAR. Six-channel verdict above is the answer.
- **SEC-05 (no PII in logs).** CLEAR. `logMutationError` (`lib/admin-mutations-internal.ts:87-97`) for the delete path logs only `operation: 'deleteProject'`, `errorCode`, `errorMessage`, `stack`. No `id` field is logged (delete has no slug/title to leak — `id` is a UUID, not user content, and is intentionally not included in the structured log payload). F-25's slug-in-trigger-message concern does not extend to delete (no trigger raises on delete in the current schema).
- **SEC-06 (authentication enforcement).** CLEAR. `deleteProjectInternal` uses `createServerClient()` (session-bound, anon-key, cookie-aware) — not the anon client, not service-role. RLS `projects_admin_all` policy (`supabase/migrations/002_rls_projects.sql:41-47`) grants `authenticated` role full CRUD; unauthenticated callers are denied at the DB. The Server Action's middleware gate (T18) is layer one; RLS is layer two; both must fail for an attacker to delete a row.
- **SEC-07 (sensitive file exposure).** CLEAR. `git ls-files | grep -E "^\.env"` returns only `.env.example`. Working tree clean for committed code (the open M / ?? entries are unrelated framework/non-tracked files). `git log --name-only -20` covering T22 + audit-8 commit shows zero SEC-07 files. Framework files (`CLAUDE.md`, `manifest.md`, `docs/session-*.md`) remain gitignored.
- **SEC-08 (`'use server'` module discipline).** CLEAR. Project-wide grep for the directive: `lib/auth.ts:1` and `lib/admin-mutations.ts:1` only. `lib/admin-mutations-internal.ts`, `lib/admin-mutations-types.ts`, `components/admin/DeleteConfirmModal.tsx`, `components/admin/DeleteProjectButton.tsx` all correctly lack the directive (the latter two carry `'use client'` instead). Manifest count of 5 is the live invariant.
- **SEC-09 (middleware uniformity).** N/A — T22 made no middleware changes.

---

## DELETE-specific risk verdicts

- **IDOR / horizontal escalation.** N/A. Single-user system per CONSTRAINT-09; RLS `authenticated`-role check is the gate either way. An attacker who bypassed the middleware gate and called `deleteProject(any-uuid)` directly would still be unauthenticated at the DB layer (no session cookie → `anon` role → policy denies).
- **CONSTRAINT-10 hard-delete.** CLEAR. `.delete()` is a real Postgres DELETE via the PostgREST builder. Grep for `deleted_at | softDelete | soft_delete` across `lib/` returns no matches — no soft-delete column introduced. Row is gone after success.
- **Double-click idempotency.** CLEAR. PostgREST DELETE of zero rows returns `data: null, error: null` (success at the SQL level). The second of two in-flight deletes resolves to `{ status: 'ok' }` — semantically correct (the row IS gone). The `tests/admin-mutations.test.ts:321-331` test verifies `error: null` resolves successfully.
- **Race: edit-in-tab-A, delete-in-tab-B.** Theoretical, single-admin model. PostgREST `.update().eq('id', missing)` returns `data: []` (success, zero rows). `updateProjectInternal` calls `.single()` after `.update().eq().select()`, which converts zero-rows to a PGRST116 error and is wrapped in `ServiceError` and surfaced as the uniform form-error envelope — NOT a silent success. (Verified: `lib/admin-mutations-internal.ts:219-231` follows the .update().eq().select().single() chain — same as create/update path; missing-row resolves loudly.) No finding.
- **XSS via project name in modal title.** CLEAR. `DeleteConfirmModal.tsx:111-113` renders `Delete {resource} "{name}"?` via JSX text children. React's default escaping handles every character. Grep for `dangerouslySetInnerHTML` across `components/admin/` returns no matches.
- **CSRF.** CLEAR. Next 15 Server Actions are CSRF-protected by signed action IDs + same-origin (framework default). The new `deleteProject` action ID is hashed and ships in the client bundle bound to the same-origin check.

---

## DeleteConfirmModal — CONSTRAINT-13 voice verdict

CLEAR. User-facing strings audited:
- `'Delete {resource} "{name}"?'` — terse interrogative, no SaaS, no emoji.
- `'This cannot be undone.'` — five words, factual, matches CONSTRAINT-10 hard-delete reality.
- `'Delete'`, `'Cancel'`, `'Deleting'` — single-word labels, no spinner emoji, no `'loading…'` placeholder.
- `'Deleted.'` (`DeleteProjectButton.tsx:12`) — single word, period, no decoration.

No emoji, no superlative, no LinkedIn-motivational-post energy. Passes.

---

## Findings

### Critical

None.

### High

None.

### Medium

(F-3 and F-4 from audit 5 remain at Medium severity, carry-forward, neither addressed nor regressed by T22.)

---

**F-3 (Medium, carry-forward, unchanged):** Zod email schema in `lib/auth-internal.ts:20` has no length cap. Recommended `z.string().min(3).max(254).email()`. Not addressed by T22; not regressed.

---

**F-4 (Medium, carry-forward, unchanged):** Callback handler accepts overly wide OTP type set in `app/(admin)/admin/auth/callback/route.ts`. Recommended narrow to `new Set(['email', 'magiclink'])`. Not addressed by T22; not regressed.

---

### Low

---

**F-27 (NEW): Post-resolution side effects in `DeleteProjectButton` fire unconditionally after modal close**

- **Severity:** Low
- **Rule violated:** None directly — soft UX/race concern, not a security boundary.
- **Where:** `components/admin/DeleteProjectButton.tsx:74-88`. `handleConfirm` awaits `deleteAction(id)` and then unconditionally calls `toast.success(...)`, `setIsOpen(false)`, and either `router.push(...)` or `router.refresh()`. If the user presses ESC mid-flight (closing the modal via Radix's default key-handling — confirmed by `tests/DeleteConfirmModal.test.tsx:132-156`), the action remains in flight server-side and its post-resolution effects fire regardless of where the user has navigated. A `router.push('/admin/projects')` can therefore yank the user away from a different admin page they navigated to in the interim.
- **Threat:** Functionally negligible. The admin is a single user (CONSTRAINT-09); the surface is internal. The worst case is a confusing redirect, not a privilege escalation or data leak. The action itself completes correctly server-side (hard-delete is idempotent).
- **Mitigation status:** functionally accepted. The modal's pending state DOES clear in `finally` per `DeleteConfirmModal.tsx:91-100`; this finding is specifically about the parent's post-resolution branching, not the modal contract.
- **Recommended fix:** Track an `isMounted` ref or a per-invocation `cancelled` flag in `DeleteProjectButton.handleConfirm`; gate `router.push/refresh` on `isOpen === true at start && isOpen === true at resolution`. Or — simpler — bind side effects to a `useEffect` that runs on a result state. Either is ~5 lines.
- **Effort:** trivial. Defer to a "polish T22" pass.

---

**F-25 (Low, carry-forward from audit 8, unchanged):** Postgres trigger-raise message embeds the slug verbatim in `errorMessage` log. The delete path does NOT extend this concern (no trigger raises on delete; `deleteProjectInternal`'s log payload contains no row-derived data). Concern remains scoped to `updateProjectInternal`'s pre-fetch + update chain. No-fix accepted.

---

**F-26 (Low, carry-forward from audit 8, unchanged):** Zod schemas lack `.strict()`. **Scope confirmed bounded to T21.** `deleteProjectInternal` has no zod schema (uses `typeof id === 'string' && id.trim().length > 0` directly), so there is no `.strict()` gap to extend. The finding remains specifically about `projectCreateSchema` and `projectUpdateSchema`. Defense-in-depth fix unchanged.

---

**F-23 (Low, carry-forward from audit 7, unchanged):** Length pre-check in `assertFixtureSecret` is a length oracle (irrelevant to threat model). Production gate-1 ordering absorbs the surface. No-fix accepted.

---

**F-24 (Low, carry-forward from audit 7, unchanged):** F-19 cookie-jar regex misses chunked variants and a non-existent refresh-token cookie. False-negative ceiling on the assertion. No-fix accepted.

---

**F-20 (Low, carry-forward from audit 7, unchanged):** Stale JSDoc wording in `lib/auth.ts:20`. Doc-polish only.

---

**F-6 through F-11 (Low, carry-forward, unchanged from audit 5):**

- **F-6:** No CSP — defer to Phase 4 launch prep.
- **F-7:** `@types/dompurify@3.0.5` stale.
- **F-8:** Caret pins on `marked` and `dompurify` — mitigated by `package-lock.json`.
- **F-9:** XSS regression test gap on the public Markdown sanitizer.
- **F-10:** Cookie hardening implicit (relies on `@supabase/ssr` defaults).
- **F-11:** No app-level rate limit on `signInWithMagicLink`.

See audit 5 for full text. None affected by T22.

---

**F-21, F-22 (Low, carry-forward, unchanged):** `next.config.ts` CSRF-posture comment + Server Action IDs documented as non-secret. Both still recommended doc-polish; T22 has no effect on them.

---

## Build invariant — T22

Post-`npm run build` (2026-05-13, audit 9):

- `.next/server/server-reference-manifest.json` lists exactly FIVE action IDs in the `node` map; `edge` map empty:
  - `406f1b2acd793c144567457943dc9cafa48d09501a` → `signInWithMagicLink` (`lib/auth.ts`)
  - `0034145551c16de429added00b69a97d379a3c909b` → `signOut` (`lib/auth.ts`)
  - `603dfa713b7470102e8166225f877d61a24d8e6020` → `createProject` (`lib/admin-mutations.ts`)
  - `60a54cafff864199a8998514e6dbc2c549708270a2` → `updateProject` (`lib/admin-mutations.ts`)
  - `40ee7ffd4b8cb738064a8ef6adbec6cbc42e02a7f5` → `deleteProject` (`lib/admin-mutations.ts`)  ← NEW (T22)
  The four prior IDs are unchanged from audit 8 — `deleteProject` is purely additive.
- `/admin/projects` route 4.51 kB; `/admin/projects/[id]` route 1.61 kB. Both are dynamic (ƒ). The shadcn Dialog primitive is shared via the admin chunk.
- `npx vitest run tests/server-actions-manifest.test.ts` → 1 test passed; allowlist `{signInWithMagicLink, signOut, createProject, updateProject, deleteProject}` matches the manifest exactly.
- `npm test` → 138 tests across 23 files, all passing.

---

## SEC-07 sensitive-file exposure check

- `.env.local` exists locally and is matched by `.gitignore` rule `.env*` (with `!.env.example` exception).
- `git ls-files | grep -E "^\.env"` returns only `.env.example` — no real env file ever committed.
- `git log --name-only -20` shows zero SEC-07 files in recent commits (T22 commit `971991e` and audit 8 commit `58e4a92` both verified).
- Working tree `git status --short` shows only one tracked-file modification (`docs/plan-phase-2-admin.md`) and four untracked items (the audit-7/T20 leftovers from before the framework convention applied — none are SEC-07).
- Framework files (`CLAUDE.md`, `manifest.md`, `profile.md`, `docs/session-*.md`, `content/`) gitignored per existing project convention.

**SEC-07 verdict:** PASS.

---

## Summary Table

| Severity | Count | F-codes |
|---|---|---|
| Critical | 0 | — |
| High | 0 | — |
| Medium | 2 | F-3, F-4 |
| Low | 14 | F-6, F-7, F-8, F-9, F-10, F-11, F-20, F-21, F-22, F-23, F-24, F-25, F-26, F-27 |

**Verdict:** CLEAR — no Critical or High findings. T22 ships. The six-channel uniformity contract extends to the third mutation Server Action with no regression and no new structural exposure. One new Low (F-27, post-resolution side-effect race in `DeleteProjectButton`) flagged as polish-grade defense-in-depth for future hardening; not blocking.

**Path forward:** T22 is CLEAR. Proceed to T23.
