# Security Report: swarnimbagre.com

**Last audit:** 2026-05-13 (audit 11)
**Scope:** T24 — stats admin: read-only list + manual insert form (uncommitted working tree; data layer + UI + tests)
**Status:** CLEAR
**Summary:** 0 Critical / 0 High / 2 Medium / 15 Low
**Unresolved Critical/High findings:** None

---

## Verdict

T24 ships. Two new mutation Server Actions — `insertStat`, `deleteStat` — close all six channels of the SEC-09 uniformity contract identically to the T20-T22 projects-side and T23 posts-side actions they mirror. The three-module split (`lib/admin-mutations.ts` `'use server'` wrapper / `lib/admin-mutations-internal.ts` throwing helper / `lib/admin-mutations-types.ts` pure types) is preserved exactly: the new wrappers live in `lib/admin-mutations.ts`, the new throwing helpers + zod schema live in `lib/admin-mutations-internal.ts`, and the new `StatMutationState` + `STAT_MUTATION_INITIAL_STATE` live in `lib/admin-mutations-types.ts`. `GENERIC_FORM_ERROR` is shared across project, post, and stat surfaces — resource-agnostic so cross-resource enumeration via copy differences is impossible.

Build is green. The live `.next/server/server-reference-manifest.json` lists exactly ten Server Action exportedNames: `signInWithMagicLink`, `signOut`, `createProject`, `updateProject`, `deleteProject`, `createPost`, `updatePost`, `deletePost`, `insertStat`, `deleteStat`. The two new IDs are purely additive — no `*Internal` helper appears in the manifest. `tests/server-actions-manifest.test.ts` allowlist updated 8 → 10 in lock-step. `docs/architecture.md` §6.6.5 updated to match.

Stats has no slug, no status, and no edit (CONSTRAINT-10: corrections are delete-then-reinsert). The mutation surface is therefore narrower than posts/projects — no slug-lock trigger, no `update*` helper, no pre-fetch on the write path. `insertStatInternal` is a single boundary-validated INSERT; `deleteStatInternal` is a single id-validated DELETE.

The optional `unit` column is handled cleanly: `statInsertSchema` preprocesses empty/whitespace `unit` to `undefined` so the wrapper writes explicit `null` to the column (no empty-string column writes; verified by unit test). Three field-level zod errors plus one form-level `formError` map to the four declared form fields (`category`, `label`, `value`, `unit`) — narrowed via `Partial<Record<…, string>>` so no shape information leaks beyond the form's declared field set.

One new Low finding recorded: **F-28** — `getAllStats` (and the sibling `getAllPosts` / `getAllProjects`) accepts a `pageSize` argument with no internal bounds check. The wire is not directly exposed (the page route hardcodes `pageSize = 50` and only the bounded `page` parameter reads from the URL), so the gap is purely defense-in-depth. F-26 scope formally extends to include `statInsertSchema`. F-3 and F-4 carry forward from audit 5 unchanged. F-23, F-24, F-25, F-26 (scope extended), F-27 and F-6 through F-11, F-20 through F-22 carry forward from prior audits unchanged.

---

## Six-channel mutation uniformity — per-channel verdict (`insertStat` / `deleteStat`)

1. **Channel 1 — UI text.** PASS. `GENERIC_FORM_ERROR = 'Could not save. Try again.'` (`lib/admin-mutations-types.ts:73`, copy unchanged) is the only error string surfaced for the form-level path; zod field errors are filtered to the stat form's four declared fields only (`category`, `label`, `value`, `unit`) via `statZodErrorToFieldErrors` (`lib/admin-mutations.ts:407-426`). No internal error message leaks. The constant is shared with the project and post surfaces — copy is intentionally resource-agnostic so a probe cannot distinguish a stat failure from a post or project failure.

2. **Channel 2 — Response body.** PASS. Envelope is `{ status: 'ok' }` on success, `{ status: 'error', fieldErrors }` for zod-only failures, or `{ status: 'error', formError: GENERIC_FORM_ERROR }` for every other throw. Never throws to the wire — try/catch in `lib/admin-mutations.ts:466-481` (insert) and `:498-507` (delete) is total. The `fieldErrors` key set for stats is narrowed to `Partial<Record<'category' | 'label' | 'value' | 'unit', string>>` (`lib/admin-mutations-types.ts:53`) — no shape information leaks beyond the form's declared fields. Wire-shape test coverage in `tests/admin-mutations.uniformity.test.ts` covers all three branches per action (success, zod-fail, non-zod-fail for insert; success and non-zod-fail for delete).

3. **Channel 3 — Response timing.** PASS. `padToFloor(start)` runs inside `finally` for both new actions (`lib/admin-mutations.ts:478-480`, `:505-507`). `MIN_DURATION_MS` imported from `lib/auth-constants.ts:17` — NOT duplicated. Both new actions reuse the same `padToFloor` helper as the project and post surfaces. Timing-floor test coverage in `tests/admin-mutations.timing.test.ts` covers the instant-resolve and inner-throw paths per action.

4. **Channel 4 — Server Action surface.** PASS. Post-build manifest inspected directly via `tests/server-actions-manifest.test.ts`:
   - Manifest lists exactly ten `exportedName`s: the eight prior IDs plus `insertStat` and `deleteStat`. Edge map empty.
   - `lib/admin-mutations.ts` exports ONLY eight async functions (six prior + `insertStat`, `deleteStat`) — no helpers, consts, or types exported from the `'use server'` module. The two new throwing internals (`insertStatInternal`, `deleteStatInternal`) and the new zod schema (`statInsertSchema`) live in `lib/admin-mutations-internal.ts` (no `'use server'` directive) and so do NOT enter the manifest.
   - `tests/server-actions-manifest.test.ts:21-32` allowlist updated to ten IDs; the test passes against the live manifest (run-time confirmed during `npm test`).
   - `components/admin/StatsInsertForm.tsx`, `components/admin/StatsList.tsx`, and `components/admin/DeleteStatButton.tsx` are `'use client'` only — no `'use server'` cross-leak.

5. **Channel 5 — Response headers.** PASS. Neither new action writes cookies. Supabase client remains `flowType: 'implicit'` per CONSTRAINT-18 (`lib/supabase.ts:41`) — no `*-code-verifier` Set-Cookie is reachable from the mutation surface. The Server Action response headers are identical across outcomes.

6. **Channel 6 — Status code.** PASS. No throw reaches the wire (Channel 2 catch is total for both actions). Next.js frames the Server Action response at 200 across all outcomes.

---

## Standard SEC rule verdicts

- **SEC-01 (no secrets in code).** CLEAR. Grep of all eight new + four modified T24 files returns zero references to `SUPABASE_SERVICE_ROLE_KEY`, `STATS_INGEST_SECRET`, or any literal credential. The mutation surface uses `NEXT_PUBLIC_SUPABASE_ANON_KEY` via `createServerClient()` — session-bound, RLS-respecting. Service-role is never imported into the admin write path.

- **SEC-02 (input validation at boundary).** CLEAR.
  - `insertStatInternal` parses `input` via `statInsertSchema` (`lib/admin-mutations-internal.ts:573-590`) — required-non-empty `category` / `label` / `value` matching DB CHECKs from migration 001, `unit` optional with whitespace-only preprocessed to `undefined`, all four fields capped at `STAT_FIELD_MAX_LENGTH = 200`.
  - `deleteStatInternal` validates `typeof id === 'string' && id.trim().length > 0` BEFORE any DB call (`:668-674`).
  - `getAllStats` accepts only the two pagination ints; `page` is bounded by `coercePage` at the page route (`app/(admin)/admin/stats/page.tsx:14-19`, hard cap `MAX_PAGE = 10_000`) and `pageSize` is hardcoded to 50 by the only caller. See **F-28** below for a defense-in-depth gap on internal bounds.

- **SEC-03 (parameterized queries).** CLEAR. All new query and mutation paths use the Supabase query builder exclusively: `.from('stats').insert(...).select().single()`, `.from('stats').delete().eq('id', id)`, `.from('stats').select(STAT_LIST_COLUMNS, { count: 'exact' }).order(...).range(...)`. No string concatenation involving `id`, `category`, `label`, `value`, or `unit` anywhere in the call chain. Grep for backtick-template-with-id across the new files returns no matches.

- **SEC-04 (auth + authz).** CLEAR. Two-layer enforcement intact:
  - Layer 1: `middleware.ts` runs `runAdminGate(request)` on every `/admin/:path*` request, including Server Action POSTs. Unauthenticated → redirect to `/admin/login`, padded to `MIN_DURATION_MS`. `/admin/stats` is gated identically to `/admin/posts` and `/admin/projects`.
  - Layer 2: RLS `stats_admin_all` (`supabase/migrations/004_rls_stats.sql:47-53`) grants `authenticated` role full CRUD; unauthenticated callers hit `anon` role and the `stats_public_select` policy (line 39-44) which permits SELECT only. An attacker who bypassed the middleware gate and called `insertStat`/`deleteStat` directly would still be unauthenticated at the DB layer and rejected by RLS on the INSERT/DELETE.
  - CONSTRAINT-09 single-user model: RLS grants apply to "the single authenticated user". This is an architectural decision, not a finding; the operational gate is the `ADMIN_ALLOWED_EMAIL` env var in `lib/auth-internal.ts::assertAllowlistedEmail`, with the dashboard "Allow new signups" toggle OFF as Layer 1.

- **SEC-05 (no PII / sensitive data in logs).** CLEAR. `logMutationError` (`lib/admin-mutations-internal.ts:96-106`, unchanged) logs only `operation`, `errorCode`, `errorMessage`, and `stack`. No row data, no `value` content, no `id`, no `category` is logged. `logDbError` in `lib/admin-queries.ts` follows the same shape (`:71-78`). F-25's slug-in-trigger-message concern is N/A for stats — no slug column exists on stats and no trigger fires on the table.

- **SEC-06 (HTTPS + encrypted at rest).** N/A for code change — infrastructure concern. Vercel/Supabase defaults stand.

- **SEC-07 (sensitive files not in VCS).** CLEAR. The T24 working-tree changes touch only `lib/`, `components/admin/`, `app/(admin)/admin/stats/`, `tests/`, and `docs/` (plan-phase-2-admin.md + architecture.md + session-log.md). Of the docs touched, `session-log.md` is on the SEC-07 list — verified covered by `.gitignore` rule `docs/session-log.md`. `git status --short` shows session-log.md among modified files but it is gitignored. `git ls-files | grep -E "^docs/session"` returns nothing — never tracked. `.env.local` exists locally and remains gitignored. No SEC-07-listed file is staged. **SEC-07 verdict: PASS.**

- **SEC-08 (Server Action surface minimization).** CLEAR. Live manifest confirms exactly ten exportedNames — the eight prior IDs plus the two new ones. None of `insertStatInternal`, `deleteStatInternal`, `statInsertSchema`, `statZodErrorToFieldErrors`, `readStatFormData`, or `logMutationError` appears in the manifest. The three-module split prevents a transitive `next/headers` import from breaking the client `StatsInsertForm`; the `'use server'` discipline prevents the throwing helpers from becoming public RPC endpoints.

- **SEC-09 (uniform response across channels).** CLEAR. Six-channel verdict above is the answer for the new mutation surface. Auth flows (`signInWithMagicLink`, `signOut`) untouched by T24.

---

## T24-specific risk verdicts

- **`unit` nullable-column write integrity.** CLEAR. The `unit` column accepts NULL per migration 001. The zod schema preprocesses empty/whitespace strings to `undefined` and the wrapper writes `parsed.unit ?? null` to the column. Unit test `tests/admin-mutations.test.ts` ("preprocesses whitespace-only unit to explicit null") verifies the boundary behavior with an input of three spaces. Empty-string column writes are unreachable; the column either receives a trimmed non-empty string or explicit NULL.

- **No length cap on `category` / `label` / `value`.** CLEAR. The DB has no upper CHECK on these columns; the zod schema caps each at `STAT_FIELD_MAX_LENGTH = 200`. The HTML `<Input maxLength={200} />` is the UI-level guard. Defense in depth holds.

- **`StatsInsertForm` controlled-state pattern.** CLEAR. The form uses four controlled `useState` values plus a `handledStateRef` to dedupe success effects (the form stays on the page after a successful insert; `PostForm` redirects to `/admin/posts` and unmounts, so it does not need the ref). Race-condition consideration: the submit button is disabled while `isPending` from `useActionState`, blocking double-clicks. A crafted same-session replay (curl with the action ID) could insert a duplicate row, but this requires an authenticated admin session and produces a duplicate row — not a security breach. Tracking as a UX consideration, not a security finding.

- **`DeleteStatButton` reuse of `DeleteConfirmModal`.** CLEAR. The generic `DeleteConfirmModal` (T22) is the third reuse site (after posts and projects). Stats label rendered as JSX text children — React's default escaping is active. No `dangerouslySetInnerHTML` in `components/admin/`.

- **CSRF.** CLEAR. Next 15 Server Actions are CSRF-protected by signed action IDs + same-origin enforcement (framework default). `next.config.ts` has no `serverActions.allowedOrigins` opt-out. The two new action IDs are hashed and ship in the client bundle bound to the same-origin check.

- **IDOR / horizontal escalation.** N/A. Single-user system per CONSTRAINT-09; RLS `authenticated`-role policy is the gate either way. There is no notion of "your stat vs. another user's stat" — the admin owns every row. The OpenClaw ingest path (Phase 3) will use the `stats-ingest` Edge Function with service-role + shared-secret, never the user-session RLS path.

- **Stats list / page render exposure.** CLEAR. `getAllStats` uses the session-bound `createServerClient()` and relies on RLS `stats_admin_all` for visibility. The page route hard-caps `MAX_PAGE = 10_000` and hardcodes `pageSize = 50` — abusive `OFFSET` values are bounded. The render path passes `row.label` to `DeleteStatButton`'s `name` prop, which the modal renders as JSX text (escaped).

- **OpenClaw stats-ingest interaction.** N/A. The OpenClaw write path (Phase 3) is untouched by T24. The admin INSERT and the future Edge Function INSERT will share the `stats` table but go through different roles (`authenticated` RLS policy vs. service-role bypass + shared-secret check). T24 does not create or modify the Edge Function.

---

## StatsInsertForm / StatsList / DeleteStatButton — CONSTRAINT-13 voice verdict

CLEAR. User-facing strings audited:
- `'Saved.'` (`StatsInsertForm.tsx:15`) — single word, period.
- `'Deleted.'` (`DeleteStatButton.tsx:12`) — single word, period.
- `'New stat'` (`StatsInsertForm.tsx:155`) — two-word sentence-case label.
- `'All stats'` (`StatsList.tsx:81`) — two-word sentence-case label.
- `'Category'`, `'Label'`, `'Value'`, `'Unit (optional)'` — single-word labels, `(optional)` is the necessary descriptor; no decoration.
- `'Saving'`, `'Save'`, `'Delete'`, `'Cancel'` — single-word labels, no spinner emoji.
- `'No stats yet'` (`StatsList.tsx:24`) — three-word empty state, terse, dry.
- `'Page {page} of {totalPages} — {total} total'` (`StatsList.tsx:117`) — em-dash mirrors `PostsList` precedent; no decoration.

No emoji, no superlative, no SaaS phrasing, no LinkedIn-motivational-post energy. Passes.

---

## Findings

### Critical

None.

### High

None.

### Medium

(F-3 and F-4 from audit 5 remain at Medium severity, carry-forward, neither addressed nor regressed by T24.)

---

**F-3 (Medium, carry-forward, unchanged):** Zod email schema in `lib/auth-internal.ts:20` has no length cap. Recommended `z.string().min(3).max(254).email()`. Not addressed by T24; not regressed.

---

**F-4 (Medium, carry-forward, unchanged):** Callback handler accepts overly wide OTP type set in `app/(admin)/admin/auth/callback/route.ts`. Recommended narrow to `new Set(['email', 'magiclink'])`. Not addressed by T24; not regressed.

---

### Low

---

**F-26 (Low, scope extended again, carry-forward from audit 8):** Zod schemas lack `.strict()`. **Scope now includes `statInsertSchema`** (`lib/admin-mutations-internal.ts:573-590`), in addition to the two project schemas and two post schemas already in scope as of audit 10. Same parse-FormData-only pattern, same low-grade defense-in-depth concern. Extra FormData keys (e.g., a probe sending `?admin=true`) are ignored by `formData.get('category' | 'label' | 'value' | 'unit')`, so the surface remains non-exploitable in practice. Defense-in-depth fix: add `.strict()` to all five schemas (two project + two post + one stat) in one pass — proposed for a dedicated follow-up task rather than piecemeal adoption.

---

**F-28 (Low, NEW in audit 11):** `getAllStats(page, pageSize, client?)` (`lib/admin-queries.ts:359-379`) accepts a `pageSize` argument with no internal bounds check. The same gap exists in `getAllProjects` (`:99-123`) and `getAllPosts` (`:231-255`) — not new code, but flagged here for the first time during T24 fresh-eyes review. The wire is not directly exposed: the page route at `app/(admin)/admin/stats/page.tsx:43` hardcodes `pageSize = PAGE_SIZE = 50`, and `getAllStats` is a server-side helper, not a Server Action. A future refactoring that exposed `pageSize` to user-controlled input (e.g., a `?pageSize=N` search param, or a new admin endpoint accepting size) without bounds would create a DoS vector: a request for `pageSize = 1_000_000` would materialize one million rows into Supabase's response and into memory. Defense-in-depth fix: add `Math.min(pageSize, MAX_PAGE_SIZE)` inside each list-query helper, where `MAX_PAGE_SIZE = 100` or similar. Apply uniformly to `getAllStats`, `getAllPosts`, `getAllProjects`. Not a current vulnerability; tracked for the follow-up sweep that addresses F-26 (the two are natural travel companions).

---

(All other prior-audit Low findings carry forward unchanged: F-27, F-25, F-23, F-24, F-20, F-21, F-22, F-6, F-7, F-8, F-9, F-10, F-11. None regressed or extended by T24. See audit 9 and audit 10 for full text.)

---

## Build invariant — T24

Post-`npm run build` (2026-05-13, audit 11, via `tests/server-actions-manifest.test.ts` `beforeAll`):

- `.next/server/server-reference-manifest.json` lists exactly TEN action exportedNames in the `node` map; `edge` map empty:
  - `signInWithMagicLink` (`lib/auth.ts`)
  - `signOut` (`lib/auth.ts`)
  - `createProject` (`lib/admin-mutations.ts`)
  - `updateProject` (`lib/admin-mutations.ts`)
  - `deleteProject` (`lib/admin-mutations.ts`)
  - `createPost` (`lib/admin-mutations.ts`)
  - `updatePost` (`lib/admin-mutations.ts`)
  - `deletePost` (`lib/admin-mutations.ts`)
  - `insertStat` (`lib/admin-mutations.ts`) ← NEW (T24)
  - `deleteStat` (`lib/admin-mutations.ts`) ← NEW (T24)
  The eight prior exportedNames are unchanged from audit 10 — the two new entries are purely additive. No `*Internal` helper or schema appears in either map.
- `tests/server-actions-manifest.test.ts:21-32` allowlist matches the live manifest exactly (ten IDs).
- `docs/architecture.md` §6.6.5 narrative refreshed to list ten IDs in lock-step.
- T24 tests: `npm test` count moved 141 → 159 (+18: 2 getAllStats query, 5 insertStatInternal + 2 deleteStatInternal data-layer, 3 insertStat + 2 deleteStat uniformity, 2 insertStat + 2 deleteStat timing). Build emitted `/admin/stats` route at 2.77 kB / 143 kB First Load JS.

---

## SEC-07 sensitive-file exposure check

- `.env.local` exists locally and is matched by `.gitignore` rule `.env*` (with `!.env.example` exception). Unchanged by T24.
- `git ls-files | grep -E "^\.env"` returns only `.env.example` — no real env file ever committed.
- `git status --short` lists `docs/session-log.md` among modified files; this file is gitignored (`docs/session-log.md` rule in `.gitignore`) — it is NOT tracked and will NOT enter any commit.
- T24 working-tree changes do not touch any other SEC-07-listed file (no `CLAUDE.md`, `manifest.md`, `profile.md`, `content/`, `docs/session-handoff.md`, `docs/testing-setup.md`, `docs/framework-issues.md`).
- `git log --all --name-only` across full history: zero SEC-07 files (only `.env.example`).

**SEC-07 verdict:** PASS.

---

## Summary Table

| Severity | Count | F-codes |
|---|---|---|
| Critical | 0 | — |
| High | 0 | — |
| Medium | 2 | F-3, F-4 |
| Low | 15 | F-6, F-7, F-8, F-9, F-10, F-11, F-20, F-21, F-22, F-23, F-24, F-25, F-26 (scope extended again), F-27, F-28 (new) |

**Verdict:** CLEAR — no Critical or High findings. T24 ships. The six-channel uniformity contract extends to the two new stat mutation Server Actions with no regression and no new structural exposure. F-26 scope formally extended to cover `statInsertSchema` (defense-in-depth, not exploitable in practice). F-28 newly recorded — a defense-in-depth `pageSize`-bounds gap that exists across `getAllStats` / `getAllPosts` / `getAllProjects` but is not currently wire-exposed. F-26 and F-28 are natural travel companions for a single dedicated follow-up task.

**Path forward:** T24 is CLEAR. Proceed to T25 (Image upload component + Storage integration).
