# Security Report — T17 Magic-Link Login Flow (Audit Pass 4)

**Date:** 2026-05-12 (audit 4 — final pass)
**Auditor:** @security (session 12, audit pass 4)
**Scope:** T17 after F-14 + F-15 fixes — `lib/auth.ts`, `lib/auth-internal.ts` (NEW), `lib/supabase.ts`, `lib/env.ts`, `lib/errors.ts`, `components/admin/LoginForm.tsx`, `app/(admin)/admin/login/page.tsx`, `app/(admin)/admin/auth/callback/route.ts`, `.env.example`, `tests/auth.test.ts`, `tests/auth-cookies.test.ts` (NEW), `tests/LoginForm.test.tsx`, `tests/admin-auth-callback.test.ts`, plus the Next.js build manifest at `.next/server/server-reference-manifest.json` and the client chunk at `.next/static/chunks/app/(admin)/admin/login/page.js`. Verifies the audit-3 fix loop closure.
**Status:** CLEAR
**Supersedes:** audit 3 BLOCKED report.

## Verdict

The audit loop is closed. F-14 and F-15 are both fully mitigated and the mitigations are verified at the build-artifact level, not just at the source level. The build manifest at `.next/server/server-reference-manifest.json` now contains exactly ONE action ID (`signInWithMagicLink`); the prior `attemptMagicLink` action ID (`4018515b294631606bfe0eb8fb881fa5a1914d5b9d`) is zero-hits anywhere under `.next/`. The client static chunk contains exactly one action ID — the `signInWithMagicLink` one — and zero references to `attemptMagicLink`. The `lib/supabase.ts` server client is constructed with `auth: { flowType: 'implicit' }`, and a dedicated test (`tests/auth-cookies.test.ts`) verifies that the production factory actually passes that option to `@supabase/ssr` AND that no `*-code-verifier` cookie is set on any of the three observable paths (allowlisted, not-allowlisted, malformed). All 26 tests across the four T17 test files pass. The split between `lib/auth.ts` (the sole `'use server'` file, single export) and `lib/auth-internal.ts` (no directive, throwing helper) implements SEC-08 to the letter and matches the channel-decomposition spec at `docs/auth-flow.md` §2a points 4 and 5. The Critical from audit 3 is gone, the new Medium from audit 3 is gone, no new findings were introduced by the fix, and the carry-forward Mediums (F-3, F-4, F-5) plus carry-forward Lows (F-6 through F-11) remain at their prior severities. T17 is safe to mark complete. Proceed to T18.

## Resolved Findings

- **F-1, F-2:** resolved in audit-2 fix loop. Unchanged here.
- **F-12, F-13:** resolved in audit-3 fix loop. Audit 3 marked these "partially mitigated" because the wrapper was bypassable via F-14; with F-14 now closed, both are fully mitigated.
- **F-14: Mitigated.** Build manifest contains exactly one action ID. `attemptMagicLink` is a non-`'use server'` module export reachable only from server code that imports it. Zero browser-callable surface.
- **F-15: Mitigated.** `lib/supabase.ts:40-42` sets `auth: { flowType: 'implicit' }`. `tests/auth-cookies.test.ts:79-88` asserts the production factory passes the option through. Three further test cases assert no `*-code-verifier` cookie is set on any branch.

## Findings (post-fix)

### Critical

None.

### High

None.

### Medium

---

**F-3: Zod email schema has no length cap (carried forward, unchanged)**

- **Severity:** Medium
- **Where:** `lib/auth-internal.ts:20` — `z.string().min(1).email()`; `components/admin/LoginForm.tsx:21` — same shape mirrored client-side. The schema moved with the helper extraction (was `lib/auth.ts:9` pre-F-14 fix), but it is unchanged. The audit-3 recommendation to add `.max(254)` was not picked up by the F-14/F-15 fix sub-agents, which is correct — F-3 is a Medium and was explicitly scheduled as "fix during Phase 2" rather than blocked alongside F-14/F-15.
- **Threat:** Unchanged. No `.max(254)`. A 10MB email-shaped string is accepted by zod, forwarded to Supabase, wastes bandwidth + Supabase quota.
- **Mitigation status:** unmitigated.
- **Recommended fix:** `z.string().min(3).max(254).email()` on both schemas.
- **Effort:** trivial.

---

**F-4: Callback handler accepts overly wide OTP type set (carried forward, unchanged)**

- **Severity:** Medium
- **Where:** `app/(admin)/admin/auth/callback/route.ts:16-23` — `VALID_EMAIL_OTP_TYPES` includes `recovery`, `invite`, `email_change`, `signup` that the T17 flow never emits. Unsafe cast at `route.ts:127` (`type as 'email'`).
- **Threat:** Defense-in-depth allowlist at `route.ts:133` limits blast radius; type-system hygiene gap remains.
- **Mitigation status:** partially mitigated.
- **Recommended fix:** Narrow to `new Set(['email', 'magiclink'])`. Replace cast with `EmailOtpType` from `@supabase/supabase-js`.
- **Effort:** small.

---

**F-5: `/admin/*` unprotected between T17 and T18 ship (carried forward, unchanged)**

- **Severity:** Medium
- **Where:** `middleware.ts:44` (no admin gate yet — added in T18).
- **Threat:** F-1 callback defense-in-depth means an attacker cannot mint a session; the leak is bounded to layout/nav rendering for unauthenticated visitors.
- **Mitigation status:** accepted-risk (T18 sequencing).
- **Recommended fix:** Ship T18 next.
- **Effort:** N/A.

---

### Low

---

**F-6 through F-11 carry forward from audit 3 unchanged.**

- **F-6:** No CSP — defer to Phase 4 launch prep.
- **F-7:** `@types/dompurify@3.0.5` stale.
- **F-8:** Caret pins on `marked` and `dompurify` — mitigated by `package-lock.json`.
- **F-9:** XSS regression test gap on the public Markdown sanitizer.
- **F-10:** Cookie hardening implicit (relies on `@supabase/ssr` defaults).
- **F-11:** No app-level rate limit on `signInWithMagicLink`. With F-14 fixed, the audit-3 contingency ("escalates to Medium if F-14 is accepted") is moot — F-11 stays Low.

---

## Threat Model Walkthrough

**F-14a (`lib/auth.ts` exports):** Read start-to-end. Single export: `signInWithMagicLink` at line 55. `attemptMagicLink` is NOT defined and NOT exported here — it is imported from `./auth-internal` at line 3 and called from the wrapper body at line 58. **Mitigated.**

**F-14b (`lib/auth-internal.ts` directive check):** Read start-to-end. The file has no `'use server'` directive at the top (the first non-comment statement is `import { z } from 'zod';` at line 1). The string `'use server'` appears only inside JSDoc comments at lines 7, 8, 94, 95 — all describing why the directive is deliberately absent. No function-level `'use server'` annotations. `attemptMagicLink` at line 105 is exported as a regular async function. **Mitigated — the helper is a regular ES module export, not a Server Action.**

**F-14c (build manifest action IDs — CRITICAL evidence):** Contents of `.next/server/server-reference-manifest.json` verbatim:

```json
{
  "node": {
    "4022f0de80ca96a1401369508fbda9577f368adadf": {
      "workers": {
        "app/(admin)/admin/login/page": {
          "moduleId": "(action-browser)/./node_modules/next/dist/build/webpack/loaders/next-flight-action-entry-loader.js?actions=%5B%5B%22C%3A%5C%5CUsers%5C%5CSwarnim%20Bagre%5C%5CDownloads%5C%5CMy%20Files%5C%5CProfessional%5C%5CProjects%5C%5CGithub%20Projects%5C%5Cswarnimbagre.com%5C%5Clib%5C%5Cauth.ts%22%2C%5B%7B%22id%22%3A%224022f0de80ca96a1401369508fbda9577f368adadf%22%2C%22exportedName%22%3A%22signInWithMagicLink%22%2C%22filename%22%3A%22..%2FC%3A%5C%5CUsers%5C%5CSwarnim%20Bagre%5C%5CDownloads%5C%5CMy%20Files%5C%5CProfessional%5C%5CProjects%5C%5CGithub%20Projects%5C%5Cswarnimbagre.com%5C%5Clib%5C%5Cauth.ts%22%7D%5D%5D%5D&__client_imported__=true!",
          "async": false
        }
      },
      "layer": {
        "app/(admin)/admin/login/page": "action-browser"
      },
      "filename": "../C:\\Users\\Swarnim Bagre\\Downloads\\My Files\\Professional\\Projects\\Github Projects\\swarnimbagre.com\\lib\\auth.ts",
      "exportedName": "signInWithMagicLink"
    }
  },
  "edge": {},
  "encryptionKey": "VocxjajCKocNrbVvgzYZUzT0/bsU72zqMpHKdccZ5OE="
}
```

Exactly one action ID under `node`: `4022f0de80ca96a1401369508fbda9577f368adadf` with `exportedName: "signInWithMagicLink"`. No `attemptMagicLink` entry. **Mitigated.**

(One ancillary note on the manifest content above: the `encryptionKey` field is the per-build Server Action encryption key. It is build-output, not source. Treating it as a secret would be standard hygiene if this directory were ever served as static assets, but `.next/` is server-only and conventionally never deployed as-is; Vercel re-derives the key per deploy. Not a finding.)

**F-14d (grep `.next/` for prior `attemptMagicLink` action ID):** `4018515b294631606bfe0eb8fb881fa5a1914d5b9d` — **zero occurrences anywhere in `.next/`**. Confirmed via Grep across the entire directory tree. The prior action surface is fully removed.

Cross-check: `attemptMagicLink` (the function name) appears in 1 file under `.next/`: `.next/server/app/(admin)/admin/login/page.js` (server-side compiled bundle). The two occurrences in that file are (a) the webpack harmony export shape from `auth-internal.ts`, (b) JSDoc text carried through compilation, and (c) the call site inside `signInWithMagicLink`'s body. None is an action-ID registration. The client static chunk (`.next/static/chunks/app/(admin)/admin/login/page.js`) contains **zero** references to `attemptMagicLink` and exactly **one** reference to the `signInWithMagicLink` action ID. **Mitigated.**

**F-14e (test imports):** `tests/auth.test.ts:9` imports `attemptMagicLink` from `@/lib/auth-internal` (correct — not from `@/lib/auth`). `tests/auth.test.ts:10` imports `signInWithMagicLink` from `@/lib/auth`. If the import had been wrong, vitest would have thrown an import error at suite collection; instead all 12 tests in this file pass. **Verified.**

**F-15a (`lib/supabase.ts` flowType):** Read line 40-42 — the `createSSRServerClient` call is passed `{ auth: { flowType: 'implicit' }, cookies: { ... } }`. The JSDoc at lines 14-29 documents the F-15 rationale and the consequence for the callback's `?code=` branch. **Mitigated.**

**F-15b (`tests/auth-cookies.test.ts` assertion strength):** The test:
- Lines 46-56 mock `@supabase/ssr.createServerClient` to capture the options object passed to it AND return a stub auth client whose `signInWithOtp` resolves clean. This means the **production `createServerClient` in `lib/supabase.ts` runs end-to-end** — that is the code path under test.
- Lines 27-34 mock `next/headers.cookies()` to record every `set()` call routed through the cookie adapter `lib/supabase.ts:43-53` wires up.
- Line 79-88 asserts `capturedOptions.value.auth.flowType === 'implicit'` — directly verifies the production factory passes the implicit flag through.
- Lines 90-115 assert `cookieSetCalls.filter(c => c.name.includes('code-verifier'))` is empty on all three branches: allowlisted, not-allowlisted, malformed. Each test takes ~760ms (the MIN_DURATION_MS floor — observable proof that `signInWithMagicLink` ran the full wrapper path).

**Not weak.** The test does NOT wholesale-mock `@/lib/supabase`; it mocks the underlying `@supabase/ssr` so the real `createServerClient` factory is the code under test. The assertion strategy proves the cookie surface is uniform. **Mitigated.**

**F-15c (cumulative response-header uniformity check):** All four uniformity channels for the wire-level response are now closed: body shape (F-13), timing (F-12), action surface (F-14), `Set-Cookie` headers (F-15). Status codes are Next.js framework-controlled and identical at 200 across outcomes. UI text is uniform (F-2). Six-channel decomposition per `docs/auth-flow.md` §2a is enforced.

**Regression: did `lib/auth-internal.ts` accidentally introduce `'use server'`?** Grepped the file. Zero hits for `'use server'` outside JSDoc lines 7-8, 94-95 (which explicitly say "deliberately does NOT carry the directive"). No string literals containing `'use server'` or `"use server"`. **No regression.**

**Regression: is the `attemptMagicLink` import path correct?** `lib/auth.ts:3` reads `import { attemptMagicLink } from './auth-internal';` — relative import from `lib/auth.ts` to `lib/auth-internal.ts`. Path resolves. If the path had been typo'd, the wrapper would call `undefined(email)` at line 58 and every test in `tests/auth.test.ts` `signInWithMagicLink` describe block would have crashed. They pass. **Verified.**

**Regression: does `flowType: 'implicit'` break the callback's `?code=` branch?** The branch at `app/(admin)/admin/auth/callback/route.ts:138-147` calls `supabase.auth.exchangeCodeForSession(code)`. Under implicit flow, `signInWithOtp` does not issue a `?code=` query param, so this branch is dead in the production magic-link path. If it ever fires erroneously (e.g., an attacker hand-crafts a `?code=xyz` URL), Supabase's implicit-flow client will return an error from `exchangeCodeForSession`; the route handler at line 140-142 catches that, logs `'exchangeCodeForSession returned error'`, and returns the generic `FAILURE_REDIRECT`. No new error path; behavior on the unreachable branch is the same generic failure as any other unrecognized callback shape. `tests/admin-auth-callback.test.ts:131-147` exercises this branch with a mocked stub and asserts the defense-in-depth check runs. The branch is intentionally retained for the future-OAuth path documented in `lib/supabase.ts:25-28`. **No regression.**

**Regression: are there any other `'use server'` files in the project?** Grepped `lib/`, `app/`, `components/` for both `'use server'` and `"use server"`. Exactly one match for the file-level directive: `lib/auth.ts:1`. Zero function-level `'use server'` annotations anywhere. **No regression.**

**Carry-forward T-N items:** F-3, F-4, F-5, F-6, F-7, F-8, F-9, F-10, F-11 unchanged.

---

## Static Scan Results

**1. Hardcoded secrets (`sk_`, `service_role`, `eyJ` JWT prefix):**

Matches inventory:
- `supabase/migrations/002_rls_projects.sql`, `003_rls_posts.sql`, `004_rls_stats.sql`, `005_rls_images.sql` — `service_role` references are SQL comments documenting RLS posture (the Postgres role name in policy DDL is not a credential). **Not a finding.**
- `docs/env-vars.md` — env var name documentation, no values. **Not a finding.**
- `docs/security-report.md` (prior audit) — references the names only. **Not a finding.**
- `.env.local` (gitignored at `.gitignore:5-6`) — contains a real `SUPABASE_SERVICE_ROLE_KEY` JWT; this is the canonical place. Confirmed absent from `git log --name-only`. **Clean.**
- No `sk_` Stripe-shaped keys in tracked files. **Clean.**

**2. `console.log` of objects containing `email`:**

Zero `console.log` / `console.info` / `console.warn` / `console.debug` calls anywhere in `.ts` / `.tsx` outside `node_modules`. All logging uses `console.error` with structured payloads scrubbed per SEC-05. Tests at `tests/auth.test.ts:99-100`, `tests/auth.test.ts:117-118`, and `tests/admin-auth-callback.test.ts:97-98` assert raw emails do not appear in log output. **Clean.**

**3. `dangerouslySetInnerHTML` in admin:**

Two matches:
- `lib/markdown.ts:18` — JSDoc text only.
- `components/public/MarkdownContent.tsx:27` — public-site, DOMPurify-sanitized.

No matches under `app/(admin)/**` or `components/admin/**`. **Clean for admin.**

**4. Unvalidated redirect targets:**

- `app/(admin)/admin/login/page.tsx:14` — `redirect('/admin')` literal. Safe.
- `app/(admin)/admin/auth/callback/route.ts:76, 82, 92, 131, 135, 142, 146, 150` — all use `buildRedirect(request, CONSTANT)` with `new URL(path, request.url)` where `path` is `FAILURE_REDIRECT` or `SUCCESS_REDIRECT` (hardcoded). Host-header tampering only redirects within the attacker's claimed origin. No `searchParams.get('next')` or `?redirectTo=` anywhere. **Clean.**

**5. `process.env.NEXT_PUBLIC_*` references:**

- `lib/supabase.ts:37, 38, 69, 70` — Supabase URL + anon key. Non-secret. Safe.
- `lib/auth-internal.ts:70, 72, 77` — `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_VERCEL_URL`. Public configuration. Safe.
- `lib/env.ts:2, 3` — string literals in the required-vars list. Safe.
- `components/public/pages/Home.tsx:175`, `components/public/mobile/pages/Home.tsx:161` — `NEXT_PUBLIC_TWEAKS`. Feature flag. Safe.
- `tests/auth.test.ts`, `tests/auth-cookies.test.ts`, `tests/env.test.ts` — test setup. Safe.

**Clean. No `NEXT_PUBLIC_` secret exposure.**

**6. `ADMIN_ALLOWED_EMAIL` references — server-only:**

- `lib/env.ts:8, 41, 44` — read inside `getAdminAllowedEmail()`, server-only module. **Correct.**
- `lib/auth-internal.ts:3, 35` — used inside the non-`'use server'` helper module (still server-only — only imported by the `'use server'` wrapper, which itself runs server-side). **Correct.**
- `tests/auth.test.ts:37, 45, 134`, `tests/auth-cookies.test.ts:66, 75`, `tests/admin-auth-callback.test.ts:46, 53` — test setup (server-side Vitest). **Correct.**
- `app/(admin)/admin/auth/callback/route.ts:53` (jsdoc) — name reference. **Correct.**
- `.env.example:22` — declared without `NEXT_PUBLIC_` prefix; comment says "Never NEXT_PUBLIC_". **Correct.**

Cross-check: no `'use client'` file imports `@/lib/env` or `@/lib/auth-internal`. The only `'use client'` admin file is `components/admin/LoginForm.tsx`, which imports `@/lib/auth` — the single-export `'use server'` module. Next.js boundary means only the RPC stub for `signInWithMagicLink` ships to the client, not the env-reading bodies of either `lib/auth-internal.ts` or `lib/env.ts`. **Clean.**

**7. `'use server'` file inventory (primary check for this audit):**

Project-wide search for `'use server'` directives at file-top:
- **`lib/auth.ts:1`** — file-level `'use server'`. Exports:
  - `signInWithMagicLink` (line 55) — Server Action ID `4022f0de80ca96a1401369508fbda9577f368adadf` per `.next/server/server-reference-manifest.json`. Sole public entry point.

Other files containing the string `'use server'` (verified all are JSDoc references, not directives):
- `lib/auth-internal.ts:7, 8, 94, 95` — JSDoc explaining the deliberate absence of the directive.
- `lib/auth.ts:19, 24, 25` — JSDoc cross-referencing F-14.
- `docs/auth-flow.md:51` — spec text.
- `docs/security-report.md` (prior audits + this one) — historical narrative.
- `docs/plan-phase-2-admin.md:108, 110` — plan text.

No double-quoted `"use server"` anywhere outside `docs/`. No function-level `'use server'` annotations.

**`'use server'` inventory total: 1 file, 1 Server Action endpoint. Matches SEC-08 and `docs/auth-flow.md` §2a point 4.**

**SEC-07 sensitive-file scan:**
- `.gitignore` covers `.env`, `.env*` (excludes `.env.example`), `docs/testing-setup.md`, `docs/session-log.md`, `docs/session-handoff.md`, `docs/framework-issues.md`, `profile.md`, `content/`, `CLAUDE.md`, `manifest.md`. No SEC-07 files in `git log --name-only`.
- **Clean.**

---

## Test Suite Status

Ran `npx vitest run tests/auth.test.ts tests/auth-cookies.test.ts tests/admin-auth-callback.test.ts tests/LoginForm.test.tsx` — **26 of 26 tests pass**:

- `tests/auth.test.ts` — 12 tests pass (7 internal-helper, 5 wrapper). The wrapper tests each run ~760ms, demonstrating the constant-time floor activates uniformly across allowlisted, not-allowlisted, malformed, and Supabase-failure outcomes.
- `tests/auth-cookies.test.ts` — 4 tests pass. Each runs ~760ms. Confirms `flowType: 'implicit'` is wired AND no `*-code-verifier` cookie is written on any branch.
- `tests/admin-auth-callback.test.ts` — 6 tests pass. The defense-in-depth allowlist still gates both the `?token_hash=` and `?code=` branches.
- `tests/LoginForm.test.tsx` — 4 tests pass. UI message is uniform across outcomes (F-2).

---

## Carry-forward Re-evaluation

| Prior finding | Audit-3 severity | Audit-4 verdict | Notes |
|---|---|---|---|
| F-1 | Resolved | Resolved | unchanged. |
| F-2 | Partially | Resolved | UI uniform; wire-level + cookie channels now also uniform via F-14 + F-15 fixes. |
| F-12 | Partially | **Resolved** | Wrapper closes timing channel via the only callable endpoint. |
| F-13 | Partially | **Resolved** | Body shape uniform; cookie channel also uniform via F-15. |
| F-14 | **Critical** | **Resolved** | Single action ID in manifest. Prior helper action ID has zero hits in `.next/`. |
| F-15 | **Medium** | **Resolved** | `flowType: 'implicit'` wired and verified by dedicated test. |
| F-3 | Medium | Unchanged | No length cap; scheduled for Phase 2 hardening. |
| F-4 | Medium | Unchanged | OTP type set still wide; defense-in-depth bounds blast radius. |
| F-5 | Medium | Unchanged | T18 sequencing. |
| F-6–F-11 | Low | Unchanged | Phase 4 launch-prep items. F-11 stays Low (audit-3 escalation contingency no longer applies). |

---

## Recommendations

**Safe to proceed:**

- T17 is complete and safe to mark done. The magic-link flow's wire-observable behavior is uniform across all six channels enumerated in `docs/auth-flow.md` §2a (UI text, body shape, timing, action surface, headers, status code). The Critical and the new Medium from audit 3 are both fully closed.
- **Proceed to T18** (admin middleware) without further blocking. T18 will resolve F-5 (the carry-forward Medium for `/admin/*` being unprotected).

**Fix during Phase 2 (medium hardening, non-blocking):**

1. **F-3** — `.max(254)` on `lib/auth-internal.ts:20` and `components/admin/LoginForm.tsx:21`.
2. **F-4** — narrow `VALID_EMAIL_OTP_TYPES` in `app/(admin)/admin/auth/callback/route.ts:16-23` to `new Set(['email', 'magiclink'])`; replace the unsafe cast with `EmailOtpType` from `@supabase/supabase-js`.

**Track for Phase 4 launch prep (low, deferred):**

3-8. F-6 (CSP), F-7 (dompurify types), F-8 (caret pins / `npm ci`), F-9 (XSS regression tests on the public Markdown sanitizer), F-10 (cookie-flag explicit assertions), F-11 (app-level rate limit on `signInWithMagicLink`).

**Documentation hygiene (small, do whenever):**

- Add to `docs/architecture.md` §6.4 the SEC-08 invariant: "Every export of a `'use server'` module is a public Server Action. Verify after each build that `.next/server/server-reference-manifest.json` lists only intended action IDs." This locks in the lesson from the audit-1-through-audit-4 loop so future contributors don't repeat the F-14 pattern.
- Note that the `?code=` branch in `app/(admin)/admin/auth/callback/route.ts:138-147` is intentionally dead under the current implicit-flow / magic-link-only model; retained for future OAuth. The route-handler comments already say this — no action needed.

**Monitor after launch:**

- Supabase auth logs for unexpected `verifyOtp` failure spikes.
- If a future contributor adds a second `export` to `lib/auth.ts`, treat it as a new Server Action and audit immediately. The build-output check is: `.next/server/server-reference-manifest.json` should list exactly the expected number of action IDs, no more.

---

**Summary:** 0 Critical / 0 High / 3 Medium (F-3, F-4, F-5) / 6 Low (F-6 through F-11).
**Verdict:** **CLEAR.** The audit loop is closed. The F-14 + F-15 fix correctly addresses the audit-3 BLOCKED findings, no regressions were introduced, and no new findings surfaced. T17 ships.
