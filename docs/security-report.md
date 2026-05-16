# Security Report: swarnimbagre.com

**Last audit:** 2026-05-15 (audit 16 — T36 full pre-launch review; re-audit 16b same day — F-29 + F-30 fixes verified RESOLVED)
**Scope:** Full codebase T1–T34, plus the T30 `stats-ingest` Edge Function and the T34 `ADMIN_ALLOWED_EMAIL` startup-validation diff (both explicitly in T36 scope per Session-22 handoff). Audited surfaces: DB migrations + RLS (`supabase/migrations/001–007`), Edge Function (`supabase/functions/stats-ingest/`), auth path (`middleware.ts`, `lib/auth.ts`, `lib/auth-internal.ts`, `lib/session.ts`, `app/(admin)/admin/auth/callback/route.ts`), Server Actions + zod boundaries (`lib/admin-*-mutations*.ts`), Markdown render (`lib/markdown.ts`, `components/public/MarkdownContent.tsx`), uploads + Storage policy, secrets / `.gitignore` / git history, HTTPS config, `lib/env.ts` + `tests/env.test.ts`.
**Status:** CLEAR
**Summary:** 0 Critical / 0 High / 2 Medium / ~18 Low (audit 16 opened 2 Medium + 5 Low; re-audit 16b resolved both new Medium — F-29, F-30)
**Unresolved Critical/High findings:** None
**Re-audit 16b (2026-05-15):** F-29 and F-30 verified RESOLVED — see "Re-audit 16b" section below. Remaining Mediums are carry-forward F-3, F-4 only.

---

## Verdict

CLEAR. Zero Critical, zero High. All seven T36 acceptance criteria pass. The two Medium and five Low items opened this audit are documented, tracked, and non-blocking per the severity rubric (Medium does not block shipping if documented and tracked). Two are recommended as cheap pre-launch hardening (F-29, F-30); the rest are defense-in-depth.

**Correction recorded (process honesty):** An initial audit pass flagged client-side Markdown sanitization as two HIGH findings. That was incorrect — it was graded against an over-specified "sanitize server-side" framing introduced in the audit delegation, **not** against the binding constraint. `docs/constraints.md:76–84` (CONSTRAINT-06) explicitly mandates the render path be *"`marked` (parse) → DOMPurify (sanitize) → DOM injection, executed client-side."* `lib/markdown.ts` + `components/public/MarkdownContent.tsx` implement exactly that. The findings are **withdrawn**; the implementation is conformant. Detail under T36-3 below.

---

## T36 Acceptance Criteria — Verdicts

### 1. RLS audit — PASS
Five RLS surfaces — `projects`, `posts`, `stats`, `images`, `storage.objects` (images bucket). RLS enabled on every one (`002:30`, `003:30`, `004:36`, `005:38`, `007` Supabase-default + policy). Default-deny confirmed: no permissive anon write policy anywhere. Migration policies match `architecture.md §6.1` (lines 381–400) verbatim, including the deliberate "no INSERT policy for `anon`" on `stats`. OpenClaw / anon / publishable key has **no** SELECT-write / UPDATE / DELETE / INSERT path to any table; the only write path to `stats` is the service-role Edge Function (which bypasses RLS by design — CONSTRAINT-04). Storage policy `007:59–64` has both `USING` and `WITH CHECK` on `bucket_id = 'images'` (CONSTRAINT-20). Bucket is private; reads via signed URLs (CONSTRAINT-15). Two Low defense-in-depth items: F-31, F-32.

### 2. Auth audit — PASS
`isGatedAdminPath` (`middleware.ts:49–52`) gates every `/admin/*` path via `startsWith('/admin')` minus two exact public subpaths; nested paths (e.g. `/admin/login/recover`) are gated. Unauthenticated / expired / error all redirect to `/admin/login` (`middleware.ts:113–131`). JWT lifetime = Supabase default; magic-link tokens short-lived (Supabase-managed). Admin authorization is a real two-layer enforced gate, not middleware-only: pre-send allowlist in `assertAllowlistedEmail` (`auth-internal.ts:38–56`, runs before `signInWithOtp`, `shouldCreateUser:false`) **and** the authoritative post-verify gate `rejectIfNotAllowlisted` in the callback (`getUser()` round-trip → email compare → `signOut()` + redirect on mismatch). SEC-08/SEC-09 clean (see T36 cross-cuts). One Medium: F-29 (log hygiene).

### 3. Input validation audit — PASS
Every mutating Server Action validates at the boundary with a `.strict()` zod schema before any DB/storage call (`createProject/updateProject/deleteProject`, `createPost/updatePost/deletePost`, `insertStat/deleteStat`, `uploadImage`, `deleteOrphanImages`). All Supabase access uses the parameter-bound query builder (`.eq/.insert/.update/.delete/.select`); no `.rpc/.or/.filter/.textSearch`/raw SQL with user input; no string interpolation into any query (SEC-02, SEC-03 clean). **Markdown sanitizer whitelist is the locked one:** `lib/markdown.ts:23–24` (`ALLOWED_TAGS` = p, ul, ol, li, blockquote, code, pre, em, strong, a, h1–h4, img; `ALLOWED_ATTR` = href, src, alt) matches `constraints.md:78` exactly. Sanitization runs (DOMPurify, conservative whitelist, default `javascript:`/event-handler stripping) before injection. Client-side execution is **mandated** by CONSTRAINT-06, not a defect. One Low: F-34 (delete-id not UUID-shape-validated).

### 4. File upload audit — PASS (boundary), Medium gap (second layer)
`validateFile` (`admin-images-mutations-internal.ts:115–137`) enforces MIME allowlist (`image/jpeg|png|webp`) and 2 MB cap at the action boundary before any I/O. Path = `images/{projects|posts}/{parent_id}/{uuid}_{filename}` with `parentType` zod-enum and `parentId` zod-UUID (path traversal closed), filename sanitized (`sanitizeFilename:153–185` strips control/`/`/`\`, neutralizes `..`, caps length), `crypto.randomUUID()` prefix, `upsert:false`. Conforms to CONSTRAINT-07. **Gap:** the Storage-bucket-side type/size limit is hand-configured in the Supabase Dashboard (documented `005:80–87`), not codified in a migration — the required second enforcement layer is not reproducible from version control. Medium: F-30.

### 5. Secrets audit — PASS
`.gitignore` covers every SEC-07 file/pattern (`.env*` with `!.env.example`, plus `CLAUDE.md`, `manifest.md`, `profile.md`, `content/`, all SEC-07 docs). **Git history clean:** `git log --all --diff-filter=A` and `--name-only` for every SEC-07 path → zero results across 80+ commits; only `.env.example` is tracked. No hardcoded secrets (no `eyJ`/`sk_`/private-key/real-value-default patterns) anywhere outside `node_modules/.next/.git`. `.env.example` and `docs/env-checklist.md` contain names/placeholders only (sole non-empty value is a documented non-secret test email). `lib/env.ts` has no real-value fallback; failure messages name variables only, never echo values (SEC-01, SEC-05). `SUPABASE_SERVICE_ROLE_KEY` appears only in server-only contexts (Edge Function env, test route triple-gated per CONSTRAINT-19, Node scripts) — never `NEXT_PUBLIC_`, never client. No credential rotation required.

### 6. Edge Function audit — PASS
`stats-ingest/index.ts`: secret comparison is constant-time via `timingSafeEqual` (`node:crypto`) over a fixed-size buffer padded to the expected length and AND-ed with a length-match flag (`88–93`) — no `===` on the secret; missing/short/long/wrong all execute the same fixed-size compare. 401 for missing header is byte-identical to 401 for wrong header (same `jsonResponse(401, {error:"unauthorized"})`, `195–202`; only an internal log field differs). No internal detail leaks in any of the six return paths — every error body is a generic constant; DB error / stack / env only go to `console.*`, never the wire (SEC-05). Writes only to `stats`, INSERT-only, service-role + secret read from `Deno.env` (no literals) — CONSTRAINT-04. Required edge tests present (static constant-time check, 401-equality, sentinel no-leak, happy path). One Low: F-33.

### 7. HTTPS — PASS
No `vercel.json`, no HTTPS downgrade anywhere; Vercel auto-manages TLS + HTTP→HTTPS 308 redirect (SEC-06 satisfied via redirect). HSTS header not set in-repo — stronger arm absent. One Low: F-35. Live `http://` → `https://` redirect to be confirmed post-deploy (already a `docs/launch-checklist.md` item).

---

## Re-audit 16b (2026-05-15) — F-29 + F-30 RESOLVED

Builder elected to fix both new Mediums before session close; `@dev` applied targeted fixes; `@security` re-verified.

- **F-29 — RESOLVED.** Shared reducer `toLogSafeError()` added to `lib/errors.ts` — copies only `name`/`status`/`code`, never spreads the original, so `message`/`cause` (the PII vectors) cannot survive serialization. Applied at `lib/auth-internal.ts:121` and the four raw-error sites in the callback route (`route.ts:74,80,130,141`); the pre-existing safe-literal site (`route.ts:86–90`) correctly left untouched. `tests/errors.test.ts` (new, 5 cases) pins the contract incl. an explicit "PII-bearing message never survives `JSON.stringify`" assertion. Gate: `tsc` clean, suite 201/201, no Server Action drift (`toLogSafeError` is not a `'use server'` export).
- **F-30 — RESOLVED.** `supabase/migrations/008_storage_images_limits.sql` codifies the `images` bucket `file_size_limit` (2097152) + `allowed_mime_types` (jpeg/png/webp), mirroring `MAX_FILE_BYTES`/`ALLOWED_MIME_TYPES`. The SEC-02 second layer is now version-controlled and reproducible — which is what the finding flagged. Stale mirror comments in `lib/admin-images-mutations-types.ts` repointed to 008. **Residual (not a finding):** migration 008 is not yet applied to the production Supabase project — a tracked deploy step for T39 (CONSTRAINT-02: single prod project, no staging). It is idempotent and the live bucket already enforces these exact limits (hand-set 2026-05-07 per migration 005's note), so applying 008 only makes prod == version control.

Net after 16b: 0 Critical / 0 High / 2 Medium (carry-forward F-3, F-4) / ~18 Low. Status remains CLEAR.

---

## New Findings (audit 16)

### [MEDIUM — RESOLVED in re-audit 16b] F-29 — Full Supabase `error` object logged on auth failure paths
**Rule:** SEC-05.
**Founder Brief**
**Decided:** Two auth failure paths write the raw Supabase error object to server logs instead of a reduced shape.
**Means for your product:** Anyone with server-log access (Vercel log drains, a future log aggregator) could read Supabase auth error payloads, which can carry an email or rate-limit detail — the same PII the rest of this module deliberately keeps out of logs.
**Check before approving:** After fix, `attemptMagicLink` and the callback failure logger must log `error.name`/`error.status` only — grep the auth module for a bare `error` in a `console.error` object.
**What this closes off:** Nothing — it aligns implementation with the module's already-documented intent.
**What is wrong:** `lib/auth-internal.ts:118–122` logs `{ operation, emailProvided: true, error }` where `error` is the raw Supabase `AuthError`. The same pattern feeds `logCallbackFailure` in `app/(admin)/admin/auth/callback/route.ts:39–45`. The module's own docstrings (`auth-internal.ts:32, 92`) explicitly promise "presence only — never the raw email (SEC-05)"; line 121 contradicts that. Every other log site in the file is already clean.
**What could go wrong:** Supabase `AuthError.message` can include the submitted address or rate-limit text. Realistic exposure is bounded — `assertAllowlistedEmail` runs *before* `signInWithOtp`, so only the single allowlisted admin email ever reaches line 113 — but it is still PII in logs, which SEC-05 prohibits without qualification. Server-log only (the wrapper masks the wire), so not remotely exploitable → Medium, not High.
**How to fix it:** Reduce to `error: { name: error.name, status: error.status }` (or `errorName`) at `auth-internal.ts:121` and inside `logCallbackFailure`. ~2-line change per site. `@dev`.

### [MEDIUM — RESOLVED in re-audit 16b] F-30 — Storage bucket type/size limit not codified in a migration
**Rule:** SEC-02 (uploads — both-layer requirement).
**Founder Brief**
**Decided:** The image bucket's MIME/size cap exists only as hand-set Supabase Dashboard config, not in version control.
**Means for your product:** A project provisioned/restored from migrations has no bucket-level size/type cap until someone manually re-configures the Dashboard; if the app-layer check is ever bypassed, the intended second layer does not exist in code.
**Check before approving:** Either a migration sets `storage.buckets.file_size_limit` + `allowed_mime_types` for `images`, or the Dashboard values are verified present and that verification is a recurring launch-checklist item.
**What this closes off:** Nothing — codifying it is strictly additive.
**What is wrong:** Migration `007` enforces only `bucket_id = 'images'` ownership. The 2 MB / MIME limit is documented as "Configured by hand in Supabase Dashboard" (`005:80–87`) — not reproducible, drifts silently.
**What could go wrong:** If `validateFile` is bypassed (a second upload path, a direct authenticated Storage SDK call, or a regression), the bucket accepts arbitrary content-type/size up to Supabase global default. Boundary validation + single trusted author keep real-world likelihood low → Medium.
**How to fix it:** Add a migration setting the bucket `file_size_limit` and `allowed_mime_types`. `@dev`. Until then, treat as a documented single-layer control and add a manual Dashboard-verification line to `docs/launch-checklist.md`.

### [LOW] F-31 — Admin RLS policies grant `FOR ALL` to any `authenticated` JWT (`USING (true)`)
**Rule:** SEC-04 / CONSTRAINT-09. `*_admin_all` policies (`002/003/004/005/007`) use `using(true)/with check(true)`; DB authz relies entirely on the deployment invariant "exactly one account exists" (signup off + email allowlist), not a DB-level identity pin. Not exploitable while signup is off. Defense-in-depth: pin to `auth.jwt()->>'email' = <admin>` or a fixed UID so a stray second account is still DB-denied. Non-blocking.

### [LOW] F-32 — No explicit `REVOKE` of default `anon`/`PUBLIC` table grants
**Rule:** CONSTRAINT-08. Migrations rely on the standard Supabase model (RLS is the gate; implicit table grants remain). Functionally safe while RLS stays enabled. Belt-and-suspenders: add `REVOKE`/least-privilege grants per table. Non-blocking.

### [LOW] F-33 — Edge Function constant-time test is static-only
**Rule:** SEC-04 (regression guard). `index.test.ts:101–110` greps source for `timingSafeEqual`; the two 401 tests assert equality independently but no single test asserts the missing-vs-wrong 401 responses are byte-identical (status+body+headers). Implementation is correct today; a future diverging refactor would not be caught. Add a deep-equality test over both 401 Responses. Non-blocking.

### [LOW] F-34 — Delete actions validate `id` non-empty but not UUID shape
**Rule:** SEC-02. `deleteProject/deletePost/deleteStat` check `typeof id === 'string' && trim().length > 0` then `.eq('id', id)` (parameterized — no injection, no traversal). Create/update paths UUID-validate via zod; delete should match (`z.string().uuid()`). Impact limited to a malformed value producing a swallowed cast error. Non-blocking.

### [LOW] F-35 — No explicit HSTS header
**Rule:** SEC-06. HTTPS satisfied by Vercel's default HTTP→HTTPS redirect; no `Strict-Transport-Security` header set in-repo, leaving a first-visit SSL-strip window. Single-user magic-link admin, no passwords in transit → low impact. Add a `headers()` entry in `next.config.ts` (`max-age=63072000; includeSubDomains; preload`); already referenced in `docs/plan-phase-4-launch.md:239`. Non-blocking.

**Informational (not findings):** middleware matcher excludes `/api/*` — correct per SEC-04 (middleware is not the authz control); the sole in-scope `/api` route is triple-gated per CONSTRAINT-19. Middleware uses `getSession()` not `getUser()` — documented presence-gate; authoritative authz is the callback `getUser()` + data layer (accepted). Edge `checkRateLimit` is an intentional Phase-3 no-op (CQ, not SEC; deferred per T30 plan). Doubled `images/images/` object-key segment is intentional and documented (CONSTRAINT-07 conformant).

---

## Carry-forward (prior audits)

Not individually re-walked this pass; the four T36 slices covered the full SEC-constraint surface and surfaced no regression of these.

### Medium
- **F-3 (Medium, carry-forward — confirmed still present):** `EMAIL_SCHEMA` in `lib/auth-internal.ts:20` is `z.string().min(1).email()` with no length cap. Recommend `z.string().min(3).max(254).email()`.
- **F-4 (Medium, carry-forward — not re-verified this pass):** Callback handler accepts an overly wide OTP type set in `app/(admin)/admin/auth/callback/route.ts`. Recommend narrowing to `new Set(['email', 'magiclink'])`.

### Low
F-6, F-7, F-8, F-9, F-10, F-11, F-20, F-21, F-22, F-23, F-24, F-25, F-27, F-28 — carry-forward from prior audits, none observed regressed. (F-26 remains CLOSED per audit 12.)

---

## Security-Process Note (prompt-injection vigilance)

The Session-22 handoff flagged a prior prompt-injection attempt via the sub-agent tool channel (fake external "source tarball" download). This audit ran four parallel sub-agents on that same channel. **Result: clean.** No attacker-originated injected instruction appeared in any audited file, git history, or command output. The only "suspicious content" all four agents reported was the legitimate environment-injected Supabase MCP server-instructions block (`npx skills add ...`, `apply_migration`) — tool/harness guidance, not a repo payload; no agent acted on it; no installs/migrations/fetches performed; the read-only audit boundary held. No in-repo remediation required. Recorded for `@qa` / launch awareness.

---

## Summary Table

| Severity | Count | F-codes |
|---|---|---|
| Critical | 0 | — |
| High | 0 | — |
| Medium | 2 | F-3 (carry), F-4 (carry) — [F-29, F-30 RESOLVED in re-audit 16b] |
| Low | ~18 | F-31, F-32, F-33, F-34, F-35 (new); F-6–F-11, F-20–F-25, F-27, F-28 (carry) |

**Withdrawn audit 16:** the two transient HIGH "server-side Markdown sanitization" findings — code conforms to CONSTRAINT-06's explicit client-side mandate (audit-delegation framing error, corrected).
**Opened audit 16:** F-29, F-30 (Medium); F-31–F-35 (Low).
**Closed re-audit 16b:** F-29, F-30 (both Medium — fixes verified).

**Verdict:** CLEAR — no Critical or High findings. T36 launch gate is not blocked. The two new Mediums (F-29 auth log hygiene, F-30 Storage-limit codification) were fixed and verified in re-audit 16b; only carry-forward Mediums F-3/F-4 remain for a future hardening pass. One tracked deploy action: apply migration 008 to the production Supabase project during T39 (idempotent; live env already compliant).

## Status: CLEAR
