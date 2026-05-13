# Security Report — T19.2 Playwright Auth Fixture + Back-Button E2E + F-19 Cookie-Jar Assertion

**Date:** 2026-05-12 (audit 7 — T19.2 pass)
**Auditor:** @security (session 14, audit pass 7)
**Scope:** T19.2 production-and-test surface:
  - `app/api/test/sign-in/route.ts` (NEW — triple-gated fixture Route Handler)
  - `tests/e2e/fixtures/auth.ts` (NEW — Playwright `loginAsAdmin` helper)
  - `tests/e2e/admin-logout.spec.ts` (MODIFIED — `.fixme` markers removed, F-19 cookie-jar assertion added)
  - `scripts/seed-test-fixture.ts` (NEW — CLI to provision fixture user)
  - `playwright.config.ts` (MODIFIED — `.env.local` parser + `webServer.env` block adding `NODE_ENV=test`, `TEST_FIXTURE_SECRET`, `TEST_FIXTURE_EMAIL`)
  - `.env.example` (MODIFIED — added `TEST_FIXTURE_SECRET`, `TEST_FIXTURE_EMAIL`)

  Adjacent files verified intact: `lib/auth.ts` (allowlist still 2 IDs), `lib/supabase.ts` (`flowType: 'implicit'` still locked per CONSTRAINT-18), `middleware.ts` (`api` excluded by matcher), `next.config.ts` (`assertRequiredEnv` unchanged), `.gitignore` (`.env*` exempting `.env.example`, SEC-07 protections intact).

  Build invariant re-verified: `npm run build` regenerated `.next/server/server-reference-manifest.json` with exactly two action IDs (`signInWithMagicLink`, `signOut`); `npx vitest run tests/server-actions-manifest.test.ts` passes.

**Status:** CLEAR
**Supersedes:** audit 6 CLEAR report (T19 first pass).

---

## Verdict

T19.2 ships. The triple-gated fixture route is correctly engineered for production safety:

1. **NODE_ENV bracket-indirection verified at the bundle level.** The route reads `process.env[NODE_ENV_KEY]` (where `NODE_ENV_KEY = 'NODE_ENV'`). Inspection of `.next/server/app/api/test/sign-in/route.js` confirms the indirection survives Next 15.5 / SWC compilation — the production bundle contains the literal `let y="NODE_ENV"; ... process.env[y]`. Next did NOT inline the value to `"production"`, so the gate fires at runtime in production and returns 404. The doc-block on `NODE_ENV_KEY` clearly warns against "simplifying" the read back to `process.env.NODE_ENV` (which WOULD be inlined and break the gate).
2. **Service-role key is not at module scope.** `SUPABASE_SERVICE_ROLE_KEY` is read inside `mintFixtureSession`, which is invoked only after both env-environment gates and the secret-header gate pass. The bundle confirms `process.env.SUPABASE_SERVICE_ROLE_KEY` remains as a dynamic lookup (not inlined; not present in client `.next/static/chunks/*`). The route file has no `'use client'`. The `scripts/seed-test-fixture.ts` script that also reads the key is not imported by `app/`, `components/`, `lib/`, or `middleware.ts` — it is never bundled.
3. **Three independent gates in defense-in-depth.** Production deployments fail all three:
    - Vercel runtime sets `NODE_ENV=production` → gate 1 returns 404 immediately.
    - Vercel injects `VERCEL=1` → gate 2 would also reject if NODE_ENV were spoofed.
    - `TEST_FIXTURE_SECRET` is documented as "never set in Vercel" → gate 3 rejects with `timingSafeEqual` on a zero-length expected (length-mismatch fast-path).
4. **SEC-09 allowlist is unaffected.** The fixture route is a Route Handler (`app/api/test/sign-in/route.ts`, `export async function POST`). It is NOT exported from a `'use server'` module and does NOT appear in `.next/server/server-reference-manifest.json`. The manifest still lists exactly two action IDs (`signInWithMagicLink` → `406f1b2acd...`; `signOut` → `0034145551...`). `tests/server-actions-manifest.test.ts` passes.
5. **F-19 closed.** `tests/e2e/admin-logout.spec.ts` asserts via `context.cookies()` that no Supabase session cookies remain after sign-out → redirect resolves. The assertion runs after `await expect(page).toHaveURL(LOGIN_URL_RE)`, so there is no race condition — the Set-Cookie header clearing the session has applied by the time `context.cookies()` is read.
6. **SEC-07 intact.** `.env.local` exists locally and is gitignored (verified via `git check-ignore -v .env.local` → matched by `.gitignore:6:.env*`). No SEC-07 files are staged, untracked-without-coverage, or appear in `git log --name-only` recent commits. `TEST_FIXTURE_SECRET` is documented in `.env.example` with a generation hint (`openssl rand -hex 32`) and a "never set in Vercel" caution.

Two **new Low findings** are recorded: F-23 (length-oracle in `assertFixtureSecret` — irrelevant to threat model; defense-in-depth fully absorbs it), and F-24 (F-19 cookie regex misses chunked variants and a non-existent refresh-token cookie — false-negative ceiling on the assertion, not a production-code issue). F-20 (Medium, from audit 6) is **partially closed** by T19.1 shipping `tests/server-actions-manifest.test.ts`; the JSDoc wording in `lib/auth.ts` still reads "to be enforced by [...] per plan task T19.1" — superseded to Low (F-20 doc polish). All other carry-forward findings (F-3, F-4, F-6 through F-11, F-21, F-22) are unchanged in severity and status by T19.2.

---

## Resolved Findings

**F-19 (Medium → Resolved by T19.2):** Cookie-jar empty-state after `signOut` is now asserted end-to-end by `tests/e2e/admin-logout.spec.ts` at line 55-61, using Playwright's `context.cookies()` after the redirect has resolved. The assertion confirms no cookie matching `^sb-.*-auth-token$` remains. Caveat: the regex does not match chunked variants nor a (non-existent) refresh-token cookie — see F-24 for the precision gap. The finding's *intent* (catch a regression where `setAll` no-ops on signOut) is met because the unchunked case is the production reality with implicit-flow tokens and the regression would surface as a still-present `sb-<ref>-auth-token` cookie.

Historical record (preserved across audits — see prior reports for full text):
- **F-5 (Medium, T18):** middleware admin gate. Still intact.
- **F-12, F-13 (High, Medium, T17):** timing oracle and wire-shape distinguishability on the magic-link send. Still mitigated.
- **F-14 (Critical, T17):** secondary action-ID via co-located helper. Still mitigated (manifest test passes with 2 IDs).
- **F-15 (Medium, T17):** PKCE verifier cookie distinguishing outcomes. Still mitigated via `flowType: 'implicit'` (CONSTRAINT-18); `lib/supabase.ts:41` confirmed unchanged.
- **F-16, F-17, F-18 (Low, T18):** sub-path exemption tightening, per-handler gate convention doc, exemption-boundary test coverage. All still intact.

---

## Findings (post-T19.2)

### Critical

None.

### High

None.

### Medium

None.

### Low

---

**F-23: Length pre-check in `assertFixtureSecret` is a length oracle (irrelevant to threat model)**

- **Severity:** Low
- **Rule violated:** SEC-09 (response-timing channel uniformity) — informational only.
- **Where:** `app/api/test/sign-in/route.ts:114` — `if (provided.length !== expected.length) return 404`. The length-mismatch path skips both `Buffer.from(...)` allocations and the `timingSafeEqual` call, so its response time is observably faster than the same-length-wrong-secret path.
- **Threat:** An attacker probing the route with various header lengths could in principle infer the byte length of `TEST_FIXTURE_SECRET`. BUT — this is only reachable when `NODE_ENV === 'test'` AND `VERCEL !== '1'`, i.e., on a local-dev or CI runner. In production, gate 1 (`NODE_ENV !== 'test'`) returns 404 with no length comparison performed at all. The threat surface is "an attacker who already has shell access to the CI runner" — a class of attacker who can read `.env.local` directly.
- **Mitigation status:** mitigated by the gate ordering. Production response timing is uniform (gate 1 alone). Documenting as a known-and-accepted property.
- **Recommended fix:** None required. Optional doc-polish: add one line to the JSDoc on `assertFixtureSecret` noting "length-mismatch fast-path is intentional — irrelevant in production where gate 1 rejects before reaching here." Trivial.
- **Effort:** trivial (or skip).

---

**F-24: F-19 cookie-jar regex misses chunked variants and a non-existent refresh-token cookie**

- **Severity:** Low
- **Rule violated:** test-precision gap — not a SEC rule.
- **Where:** `tests/e2e/admin-logout.spec.ts:33-34`. Two regex patterns:
  - `SUPABASE_AUTH_COOKIE_RE = /^sb-.*-auth-token$/` matches `sb-<ref>-auth-token` exactly but does NOT match chunked variants `sb-<ref>-auth-token.0`, `.1`, ... that `@supabase/ssr` emits when the encoded session payload exceeds 3180 bytes (see `node_modules/@supabase/ssr/dist/main/utils/chunker.js:8`).
  - `SUPABASE_REFRESH_COOKIE_RE = /^sb-.*-refresh-token$/` matches no cookie name that current `@supabase/ssr` actually writes. Current Supabase SSR stores access-and-refresh together under the single `sb-<ref>-auth-token` storage key — there is no separate refresh-token cookie. (The cookie names in the docstring on lines 31-33 reference a stable Supabase API, but the project's current `@supabase/ssr` version does NOT split the cookies.)
- **Threat:** False-negative ceiling on the assertion. If a future regression causes only the chunked variants (`.1`+) to remain after sign-out but the un-chunked base name is correctly cleared, the assertion would pass while leaking a partial session. The current threat is bounded — Supabase SDK currently always emits the unchunked base name as the first cookie name when chunking is unnecessary, and clears all chunks together via `deleteChunks` in `signOut()` — so the regression surface is "Supabase SDK introduces a chunking-only path that doesn't include the base name on clear." That is hypothetical.
- **Mitigation status:** unmitigated, but low-impact. The current production reality (implicit-flow tokens ≤3180 bytes) fits in one un-chunked cookie, which the current regex catches correctly.
- **Recommended fix:** Tighten the regex to also match chunked variants and drop the unreachable refresh-token regex. One line:
  ```ts
  const SUPABASE_AUTH_COOKIE_RE = /^sb-.*-auth-token(\.[0-9]+)?$/;
  // drop SUPABASE_REFRESH_COOKIE_RE; update filter to use only the one regex
  ```
  Optionally also assert no `sb-` cookies at all remain (`/^sb-/`), which is the broadest safety net.
- **Effort:** trivial.

---

**F-20: SEC-09 allowlist enforcement test now exists — JSDoc wording in `lib/auth.ts` is stale (superseded from Medium to Low)**

- **Severity:** Low (was Medium in audit 6)
- **Rule violated:** DS-01 — documentation must reflect current state.
- **Where:** `lib/auth.ts:20` JSDoc reads: `the SEC-09 allowlist (to be enforced by `tests/server-actions-manifest.test.ts` per plan task T19.1) is the union of one ID per flow.` T19.1 shipped — the named test now exists at `tests/server-actions-manifest.test.ts` and passes. The "to be enforced by [...] per plan task T19.1" wording is no longer accurate; it should read "enforced by `tests/server-actions-manifest.test.ts`."
- **Threat:** Aspirational/stale wording in production-code JSDoc. A future contributor might re-introduce the original "test does not exist" confusion that audit 6 flagged. The automated gate IS in place; the doc is just lagging.
- **Mitigation status:** functionally mitigated by T19.1 shipping. Doc-only gap.
- **Recommended fix:** Replace `(to be enforced by `tests/server-actions-manifest.test.ts` per plan task T19.1)` with `(enforced by `tests/server-actions-manifest.test.ts`)`. Trivial.
- **Effort:** trivial.

---

**F-3 (Medium, carry-forward, unchanged):** Zod email schema has no length cap. `lib/auth-internal.ts:20`. Recommended `z.string().min(3).max(254).email()`. Not addressed by T19.2; not regressed by T19.2.

---

**F-4 (Medium, carry-forward, unchanged):** Callback handler accepts overly wide OTP type set. `app/(admin)/admin/auth/callback/route.ts`. Recommended narrow to `new Set(['email', 'magiclink'])`. Not addressed by T19.2; not regressed.

---

**F-21, F-22 (Low, carry-forward, unchanged):** `next.config.ts` CSRF-posture comment + Server Action IDs documented as non-secret. Both still recommended doc-polish; T19.2 has no effect on them.

---

**F-6 through F-11 (Low, carry-forward, unchanged from audit 5):**

- **F-6:** No CSP — defer to Phase 4 launch prep.
- **F-7:** `@types/dompurify@3.0.5` stale.
- **F-8:** Caret pins on `marked` and `dompurify` — mitigated by `package-lock.json`.
- **F-9:** XSS regression test gap on the public Markdown sanitizer.
- **F-10:** Cookie hardening implicit (relies on `@supabase/ssr` defaults).
- **F-11:** No app-level rate limit on `signInWithMagicLink`.

See audit 5 for full text. None affected by T19.2 (the fixture route uses the service-role key directly, so app-level rate limits are irrelevant for it; CSP is unaffected; the new code does not touch markdown sanitization or cookie config).

---

## Build invariant — T19.2

Post-`npm run build` (2026-05-12, audit 7 re-verify):

- `.next/server/server-reference-manifest.json` lists exactly TWO action IDs:
  - `406f1b2acd793c144567457943dc9cafa48d09501a` → `signInWithMagicLink`
  - `0034145551c16de429added00b69a97d379a3c909b` → `signOut`
  Edge map empty. (Action IDs are hashed function references — they rotated since audit 6 because `lib/auth.ts` was last touched between T17 and now; the COUNT of 2 is the SEC-09 invariant, not the specific hashes.)
- `/api/test/sign-in` appears in the route listing as a dynamic (ƒ) Route Handler with 127 B size — confirms the route is server-only (no client component bytes).
- Inspection of `.next/server/app/api/test/sign-in/route.js`:
  - `let y="NODE_ENV"` and `process.env[y]` both present — bracket-indirection preserved through bundling (Next 15 / SWC did NOT inline). Gate 1 is live.
  - `process.env.SUPABASE_SERVICE_ROLE_KEY` present as a dynamic read — not inlined.
  - `TEST_FIXTURE_SECRET` and `TEST_FIXTURE_EMAIL` present only as dynamic `process.env.X` reads — not inlined.
- `grep -c "TEST_FIXTURE_SECRET" .next/static/ -r` → 0 occurrences in every client bundle. No secret name leakage to the browser.
- `npx vitest run tests/server-actions-manifest.test.ts` → 1 test passed; manifest exports `{signInWithMagicLink, signOut}` matches allowlist exactly.

---

## SEC-07 sensitive-file exposure check

- `.env.local` exists locally and is matched by `.gitignore` rule `.env*` (with `!.env.example` exception). `git check-ignore -v .env.local` confirms.
- `git status` shows no SEC-07 files staged, no SEC-07 files untracked-without-gitignore coverage.
- `git log --name-only -10` shows zero SEC-07 files in recent commits.
- `TEST_FIXTURE_SECRET` is documented in `.env.example` with no real value (placeholder `=`). The example file carries the generation hint and "never set in Vercel" caution.
- Recommendation for CI: when setting up CI (GitHub Actions, etc.), store `TEST_FIXTURE_SECRET` as a GitHub Actions Secret. Never echo it in workflow logs. Out-of-scope for this audit; flagging as a pre-Phase-4 reminder.

**SEC-07 verdict:** pass.

---

## Summary Table

| Severity | Count | F-codes |
|---|---|---|
| Critical | 0 | — |
| High | 0 | — |
| Medium | 0 | — |
| Low | 9 | F-3, F-4, F-6, F-7, F-8, F-9, F-10, F-11, F-20, F-21, F-22, F-23, F-24 |

(F-3 and F-4 remain at Medium severity per audit 5; not blocking. All other items at Low.)

**Corrected Summary:** 0 Critical / 0 High / 2 Medium / 11 Low

**Verdict:** CLEAR — no Critical or High findings. T19.2 ships. F-19 is closed (with a noted precision gap captured as F-24 Low). F-20 is partially closed and demoted from Medium to Low (doc-wording only). Two new Low findings (F-23, F-24) are recorded.
