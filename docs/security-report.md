# Security Report: swarnimbagre.com

**Last audit:** 2026-05-20 (audit 19 — T43.E Server Action `saveProjectMedia` + zod schemas + atomic DB-side RPC; CLEAR)
**Scope:** T43.E delta — `supabase/migrations/010a_save_project_media_rpc.sql` (created), `lib/admin-project-media-mutations-types.ts` (created), `lib/admin-project-media-mutations-schemas.ts` (created), `lib/admin-project-media-mutations-internal.ts` (created), `lib/admin-project-media-mutations.ts` (created — `'use server'` wrapper, exports `saveProjectMedia`), `tests/admin-project-media-mutations-schemas.test.ts` (created), `tests/admin-project-media-mutations.test.ts` (created), `tests/server-actions-manifest.test.ts` (modified — comment-only annotation; allowlist unchanged at 12). Migration 010a applied to production DB; advisor delta is zero NEW lints. Out of scope: T43.F admin form (`ProjectMediaField`), T43.G+ public render surface — re-audit when those land.
**Status:** CLEAR
**Summary:** 0 Critical / 0 High / 2 Medium / ~19 Low (carry-forward F-3, F-4 Mediums unchanged; F-37 Low unchanged; no new findings opened in audit 19)
**Unresolved Critical/High findings:** None

---

## Verdict

CLEAR. Zero Critical, zero High. T43.E ships. The new code is the cleanest mutation surface in the project — schema-strict at the zod boundary, atomic at the DB layer (RPC in one transaction), defense-in-depth via SECURITY INVOKER + RLS + EXECUTE-granted-only-to-authenticated + row-cap trigger. Six-channel uniformity contract is structurally identical to the projects analog (audit 17/18). No findings opened by this audit.

---

## Audit 19 (2026-05-20) — T43.E review

### Findings on the new code

**SEC-01 (no secrets) — PASS.**
Grepped all 7 audit-target files for `eyJ`, `sk_live`, `sk_test`, `SUPABASE_SERVICE`, `SERVICE_ROLE`, `password`, `secret`, `token`, `api_key`, `bearer`. The only matches are:
- `010a:112` — comment text "grant execute ... to anon, authenticated, service_role" describing the Supabase project-bootstrap default-privilege grant that the migration revokes.
- `010a:115` — comment text "service_role keeps EXECUTE (admin bypass role)" describing why the explicit revoke list excludes service_role.
Both are documentation of a role name (Supabase built-in), not a credential. Test files use the obviously-synthetic UUIDs `00000000-0000-4000-8000-0000000000aa`, `...bb`, `...99` — these are zero-padded, all-low-hex placeholders, not values that could ever appear in real `projects.id` / `images.id` rows produced by `crypto.randomUUID()`. No env-var fallback to a real default. No DSN-style string. No hardcoded URL with embedded auth.

**SEC-02 (input validation at boundaries) — PASS.**
Traced the validation path end to end:

1. `saveProjectMedia(prevState, formData)` (`admin-project-media-mutations.ts:154`) is the public Server Action entry.
2. `readSaveProjectMediaFormData(formData)` (line 108) reads `project_id` and `rows` from FormData; `rows` is `JSON.parse`d inside a `try/catch` that leaves `rows: undefined` on malformed input (intentional — the zod boundary then rejects uniformly). The reader returns `unknown`.
3. `saveProjectMediaInternal(raw)` (`admin-project-media-mutations-internal.ts:73`) calls `projectMediaSaveSchema.parse(raw)` *before* any Supabase call (line 77). A `ZodError` short-circuits the function — `supabase.rpc` is never reached on invalid input. Confirmed by `tests/admin-project-media-mutations.test.ts:83-108` (`calls.toHaveLength(0)` on bad project_id and bad row image_id).
4. `projectMediaSaveSchema` (`-schemas.ts:77`) is `.strict()` → extra top-level keys rejected (mass-assignment closed). `project_id: z.string().uuid()` → UUID validated. `rows: z.array(projectMediaRowSchema).max(20)` → row-cap enforced.
5. `projectMediaRowSchema` (`-schemas.ts:42`) is `.strict()` → extra per-row keys rejected. `image_id: z.string().uuid()`, `image_after_id: z.string().uuid().nullable()`, `caption: z.string().max(280).nullable()`. `.refine` enforces `image_after_id !== image_id` (mirrors the DB CHECK from migration 010).

Every UUID is validated. Caption is length-capped to 280 (mirrors DB CHECK). Strict-mode rejects unknown keys at both levels. No path reaches the RPC with unvalidated data.

**SEC-03 (parameterized queries) — PASS.**
The internal helper dispatches via `supabase.rpc('save_project_media', { p_project_id, p_rows })` (`-internal.ts:79-82`). Supabase JS's `.rpc()` sends the args as a JSON body to PostgREST, which then invokes the Postgres function with typed parameters — no string interpolation, no raw SQL. Inside the function body (`010a:67-95`), every reference is via parameter binding: `where project_id = p_project_id`, `(r.value->>'image_id')::uuid` (operates on `jsonb_array_elements(p_rows)`), etc. The function body itself is fully qualified (`public.project_media`) and uses no `EXECUTE format(...)` / `EXECUTE` dynamic SQL. Zero string concatenation anywhere in the dispatch chain.

**SEC-04 (authn + authz) — PASS.**
Authentication: the RPC is reachable only through Supabase JS via the authenticated server client constructed by `createServerClient()` (admin server-component / Server Action context, which requires the admin's Supabase auth cookie). Authorization: enforced at two DB layers.
- **EXECUTE grant.** `010a:116-118` revokes EXECUTE from `public` then from `anon`, then grants only to `authenticated`. Live state verified by the audit delegation: `EXECUTE: authenticated, postgres, service_role`. Anonymous PostgREST calls fail at the EXECUTE check before ever entering the function body.
- **RLS gate.** `security invoker` (`010a:65`) means the function runs as the calling role, so the admin policy `project_media_admin_all` (migration 010, `for all to authenticated using (true) with check (true)`) gates both the DELETE and the INSERT exactly as for direct table writes. The `using(true)/with check(true)` shape is the F-37 baseline finding (audit 18 — accepted permissive-admin pattern for the single-user-deployment invariant), not a new regression introduced here. Migration 010a does not weaken anything: it inherits whatever RLS is on the table.

The two-layer authz model is intact. Anon path is closed at EXECUTE. Authenticated path is gated by RLS at row-level.

**SEC-05 (no sensitive data in logs/responses) — PASS.**
- **Wire.** `saveProjectMedia` returns the same `ProjectMediaMutationState` envelope on every path. Success → `{ status: 'ok' }`. ZodError → `{ status: 'error', fieldErrors }` where field-error values are zod-generated messages tied to the schema constraint that failed (e.g., `"image_id must be a uuid"`) — these are schema-derived strings, not raw user input, and not internal state. Non-zod error → `{ status: 'error', formError: GENERIC_FORM_ERROR }` where `GENERIC_FORM_ERROR = "Could not save. Try again."` (`auth-constants.ts:44`) — resource-agnostic, reason-agnostic. No Supabase error code, no Postgres error message, no stack trace, no row data leaks to the wire.
- **Logs.** `-internal.ts:84` calls `logSupabaseError(SAVE_PROJECT_MEDIA_OPERATION, error)`, which (per `admin-mutation-log.ts:49-57`) logs `{ operation, errorCode: error?.code, errorMessage: error?.message, stack }` — bounded keys, no row data spread. The Supabase RPC error's `message` may contain Postgres detail (e.g., a trigger-raise text), but it goes to `console.error` only, not the wire. This matches the F-29 reducer pattern from audit 16b — logs carry diagnostic detail, the wire stays clean.

**SEC-06 (HTTPS / encryption at rest) — N/A for this delta.** No new transport surface, no new at-rest storage of sensitive data. Existing Vercel HTTPS + Supabase TLS apply.

**SEC-07 (sensitive file exposure) — PASS.**
`git status --short` shows only application code (4 new `lib/admin-project-media-mutations-*.ts`, 2 new `tests/admin-project-media-mutations*.test.ts`, 1 new `supabase/migrations/010a_*.sql`, 2 modified files `docs/plan-phase-4-launch.md` + `tests/server-actions-manifest.test.ts`). None of the new files appear in the SEC-07 sensitive list. None of the modified files is sensitive (plan-phase-4 is the in-repo plan, intentionally tracked; manifest test is a test).

**SEC-08 (Server Action surface minimization) — PASS.**
Grepped exports in the new `'use server'` module (`admin-project-media-mutations.ts`): exactly one `export` keyword on an `async function` — `export async function saveProjectMedia(...)` at line 154. Helper functions in the module (`isAllowedFieldRoot`, `buildFieldErrorKey`, `projectMediaZodErrorToFieldErrors`, `readSaveProjectMediaFormData`) and the `ALLOWED_FIELD_ROOTS` const are all `function` / `const` declarations without `export`. The throwing helper `saveProjectMediaInternal` lives in `-internal.ts` which is a plain module (no `'use server'` directive at top). Schemas live in `-schemas.ts` (also plain module). Types live in `-types.ts` (also plain module). The Server Action surface gains exactly one action ID — `saveProjectMedia` — and zero accidental co-located helpers leak to the manifest.

**SEC-09 (six-channel uniformity) — PASS.**
- **Channel 1 (UI text).** Non-validation failures surface the cross-resource `GENERIC_FORM_ERROR` constant only. Zod field errors carve out per the documented contract — they are deterministic from the schema, not from internal state, so they do not constitute an enumeration channel. Allowlisted roots are `{project_id, rows, image_id, image_after_id, caption}` (`-mutations.ts:40-46`); any zod issue with a root outside this set is dropped by `buildFieldErrorKey` returning `null` (line 67-72). The strict-mode rejection of an extra key like `evil_key` would produce an issue with path `['evil_key']`, which is not in the allowlist, and is therefore dropped — confirmed by reading the control flow (line 67: `if (!isAllowedFieldRoot(root)) return null;`). No shape leakage.
- **Channel 2 (response body).** The action returns `Promise<ProjectMediaMutationState>` on every path. `try` returns `{status:'ok'}`. `catch(ZodError)` returns the field-errors envelope. `catch (other)` returns the form-error envelope. No `throw` reaches the wire. Confirmed.
- **Channel 3 (timing).** `start = performance.now()` captured before `try` (line 158); `await padToFloor(start)` in `finally` (line 171); `padToFloor` enforces the `MIN_DURATION_MS = 750` floor on every outcome (`timing.ts` + `auth-constants.ts:20`). Confirmed.
- **Channel 4 (Server Action surface).** Exactly one export from the `'use server'` module (see SEC-08 above). The build-manifest invariant test allowlist remains at 12 IDs; the comment annotation correctly documents that `saveProjectMedia` lands at T43.F when the action becomes manifest-reachable. This is a planned deferred addition, not a security gap.
- **Channel 5 (Set-Cookie).** No `cookies()` call in `admin-project-media-mutations.ts`. No `Set-Cookie` mutation. The Supabase server client constructed inside `-internal.ts` does refresh cookies as a side effect on token rotation, but that is request-scoped behavior identical across outcomes (token rotates or it doesn't — same on success and on failure).
- **Channel 6 (status code).** No rethrow. The Server Action resolves with the envelope on every outcome; Next.js wraps the resolved value in a 200 response. No path produces a 4xx/5xx that would itself become an oracle.

**RLS pass-through correctness — PASS.**
- (a) Anonymous caller: the EXECUTE grant explicitly excludes `anon` (`010a:117`). Live grants verified `authenticated, postgres, service_role` — no anon. An anon PostgREST request to the function returns 401/403 at the EXECUTE check before the function body runs. Confirmed.
- (b) Authenticated non-admin: in this project's deployment model there is no non-admin authenticated user — Supabase signup is off and the magic-link path is gated by `assertAllowlistedEmail` + `rejectIfNotAllowlisted` (audit 16 T36 verification). If that invariant were ever broken (a second account created via Dashboard), the `using(true)` policy *would* allow that account to invoke the RPC. This is the F-37 baseline finding — accepted as the documented permissive-admin pattern. Migration 010a does not introduce a new weakness here; it inherits whatever the table's RLS shape is.

**EXECUTE grant correctness — PASS.**
The pattern `revoke from public; revoke from anon; grant to authenticated` is the project's standard "default-deny + explicit grant" model. Two revokes are required because Supabase's project-bootstrap default-privileges grant directly to `anon` (separate from the `public` pseudo-role); revoking from `public` alone does not close that. The migration documents this correctly in the comment at lines 109-115. Live state confirms `service_role` retains EXECUTE (intentional admin bypass — service_role bypasses RLS by design per CONSTRAINT-04). `postgres` retaining EXECUTE is the Supabase superuser role and is expected. Conformant.

**NULL/array-type guard in the RPC — PASS.**
`010a:74-78` raises an exception if `p_rows is null or jsonb_typeof(p_rows) <> 'array'`. Without this guard, `jsonb_array_elements(null)` returns zero rows silently, which combined with the unconditional `DELETE` above the `INSERT ... select` would silently wipe all media for the project — a buggy caller passing `null` would destroy data with no error signal. The guard turns that into a loud `raise exception`, which Supabase JS surfaces as a `{error}` payload, which the internal helper wraps into a `ServiceError` and the action wraps into `{status:'error', formError}`. Conforms to EH-01 spirit (loud failure at the source) and SEC-02 (defensive validation even on the trusted internal path).

**Migration idempotency — PASS.**
- `create or replace function` rewrites the function body on every run — no "first-run only" semantic.
- `revoke execute ... from public` / `from anon` — idempotent (revoking a grant that doesn't exist is a no-op in Postgres).
- `grant execute ... to authenticated` — idempotent (granting an existing grant is a no-op).
- `comment on function` — replaces the existing comment.
No state-dependent statements. Safe to re-run.

**Test files (no secrets, SEC-01) — PASS.**
Sample UUIDs are obviously synthetic (zero-padded, all-low-hex): `00000000-0000-4000-8000-0000000000aa` / `...bb` / `...99`. These match the v4 UUID shape (version `4`, variant `8`) syntactically but are vanishingly unlikely to collide with any real `crypto.randomUUID()`-generated row. No real Supabase URL, no real key, no real environment value anywhere in the test files. The RPC stub (`makeRpcStub`) is a hand-written mock — no real client construction.

**`readSaveProjectMediaFormData` silent JSON.parse catch — PASS (intentional + documented).**
`-mutations.ts:108-122` catches `JSON.parse` exceptions and leaves `rows: undefined`, which the zod schema then rejects with a uniform validation error. The inline comment (lines 116-119) documents the design choice: legitimate callers (the form) serialize from React state, so a parse failure indicates a hand-crafted request. The loud rejection happens at the zod boundary (uniform `fieldErrors` for `rows`), not silently — this is not an EH-01 violation. The pattern matches the existing `readPercentField` NaN pass-through from audit 17 (PASS there too).

**`fieldErrors` row-index disclosure — PASS (intentional, not a leak).**
Per-row error paths like `rows.3.image_id` surface the 0-based row index to the form. The form needs the index to highlight the failing row visually (T43.F UX). Assessed as Channel 1 leakage potential: the row index is information the *caller already controls* — they sent the row at position 3, so them learning that position 3 failed validation reveals nothing they did not already know. This is not symmetric with, e.g., an auth flow learning "this email is registered" (which the caller does not control). Conformant.

### Cross-cutting checks

**Mass assignment.** Both schemas `.strict()` → unknown keys rejected at top-level and per-row → ✓.
**SQL injection.** Supabase `.rpc()` is parameter-bound; RPC body uses `jsonb_typeof` + `jsonb_array_elements` + `->>` extraction + explicit `::uuid` casts — no `EXECUTE format(...)`, no dynamic SQL → ✓.
**XSS via stored caption.** Caption is stored as text and rendered by Channel 1 / public-render code in T43.G+. The schema caps it at 280 chars; no HTML stripping or escaping at this layer (correct — render-side escaping is the right place for that defense, and the existing public-render uses React JSX text-interpolation which escapes by default). Render-side audit deferred to T43.G+ pass.
**Logging hygiene.** `logSupabaseError` writes `errorCode` + `errorMessage` + `stack` — no raw error spread, no PII vector. F-29 reducer pattern intact.
**Atomicity.** DELETE + INSERT inside one PL/pgSQL function body run in one statement-level transaction. INSERT failure (RLS, FK, row-cap trigger) rolls back the DELETE. Confirmed by reading the function body and by the documented atomicity comment at `010a:80-83`.

### Channel-by-channel matrix

| Channel | Implementation | Verdict |
|---|---|---|
| 1 — UI text | `GENERIC_FORM_ERROR` constant; zod field errors only on allowlisted roots | PASS |
| 2 — Response body | Uniform `{status, fieldErrors?, formError?}` envelope; no throws to wire | PASS |
| 3 — Timing | `padToFloor(start)` in `finally`, `MIN_DURATION_MS = 750` | PASS |
| 4 — Action surface | One export; helper colocation: none; tests track allowlist at +1 deferred to T43.F | PASS |
| 5 — Set-Cookie | No `cookies()` calls in wrapper | PASS |
| 6 — Status code | No rethrow; always resolves to the envelope | PASS |

---

## Carry-forward (prior audits, not re-walked this pass — audit 19 was a delta-only audit)

### Medium
- **F-3** — `EMAIL_SCHEMA` length cap (`lib/auth-internal.ts:20`). Recommend `z.string().min(3).max(254).email()`. Carry-forward, unchanged this session.
- **F-4** — Callback handler OTP type set width (`app/(admin)/admin/auth/callback/route.ts`). Recommend narrowing to `new Set(['email', 'magiclink'])`. Carry-forward, unchanged this session.

### Low
F-6, F-7, F-8, F-9, F-10, F-11, F-20, F-21, F-22, F-23, F-24, F-25, F-27, F-28 — prior-audit carry-forwards.
F-31, F-32, F-33, F-34, F-35 — audit 16 Lows, unchanged.
F-37 — audit 18 Low (render-side scheme guard on TypoIcon), deferred carry-forward.
F-36 — RESOLVED in re-audit 17b.

---

## Informational (not findings)

**`tests/server-actions-manifest.test.ts` allowlist at 12 IDs while a 13th action file (`saveProjectMedia`) ships.** Not a security regression. Next.js only includes a Server Action in `server-reference-manifest.json` when it is reachable from an `app/**` route. `saveProjectMedia` is currently only imported by tests, not by any `app/(admin)/**` page. The action ID does not enter the manifest until T43.F mounts the admin form. The 12-ID test continues to assert the manifest contents against the allowlist with byte-for-byte equality — if T43.F lands and forgets to extend the allowlist to 13, the test fails loudly. This is a build-invariant gating concern (the right kind), not a security gap. Confirmed by inspecting the test source and the audit-delegation's verified production build output.

**`security invoker` choice (not `security definer`).** The migration explicitly opts for `security invoker` so the caller's RLS context applies. This is the correct choice for an admin-context write surface — `security definer` would have run the function as the function owner (a superuser-equivalent) and would have bypassed RLS, which would have collapsed the table's authorization model into "anyone with EXECUTE can write anything." The combination is `invoker + revoke-from-anon + grant-to-authenticated + RLS-policy-for-authenticated`: each layer carries its own defense, and any single layer failing does not collapse the gate.

**`search_path = ''` on the function.** Mitigates the `0011_function_search_path_mutable` advisor lint by pinning the function's search path to empty. The body qualifies every reference with `public.*` so the pinned path is safe. Pre-existing functions in the project still trigger this lint (2× baseline `function_search_path_mutable` per the audit-delegation advisor delta) — the new function does not add a third instance, which is the correct behavior. Net: 010a improves the project's advisor posture by adopting the modern pattern.

---

## Security-Process Note (prompt-injection vigilance)

Audit 19 reviewed code authored partly via sub-agent delegation (`@supabase` consult for RPC shape, `@dev` implementation). No prompt-injection content surfaced in any reviewed file. The only environment-injected MCP server-instructions block (Supabase tool guidance) is harness metadata, not a repo payload — no agent acted on it, no migrations or commands were executed by the audit agent (read-only boundary held). Recorded for `@qa` / launch awareness.

---

## Summary Table

| Severity | Count | F-codes |
|---|---|---|
| Critical | 0 | — |
| High | 0 | — |
| Medium | 2 | F-3 (carry), F-4 (carry) |
| Low | ~19 | F-31, F-32, F-33, F-34, F-35 (audit 16); F-37 (audit 18); F-6–F-11, F-20–F-25, F-27, F-28 (carry) |

**Opened audit 19:** None.
**Closed audit 19:** None.
**Verdict:** CLEAR — no Critical or High findings. T43.E ships. Next security review point: T43.F when the admin `ProjectMediaField` form lands (Channel 1 form-side rendering, allowlist 12→13 in the manifest test).
