# Plan — Phase 2: Admin Panel

**Date:** 2026-05-06
**Status:** Pending
**Tasks:** T15–T28 (14 tasks)
**Predecessor:** [`plan-phase-1-foundation.md`](plan-phase-1-foundation.md)
**Successor:** [`plan-phase-3-ingestion.md`](plan-phase-3-ingestion.md)

End state: admin can log in via magic link, do full CRUD on projects and posts (with confirm-modal hard-delete), view + manually insert stats, upload images with required alt text, and run orphan cleanup. All admin work is server-side; Tailwind/shadcn is scoped to `/admin/*` only. No programmatic write path yet (that is Phase 3).

---

## T15 — Admin layout + Tailwind/shadcn scoped CSS

**Files:**
- `app/(admin)/layout.tsx` (modify — add Tailwind/shadcn import via admin.css)
- `styles/admin.css` (create — `@tailwind` directives, scoped reset)
- `tailwind.config.ts` (create — content glob limited to admin paths)
- `postcss.config.mjs` (create or update)
- `package.json` (update — add `tailwindcss`, `tailwindcss-scoped-preflight`, `autoprefixer`)

**Functions to implement:** [setup task]

**Acceptance criteria:**
- [x] Tailwind config `content` glob is exactly `./app/(admin)/**/*.{ts,tsx}`, `./components/admin/**/*.{ts,tsx}`, `./components/ui/**/*.{ts,tsx}`. Public paths excluded (CONSTRAINT-03).
- [x] `tailwindcss-scoped-preflight` plugin configured with `scopeOf: '.admin-root'`. Default Preflight is disabled.
- [x] `app/(admin)/layout.tsx` imports `styles/admin.css` and renders children inside `<div className="admin-root">` with the eight admin color tokens (`--admin-bg`, `--admin-surface`, `--admin-fg`, `--admin-accent`, `--admin-destructive`, `--admin-destructive-fg`, `--admin-border`, `--admin-muted-fg`) applied via CSS variables (CONSTRAINT-16, amended 2026-05-12).
- [x] Inter font loaded via `next/font` for admin only. Fraunces and JetBrains Mono are not used in admin (design-decisions.md).
- [x] Public pages have zero Tailwind utility classes — verified by grep (CONSTRAINT-03).
- [x] `npm run build` succeeds; bundle analysis confirms Tailwind CSS does not appear in public route output.

**Tests required:**
- `public route HTML contains no Tailwind utility classes` — Playwright fetch + assertion (TS-04).
- `admin route HTML contains Tailwind utility classes` — Playwright fetch + assertion (TS-01 happy).
- `public route style does not change after navigating from admin` — visit `/admin`, then `/projects`, verify computed styles match a baseline (TS-04).

**Depends on:** Phase 1 complete (specifically T14)

**Specialist:** `@cto`

**Status:** Complete in session 10 (2026-05-11). 35/35 Vitest unit tests pass; 12/12 Playwright tests pass (3 new T15 scope tests + 9 prior, no regressions). Build green: 5 routes, `/admin` at 123 B / 103 kB First Load JS. Tailwind v3.4.17 pinned (not v4) due to `tailwindcss-scoped-preflight` v4 adapter absence. Color tokens namespaced as `--admin-*` to prevent cascade collision with public `:root` vars. Admin stub at `app/(admin)/admin/page.tsx` (not `app/(admin)/page.tsx`) — route group parens are URL-stripped, so the latter collided with `app/page.tsx`.

---

## T16 — shadcn/ui install + admin component primitives [x]

**Files:**
- `components/ui/` (created by shadcn CLI)
- `components.json` (created by shadcn CLI)
- `components/admin/AdminButton.tsx` (create — wrapper enforcing voice rule)
- `components/admin/AdminToast.tsx` (create — `sonner`-based toast)

**Functions to implement:** [setup + thin wrappers]

**Acceptance criteria:**
- [x] shadcn initialized; the following components installed: `Button`, `Input`, `Label`, `Form`, `Table`, `Dialog`, `Select`, `Checkbox`, `Textarea`, `Badge`, `Sonner` (toast).
- [x] `components/ui/` files are not modified (they are generated). Customizations go through wrappers in `components/admin/`.
- [x] No emoji in any default label, placeholder, or button text used by the wrappers (CONSTRAINT-13).
- [x] No SaaS phrases anywhere — labels use direct nouns ("Save", "Delete", not "Save now", not "Powerful editor") (CONSTRAINT-13).
- [x] Button variants: default, destructive (red, used for delete confirmation), ghost.
- [x] Toast component is imported in `app/(admin)/layout.tsx`.

**Tests required:** [setup; visual verification covered by smoke test in T28]

**Depends on:** T15

**Specialist:** `@ui-swarnimbagre`

_Completed 2026-05-12. See session-log T16 entry. Known gap: shadcn token mapping (`bg-primary` → `--admin-accent`) deferred to T19 prerequisite — components compile but render colorless until tokens are wired._

---

## T17 — Magic-link login flow [x]

**Files:**
- `app/(admin)/admin/login/page.tsx` (create — URL `/admin/login`, CONSTRAINT-17)
- `app/(admin)/admin/auth/callback/route.ts` (create — Supabase Auth callback, URL `/admin/auth/callback`, CONSTRAINT-17)
- `lib/auth.ts` (create — auth helpers)
- `components/admin/LoginForm.tsx` (create)

**Functions to implement:**
- `signInWithMagicLink(email: string): Promise<void>` (≤50 lines, CQ-01) — calls `supabase.auth.signInWithOtp({ email })`. Validates email shape with zod (`z.string().email()`) (SEC-02). Throws `ValidationError` on bad input, `ServiceError` on Supabase failure (EH-05).
- `<LoginForm />` (≤200 lines, CQ-02) — shadcn Form component, single email field, submit button.

**Acceptance criteria:**
- [x] Email input validates as a non-empty email at the boundary before any Supabase call (SEC-02).
- [x] Errors are logged with context: `{ operation: 'signInWithMagicLink', emailProvided: true, error }` — never the raw email (SEC-05).
- [x] User-facing error is a generic "Could not send link" message (EH-04). Internal log has full Supabase error.
- [x] On success, a status message appears in-form (no toast — voice rule prefers inline feedback for an admin-of-one).
- [x] Auth callback route at `/admin/auth/callback` exchanges the code for a session via Supabase SSR helpers and redirects to `/admin` (CONSTRAINT-17).
- [x] All public function doc comments cover params, return, throws (DS-01).

**Tests required:**
- `signInWithMagicLink rejects invalid email` (TS-01 error, TS-04 auth critical).
- `signInWithMagicLink calls supabase.auth.signInWithOtp on valid input` (TS-01 happy, TS-03 mocks Supabase).
- `signInWithMagicLink throws ServiceError when Supabase fails` (TS-01 error 2 — auth requires 2 error tests, TS-01).
- `LoginForm displays error text on failure` (TS-01).
- `auth callback redirects to /admin on valid code` (TS-04).

**Depends on:** T9, T16

**Specialist:** `@supabase`

_Completed 2026-05-12. Created `lib/auth.ts` (Server Action `signInWithMagicLink` with zod boundary validation + scrubbed log), `components/admin/LoginForm.tsx` (shadcn Form, inline success/error states, no toast), `app/(admin)/admin/login/page.tsx` (Server Component, redirects authenticated users to `/admin`), `app/(admin)/admin/auth/callback/route.ts` (handles both `token_hash`+`type` magic-link payload via `verifyOtp` and the PKCE `?code=...` shape via `exchangeCodeForSession`; both failure paths log internally and redirect to `/admin/login?error=callback_failed`). Added `ValidationError` to `lib/errors.ts`. Vitest: 35 → 41 (6 new — 4 auth.test + 2 LoginForm.test); Playwright: 13 → 14 (1 new — admin-auth-callback.spec). `npm run build` and `tsc --noEmit` exit 0. Notable: dual callback shape support keeps door open for future OAuth without rework; `.env.example` now documents `NEXT_PUBLIC_SITE_URL` (used for `emailRedirectTo`); did NOT add `@testing-library/user-event` (test uses `fireEvent` + `act` from the existing `@testing-library/react` install)._

_F-1 + F-2 targeted fix applied 2026-05-12 (session 12, post `@security` BLOCKED). **F-1 (allowlist enforcement):** added `ADMIN_ALLOWED_EMAIL` env var (server-only, no `NEXT_PUBLIC_` prefix), surfaced via a new `getAdminAllowedEmail()` typed getter in `lib/env.ts` that throws on missing/empty (CONSTRAINT-09, SEC-04). `signInWithMagicLink` now calls an `assertAllowlistedEmail()` helper after zod boundary validation and before Supabase — case-insensitive trim compare, log payload preserved as `{ operation, emailProvided: true, error: 'not_allowlisted' }` so the raw rejected email never reaches the log (SEC-05). The Supabase `signInWithOtp` call now passes `shouldCreateUser: false` so a stale Layer-1 dashboard toggle cannot auto-provision a user. Defense-in-depth: the callback route at `app/(admin)/admin/auth/callback/route.ts` calls `supabase.auth.getUser()` after every successful `verifyOtp` / `exchangeCodeForSession`; if the authoritative user email is not allowlisted (or `getUser` returns no user) the session is invalidated via `signOut()` and the response redirects to the same generic `?error=callback_failed` shape — no distinct error code that would leak the reason. **F-2 (response uniformity):** collapsed `LoginForm.tsx` success and failure branches into a single terminal `submitted` state showing `"If that email is registered, check your inbox."` regardless of whether the server action resolved, rejected with `ValidationError`, or rejected with `ServiceError` — matching `auth-flow.md` §2 step 4 verbatim. Client-side zod format validation still surfaces inline (no enumeration risk — reveals email shape, not registration state). **Tests:** Vitest 41 → 52 (+3 in `auth.test.ts` for allowlist + missing-env + case-insensitive paths, +2 in `LoginForm.test.tsx` for enumeration-resistance and format-error coverage, +6 in new `tests/admin-auth-callback.test.ts` route-handler test file covering the callback's defense-in-depth allowlist path including PKCE and case-insensitive comparison). Playwright stays at 14: the defense-in-depth path requires mocking Supabase server-side calls (`verifyOtp`, `getUser`, `signOut`), which Playwright's network interception cannot reach — that test lives in Vitest where `createServerClient` can be mocked directly; the existing e2e bogus-payload test still covers the routing-layer contract. `npm run build` and `tsc --noEmit` exit 0._

_F-12 + F-13 targeted fix applied 2026-05-12 (re-audit pass, third architectural pass on T17 — initial impl → F-1+F-2 fix → F-12+F-13 fix). The F-1 fix introduced a single-probe timing oracle (non-allowlisted rejections short-circuited in microseconds while allowlisted calls awaited Supabase ~100-500ms — F-12 High) and the throw-vs-resolve split left the Server Action's wire shape distinguishable to a raw `fetch` consumer (F-13 Medium). Both are caused by the same architectural shape, so fixed together. Split `lib/auth.ts` into a throwing internal helper `attemptMagicLink` (carries the EH-05 typed-error contract for unit tests) and a non-throwing Server Action `signInWithMagicLink` that wraps it. The wrapper catches every internal throw without re-logging (a second `console.error` on the catch path would itself reopen a smaller timing channel — the inner helper has already logged with scrubbed payload), and a `try/finally` enforces a `MIN_DURATION_MS = 750` floor on the response time regardless of outcome via a Promise-wrapped `setTimeout`. Both paths flow through the `finally`, so the bound applies uniformly; the floor is conservative enough to swallow normal Supabase variance, and runs over (not truncated) if Supabase is unusually slow. Option A (export `attemptMagicLink` from the `'use server'` file) was used — the directive only requires every export to be an async function, and `attemptMagicLink` is async. Verified `npm run build` accepts the second export. **Tests:** Vitest 52 → 57 (+5 in `auth.test.ts`: 4 wire-shape uniformity tests asserting `signInWithMagicLink` resolves with `undefined` on the allowlisted success, non-allowlisted, malformed, and Supabase-fail paths, plus 1 timing test using `vi.useFakeTimers({ toFake: ['setTimeout', 'performance'] })` + `advanceTimersByTimeAsync` to assert the promise stays pending at `MIN_DURATION_MS - 1` and settles at `MIN_DURATION_MS` without burning real wall time; the 7 throw-shape tests retargeted from `signInWithMagicLink` onto `attemptMagicLink`, coverage preserved). `LoginForm.test.tsx` updated to mock the prop with `mockResolvedValue(undefined)` on the not-allowlisted and Supabase-fail paths since the Server Action no longer throws; the UI assertions remain unchanged. `tests/admin-auth-callback.test.ts` unchanged — the callback handler's contract did not change. Playwright stays at 14. `npm run build` and `tsc --noEmit` exit 0._

_F-14 + F-15 targeted fix applied 2026-05-12 (fourth architectural pass on T17 — initial impl → F-1+F-2 fix → F-12+F-13 fix → F-14+F-15 fix). **F-14 (Critical — Server Action surface):** the prior F-12+F-13 pass exported `attemptMagicLink` from the `'use server'` `lib/auth.ts` module, which Next.js promoted to a second publicly-addressable Server Action endpoint (action ID `4018515b...` registered in `.next/server/server-reference-manifest.json` and shipped in the client bundle). An attacker could `fetch` that action ID directly via a `Next-Action` header and bypass the wrapper's F-12 timing floor and F-13 wire-shape uniformity entirely. Fixed via option (b) from the audit-3 recommendation: moved `attemptMagicLink` plus the helpers it owns (`assertAllowlistedEmail`, `EMAIL_SCHEMA`, `SIGN_IN_OPERATION`, `getSiteUrl`) into a new `lib/auth-internal.ts` module without the `'use server'` directive. `lib/auth.ts` now imports the helper from that sibling module, retains the `'use server'` directive, and exports exactly one function — `signInWithMagicLink`. Post-build verification of `.next/server/server-reference-manifest.json` confirms a single action ID (`4022f0de...` → `signInWithMagicLink`); the helper's prior action ID is gone. The misleading doc comment claiming `attemptMagicLink` was "not callable from a client because the enclosing module is 'use server'" is replaced with an accurate explanation of the split-module design. **F-15 (Medium — cookie channel):** the default `@supabase/ssr` PKCE flow wrote a `*-code-verifier` Set-Cookie header on the allowlisted (call-Supabase) branch but not on the throw-and-skip branch, distinguishing the two at the HTTP-header level even with uniform body shape and uniform timing. Configured the request-scoped Supabase server client in `lib/supabase.ts` with `auth: { flowType: 'implicit' }` per the audit-3 recommendation; implicit flow does not emit the verifier cookie. The magic-link callback at `app/(admin)/admin/auth/callback/route.ts` consumes the `?token_hash=&type=` shape via `verifyOtp`, which is not PKCE-dependent — the production callback path is unaffected. The `?code=` branch becomes dead under the current magic-link-only model but is retained for the future-OAuth path documented in `docs/auth-flow.md`. **Tests:** Vitest 57 → 61 (+4 in a new `tests/auth-cookies.test.ts` file: asserts the SSR client construction options include `auth.flowType === 'implicit'` and that no `code-verifier`-named cookie is written on the allowlisted, not-allowlisted, or malformed-email paths; the auth-test import for `attemptMagicLink` was retargeted from `@/lib/auth` to `@/lib/auth-internal` and the existing 12 auth-test cases still pass). Playwright stays at 14. `npm run build` and `tsc --noEmit` exit 0. T17 has now had four architectural passes: initial implementation, F-1+F-2 (allowlist + UI uniformity), F-12+F-13 (timing floor + wire-shape uniformity), and F-14+F-15 (action surface reduction + cookie-channel close)._

---

## T18 — Auth middleware + session gating

**Files:**
- `middleware.ts` (modify — add admin auth gate alongside the UA detection from T10)
- `lib/auth.ts` (modify — add `getServerSession()` helper)

**Functions to implement:**
- `middleware(req: NextRequest): NextResponse` (≤50 lines, CQ-01) — UA detection for public routes (already present from T10) + session check for `/admin/*`.
- `getServerSession(): Promise<Session | null>` (≤50 lines, CQ-01) — reads session from Supabase cookie, server-side.

**Acceptance criteria:**
- [x] All `/admin/*` requests pass through the session check; no session → 307 redirect to `/admin/login` (SEC-04: enforce auth on every protected operation).
- [x] Public routes are not gated.
- [x] `/admin/login` itself is exempt — visiting it while signed in redirects to `/admin`.
- [x] Expired session → redirect to `/admin/login` with a generic message (EH-04). Internal log notes "session expired" (EH-02).
- [x] No hardcoded user IDs, emails, or roles (CQ-04). Session presence is the sole admin check (CONSTRAINT-09).
- [x] Enumeration resistance per `auth-flow.md` channel list (UI text, response body, timing, Server Action surface, headers). Outcomes (success, validation failure, not-allowlisted, transient error) must be indistinguishable across all six channels.

**Tests required:**
- `unauthenticated request to /admin redirects to /admin/login` (TS-04 access control critical).
- `authenticated request to /admin proceeds` (TS-01 happy).
- `request to /admin/login while signed in redirects to /admin` (TS-01).
- `expired session redirects with no detail leaked` (TS-04).

**Depends on:** T17

**Specialist:** `@supabase`, `@security`

_Completed 2026-05-12 (pre-`@security`). Created `lib/auth-constants.ts` (extracted shared `MIN_DURATION_MS = 750`), `lib/session.ts` (`getServerSession()`, non-`'use server'`, never throws, uses `getSession()` for local cookie read). Modified `lib/auth.ts` (now imports `MIN_DURATION_MS` from the new constants module; `signInWithMagicLink` body unchanged). Modified `middleware.ts` (added `runAdminGate`, `isGatedAdminPath`, `buildLoginRedirect`, `padToFloor`, `applyDeviceVariant` helpers; matcher updated to remove `admin` from negative lookahead so the gate runs on `/admin/*`; middleware is now async). Five deviations from literal spec, all consulted with `@supabase` + `@security`: (D1) `getServerSession` placed in new `lib/session.ts` not `lib/auth.ts` — adding any export to the `'use server'` module would regress the T17 F-14 hardening by creating a second public Server Action endpoint (a wire-level session probe); (D2) gate uses `getSession()` not `getUser()` to avoid a Supabase round-trip on every admin page load — forged cookies still fail at the next Supabase call; (D3) cookies left untouched uniformly across B/C/D outcomes — simpler invariant than uniformly clearing; (D4) all three redirect outcomes log internally (B `info` "no session", C `info` "session expired", D `error` "unexpected error") with `{ path }` only, no token/email leakage; (D5) no `?next=`/`?from=` query params on the redirect target — open-redirect surface + UI-text channel leak. Tests: Vitest 61 → 81 (+7 in new `tests/session.test.ts` covering happy path, error-result + log-without-leak, throw + log-without-leak, never-throws invariant, no-session quiet path, non-Error rejection path, and a token-leak guard; +13 in new `tests/middleware.test.ts` covering F1/F2/F4 functional, P1/P2/P3 public-route preservation including the `/admin/login` and `/admin/auth/callback` exemptions, S1–S6 six-channel uniformity across B/C/D outcomes for timing/body/status/Location/Set-Cookie/no-`?next=`-leak, and L1 logging-payload security guard against token-shaped or email-shaped strings). `npm test` exits 0; `tsc --noEmit` exits 0. **Gap (deferred to a Phase 2 follow-up):** spec test 3 (signed-in user hitting `/admin/login` redirects to `/admin`) is page-level behavior in `app/(admin)/admin/login/page.tsx`, not middleware scope; the runtime behavior already exists from T17 but no `tests/admin-login-page.test.tsx` covers it. Recommend a small follow-up to add (a) signed-in → 307 to `/admin`, (b) anonymous → renders LoginForm. **Build-manifest action-ID count verification** (post-build grep on `.next/server/server-reference-manifest.json` to confirm exactly one action ID = `signInWithMagicLink`, F-14 hardening intact) is deferred to the `@security` audit step._

---

## T19 — Admin home + nav

**Files:**
- `app/(admin)/admin/page.tsx` (replace stub — admin home)
- `components/admin/AdminNav.tsx` (create — nav with Projects, Posts, Stats, Images links + Logout button)

**Functions to implement:**
- `signOut(): Promise<void>` (≤50 lines, CQ-01) — Supabase signOut, clears session, redirects to `/admin/login`.

**Acceptance criteria:**
- [x] `/admin` renders only when authenticated (middleware enforces).
- [x] Nav includes links to `/admin/projects`, `/admin/posts`, `/admin/stats`, `/admin/images`, plus a Logout button.
- [x] Color tokens applied via namespaced --admin-* tokens (CONSTRAINT-16 amended 2026-05-12 — 8 tokens total). Implementation uses Tailwind utility classes (bg-background, text-foreground, bg-secondary, border-border, text-primary) which map to --admin-bg, --admin-fg, --admin-surface, --admin-border, --admin-accent via tailwind.config.ts.
- [x] No "Dashboard" label. The page is just titled "Admin" or empty (CONSTRAINT-13).
- [x] Logout calls `signOut()`, clears the cookie, redirects to `/admin/login`. Browser back button does not re-authenticate. [deferred to T19.2 — Playwright auth fixture missing; unit tests cover session-clear + redirect behavior]
- [x] Enumeration resistance per `auth-flow.md` channel list (UI text, response body, timing, Server Action surface, headers). Outcomes (success, validation failure, not-allowlisted, transient error) must be indistinguishable across all six channels.

**Tests required:**
- `admin home renders when authenticated` (TS-01).
- `signOut clears session and redirects` (TS-04 auth critical).
- `back button after logout does not restore session` (TS-04).

**Depends on:** T18

**Specialist:** `@ui-swarnimbagre`, `@supabase`

_Completed 2026-05-12. Implementation complete; `@security` audit pass 6 returned CLEAR (`docs/security-report.md`). Build invariant verified: post-`npm run build`, `.next/server/server-reference-manifest.json` lists exactly two action IDs (`signInWithMagicLink` + `signOut`), matching the SEC-09 amended-wording allowlist. Tests: 92/92 Vitest passing; `tsc --noEmit` clean; 2 Playwright tests scaffolded as `.fixme` pending T19.2 fixture. Findings tracked: F-19 absorbed by T19.2; F-20, F-21, F-22 documented for follow-up (no `@dev` action required pre-ship). New plan tasks created: T19.1 (SEC-09 build-invariant test), T19.2 (Playwright auth fixture + back-button e2e — now also closes F-19 cookie-jar assertion)._

---

## T19.1 — SEC-09 build-invariant test

**Files:**
- `tests/server-actions-manifest.test.ts` (create — post-build assertion)

**Functions to implement:**
- One test (`assertServerActionAllowlist`) that loads `.next/server/server-reference-manifest.json` after build and asserts the set of action IDs equals the allowlist `{ signInWithMagicLink, signOut }`. Fail loud with the full set diff if drift is detected.

**Acceptance criteria:**
- [x] Test runs against a fresh build artifact (either run `next build` in the test setup or assume the CI step has run it before tests).
- [x] Manifest read is robust to missing file (loud error with remediation hint).
- [x] Allowlist is a single source of truth in the test file (no magic IDs scattered).
- [x] Adding any new server action requires updating both `lib/auth.ts` and this test's allowlist — fail surfaces the link.

**Depends on:** T19 (must be merged first so signOut exists in the manifest)
**Why:** SEC-09 wording was amended on 2026-05-12 to "one ID per auth flow" but no test currently enforces the allowlist. This closes the policy-without-enforcement gap.
**Specialist:** none — straight Vitest/Node assertion.

_Completed 2026-05-12. The `assertServerActionAllowlist()` logic ships inline inside the `it()` block rather than as a named exported helper — functionally identical to the spec, no second call site exists to justify extraction, CQ-01 satisfied (block under 50 lines). `beforeAll` invokes `npm run build` with a `NODE_ENV=production` override so `.env.local` is loaded for the build step, then reads `.next/server/server-reference-manifest.json`; missing-manifest path throws loud with a remediation hint pointing at the build command. Allowlist is a single `const EXPECTED_ACTION_IDS = new Set(['signInWithMagicLink', 'signOut'])` declared at the top of the file — drift in either direction (extra or missing) fails with a full set diff in the assertion message. Post-build verification: manifest contains exactly the two expected action IDs and nothing else. Test passes 1/1; Vitest 92 → 93. This closes F-20 — the JSDoc reference in `lib/auth.ts:20` now points to an existing, enforcing test rather than a non-existent file._

---

## T19.2 — Playwright auth fixture + back-button e2e

**Files:**
- `tests/e2e/admin-logout.spec.ts` (existing file — remove the two `.fixme` markers)
- New auth-fixture mechanism. Choose between:
  - (b) NODE_ENV-gated `/api/test/sign-in` route — refuses to mount unless `NODE_ENV === 'test'` AND a fixture secret is present.
  - (c) CI-only Supabase project with a known test user and a Playwright globalSetup that drives the magic-link flow.

**Functions to implement:**
- The chosen auth-fixture mechanism.
- Implement `loginAsAdmin()` helper in the spec (currently throws).

**Acceptance criteria:**
- [x] After clicking "Sign out" from `/admin`, browser lands on `/admin/login`.
- [x] After clicking browser-back, URL is still `/admin/login` (middleware re-redirects).
- [x] Auth fixture cannot be invoked in production (env-gated AND build-stripped if possible).
- [x] No real Supabase keys land in the test file or fixture file.
- [x] After signOut → redirect, the browser cookie jar is empty for the Supabase session cookies (sb-*-auth-token, sb-*-refresh-token). Asserted via Playwright's `context.cookies()` snapshot. (F-19 closure)

**Depends on:** T19 (must be merged first so sign-out flow exists end-to-end)
**Why:** T19's TS-04 "back button after logout does not restore session" Playwright test was scaffolded as `.fixme` because no auth fixture exists in the project. Unit tests in `tests/signout.test.ts` cover session-clear + redirect behavior, but the browser-back behavior is verified only by middleware logic — a regression in middleware exemption logic would not be caught by unit tests alone. This test closes that gap.
**Specialist:** `@supabase` (for fixture-secret RLS exemption if option (b)), `@security` (for the env-gating audit).

_Completed 2026-05-12. Playwright 2/2 passing. `@supabase` consult locked option B: server-side `auth.admin.generateLink` + `verifyOtp`, no password stored anywhere, mirrors the production callback's `token_hash` shape. Test fixture user `playwright-fixture@test.swarnimbagre.com` lives on the unowned `test.swarnimbagre.com` subdomain (no DNS, no inbox, no collision risk) and is seeded once via `scripts/seed-test-fixture.ts`. The `/api/test/sign-in` route is triple-gated: NODE_ENV check (via bracket indirection `process.env[NODE_ENV_KEY]` to evade Next 15's compile-time inlining of `process.env.NODE_ENV`, which would have folded the guard into a constant `true` at build time) + explicit `VERCEL=1` refusal + `timingSafeEqual` comparison on the `x-fixture-secret` header. Any single gate alone refuses production traffic. F-19 closed by the cookie-jar assertion in the spec — filters `sb-*-auth-token` (and chunked variants) on the BrowserContext snapshot, asserts length zero post sign-out. `@security` audit 7 returned CLEAR: 0 Critical / 0 High / 2 Medium (F-3, F-4 unchanged) / 11 Low (F-19 superseded; F-20 demoted to Low; F-23 length-oracle accepted no-fix as irrelevant pre gate 1; F-24 cookie-regex precision bundled into this close). New devDep: `tsx@^4.19.0` for the seed script. Test baseline: Vitest 93 passing (unchanged from T19.1 close) + Playwright 14 → 16 (+2 from the un-`.fixme`'d TS-04 tests)._

---

## T20 — Projects admin: list view

**Files:**
- `app/(admin)/admin/projects/page.tsx` (create)
- `lib/admin-queries.ts` (create — admin-side reads)
- `components/admin/ProjectsList.tsx` (create)

**Functions to implement:**
- `getAllProjects(filter: ProjectFilter = 'all', page = 1, pageSize = 50, client?: SupabaseClient): Promise<{ rows: ProjectRow[]; total: number }>` (≤50 lines, CQ-01) — admin sees drafts and published. Default filter `'all'`. The optional `client` is a DI seam for tests (matches `lib/db.ts` convention).

**Acceptance criteria:**
- [x] Table columns: Title, Slug, Status, Created, Actions (Edit, Delete).
- [x] Status rendered as a Badge (shadcn): `published` accent, `draft` muted.
- [x] Filter via shadcn Select: All / Published / Draft.
- [x] Sort by `created_at DESC`.
- [x] Empty state: "No projects yet" (CONSTRAINT-13: terse, no decoration).
- [x] Pagination: shadcn Pagination, 50 rows per page.
- [x] All queries via Supabase query builder (SEC-03).
- [x] Doc comments on all public functions (DS-01).

**Tests required:**
- `getAllProjects returns drafts and published when filter is all` (TS-01 happy).
- `getAllProjects returns only drafts when filter is draft` (TS-01).
- `getAllProjects throws ServiceError when DB fails` (TS-01 error).

**Depends on:** T19

**Specialist:** `@supabase`

---

## T21 — Projects admin: create + edit forms

**Files:**
- `app/(admin)/admin/projects/new/page.tsx` (create)
- `app/(admin)/admin/projects/[id]/page.tsx` (create — edit)
- `components/admin/ProjectForm.tsx` (create)
- `lib/admin-mutations.ts` (create — Server Actions for writes)
- `lib/slug.ts` (create — slugify helper)

**Functions to implement:**
- `slugify(title: string): string` (≤50 lines, CQ-01) — lowercase, replace non-alphanumerics with `-`, collapse, trim.
- `createProject(input): Promise<Project>` (security/validation — may extend to 80 lines, CQ-01) — Server Action. Validates with zod (`title`, `description`, `status`) (SEC-02). Auto-generates `slug` from `title`. Returns the new row.
- `updateProject(id, input): Promise<Project>` (≤80 lines, CQ-01) — Server Action. Validates with zod. Slug field is omitted from the update payload if `status='published'` was set on the existing row (the DB trigger from T8 is the final guard).
- `<ProjectForm project?: Project>` (≤200 lines, CQ-02).

**Acceptance criteria:**
- [ ] Form validation at boundary: title non-empty + ≤200 chars; description non-empty (SEC-02).
- [ ] Slug field is read-only when `project.status === 'published'`. Edit screen shows the lock state explicitly.
- [ ] Mutations are Server Actions, not client-side Supabase calls (SEC-01: server-only).
- [ ] On success: redirect to `/admin/projects` with a success toast.
- [ ] On error: inline error in the form (EH-04). Internal log has full detail (EH-01, EH-02, EH-03).
- [ ] All queries parameterized via Supabase builder (SEC-03).
- [ ] No PII in logs (SEC-05). Email never appears in mutation logs.
- [ ] All Server Actions have doc comments (DS-01).
- [ ] Enumeration resistance per `auth-flow.md` channel list (UI text, response body, timing, Server Action surface, headers). Outcomes (success, validation failure, not-allowlisted, transient error) must be indistinguishable across all six channels.

**Tests required:**
- `slugify produces lowercase dashed slug` (TS-01 happy).
- `slugify handles unicode and punctuation` (TS-01 edge).
- `createProject validates title is non-empty` (TS-01 error, TS-04 data write critical).
- `createProject inserts row and returns it on valid input` (TS-01 happy, TS-04).
- `updateProject prevents slug change on published row` — relies on T8 trigger, asserts the error surfaces (TS-04, TS-01 error #2 for data writes).
- `ProjectForm shows error inline on mutation failure` (TS-01).

**Depends on:** T20, T8

**Specialist:** `@ui-swarnimbagre`, `@supabase`

---

## T22 — Projects admin: delete with confirm modal

**Files:**
- `components/admin/DeleteConfirmModal.tsx` (create — reusable)
- `app/(admin)/admin/projects/[id]/page.tsx` (modify — wire delete button)
- `lib/admin-mutations.ts` (modify — add `deleteProject`)

**Functions to implement:**
- `deleteProject(id: string): Promise<void>` (≤50 lines, CQ-01) — Server Action.
- `<DeleteConfirmModal resource: string, name: string, onConfirm: () => Promise<void>, isOpen, onOpenChange>` (≤200 lines, CQ-02) — shadcn Dialog with destructive button.

**Acceptance criteria:**
- [ ] Modal text: `Delete {resource} "{name}"? This cannot be undone.` (CONSTRAINT-10).
- [ ] Buttons: Cancel (close), Delete (destructive variant, red).
- [ ] On Delete: call mutation, close modal, redirect to list with success toast.
- [ ] Hard-delete only — row is gone from DB (CONSTRAINT-10).
- [ ] ESC key closes the modal (shadcn Dialog default).
- [ ] No undo path. Recovery is via Supabase backups — not an admin concern.
- [ ] Enumeration resistance per `auth-flow.md` channel list (UI text, response body, timing, Server Action surface, headers). Outcomes (success, validation failure, not-allowlisted, transient error) must be indistinguishable across all six channels.

**Tests required:**
- `modal opens on delete click` (TS-01).
- `cancel closes modal without deletion` (TS-01).
- `confirm deletes and redirects` (TS-04 data write critical).
- `deleteProject throws ServiceError on DB failure` (TS-01 error #2 for data writes).

**Depends on:** T21

**Specialist:** `@ui-swarnimbagre`

---

## T23 — Posts admin: list, create, edit, delete (same pattern as T20–T22)

**Files:**
- `app/(admin)/admin/posts/page.tsx`
- `app/(admin)/admin/posts/new/page.tsx`
- `app/(admin)/admin/posts/[id]/page.tsx`
- `components/admin/PostsList.tsx`
- `components/admin/PostForm.tsx`
- `lib/admin-queries.ts` (modify — add post queries)
- `lib/admin-mutations.ts` (modify — add post mutations)

**Functions to implement:**
- `getAllPosts(filter?: 'all' | 'published' | 'draft'): Promise<Post[]>` (CQ-01).
- `createPost(input): Promise<Post>` (CQ-01, ≤80 if validation-heavy).
- `updatePost(id, input): Promise<Post>` (CQ-01, ≤80).
- `deletePost(id): Promise<void>` (CQ-01).

**Acceptance criteria:**
- [ ] All Project rules apply identically (slug auto + lock-on-publish, hard-delete with confirm modal, status enum, server-side mutations).
- [ ] Form has a `content` textarea for raw Markdown. No WYSIWYG. The `content` is stored as-is — never converted to HTML before storage (CONSTRAINT-06).
- [ ] Optional Markdown preview pane uses the same `renderMarkdown` from T12. Preview confirms what readers will see.
- [ ] DB trigger from T8 enforces slug-lock on `posts` as well.
- [ ] Enumeration resistance per `auth-flow.md` channel list (UI text, response body, timing, Server Action surface, headers). Outcomes (success, validation failure, not-allowlisted, transient error) must be indistinguishable across all six channels.

**Tests required:**
- `getAllPosts returns drafts and published when filter is all` (TS-01).
- `createPost stores raw Markdown` — assert DB row's `content` matches input verbatim (TS-04 data write).
- `updatePost rejects slug change on published post` (TS-04).
- `deletePost removes the row` (TS-04).
- All happy-path + 1 error case per function (TS-01).

**Depends on:** T22

**Specialist:** `@ui-swarnimbagre`, `@supabase`

---

## T24 — Stats admin: read-only list + manual insert form

**Files:**
- `app/(admin)/admin/stats/page.tsx` (create)
- `components/admin/StatsList.tsx` (create)
- `components/admin/StatsInsertForm.tsx` (create)
- `lib/admin-queries.ts` (modify — add `getAllStats`)
- `lib/admin-mutations.ts` (modify — add `insertStat`)

**Functions to implement:**
- `getAllStats(limit: number, offset: number): Promise<Stat[]>` (≤50 lines, CQ-01).
- `insertStat(input: { category, label, value, unit? }): Promise<Stat>` (≤80 lines, CQ-01) — Server Action with zod validation (SEC-02).

**Acceptance criteria:**
- [ ] List columns: Category, Label, Value, Unit, Created. Reverse-chronological. Pagination 50/page.
- [ ] Manual insert form fields: Category (text), Label (text), Value (text), Unit (text, optional). All non-Unit fields required (SEC-02).
- [ ] Insert is a Server Action; no client-side write (SEC-01).
- [ ] Empty state: "No stats yet" (CONSTRAINT-13).
- [ ] No edit. Corrections are delete-then-reinsert (acknowledged in PRD §3.4 and CONSTRAINT-10).
- [ ] Delete: list rows expose a delete button gated by the same `DeleteConfirmModal` component from T22 (admin-only — RLS allows admin DELETE on stats).
- [ ] Enumeration resistance per `auth-flow.md` channel list (UI text, response body, timing, Server Action surface, headers). Outcomes (success, validation failure, not-allowlisted, transient error) must be indistinguishable across all six channels.

**Tests required:**
- `getAllStats returns rows in reverse-chronological order` (TS-01).
- `insertStat validates required fields` (TS-01 error, TS-04 data write critical).
- `insertStat inserts a row on valid input` (TS-01 happy, TS-04).
- `delete stat removes row after confirm` (TS-04).

**Depends on:** T23

**Specialist:** `@supabase`, `@ui-swarnimbagre`

---

## T25 — Image upload component + Storage integration

**Files:**
- `components/admin/ImageUpload.tsx` (create)
- `lib/admin-mutations.ts` (modify — add `uploadImage`)

**Functions to implement:**
- `uploadImage(file: File, parentType: 'projects' | 'posts', parentId: string, altText: string): Promise<Image>` (≤80 lines, CQ-01) — Server Action. Validates file type (JPEG, PNG, WebP, SVG) and size (≤2 MB) at the boundary (SEC-02). Generates a UUID. Constructs path `images/{parentType}/{parentId}/{uuid}_{filename}`. Uploads to Storage (server-only, service role) (SEC-01). Inserts the `images` row.
- `<ImageUpload onUpload, onError, parentType, parentId>` (≤200 lines, CQ-02).

**Acceptance criteria:**
- [ ] File type whitelist enforced at the boundary (SEC-02).
- [ ] File size ≤ 2 MB enforced at the boundary AND by Storage policy (SEC-02; defense in depth).
- [ ] `alt_text` is a required form field. Submit is disabled until non-empty.
- [ ] Path scheme is exactly `images/{parentType}/{parentId}/{uuid}_{filename}` (CONSTRAINT-07).
- [ ] On success: `images` row inserted with `bucket_path`, `alt_text`, `parent_id`, `parent_type`. Component calls `onUpload(image)`.
- [ ] On error: caught, logged with context (operation + sanitized inputs — never log file content) (EH-01, EH-02, EH-03). Component shows inline error (EH-04).
- [ ] Storage SDK used (no hardcoded URLs) (SEC-01, CQ-04).
- [ ] Doc comment on `uploadImage` lists params, return, throws (DS-01).
- [ ] Enumeration resistance per `auth-flow.md` channel list (UI text, response body, timing, Server Action surface, headers). Outcomes (success, validation failure, not-allowlisted, transient error) must be indistinguishable across all six channels.

**Tests required:**
- `uploadImage rejects file > 2MB` (TS-01 error, TS-04 data write critical).
- `uploadImage rejects empty alt text` (TS-01 error).
- `uploadImage rejects unknown MIME type` (TS-01 error).
- `uploadImage uploads file and inserts row on valid input` (TS-01 happy, TS-04).
- `uploadImage handles Storage failure with logged error` (TS-04 — file uploads require 2 error case tests since they touch storage and validation).

**Depends on:** T7, T21

**Specialist:** `@supabase`

---

## T26 — Wire image upload into Project + Post forms

**Files:**
- `app/(admin)/admin/projects/[id]/page.tsx` (modify)
- `app/(admin)/admin/posts/[id]/page.tsx` (modify)
- `components/admin/ProjectForm.tsx` (modify)
- `components/admin/PostForm.tsx` (modify)
- `lib/admin-mutations.ts` (modify — add image-detach helper if needed)

**Functions to implement:** [composition — wires existing components]

**Acceptance criteria:**
- [ ] Project edit page shows the current image thumbnail (if any) plus an `<ImageUpload>` to replace.
- [ ] Post edit page same as project.
- [ ] When a new image is uploaded, the parent's `image_id` is updated to the new image's id.
- [ ] The previous image record becomes orphaned (parent_id NULL, parent_type NULL) by the update — eligible for cleanup after 7 days (CONSTRAINT-07).
- [ ] Alt text persists on the `images` row; reading the parent re-fetches the alt and renders it in the public components from T13.
- [ ] No image is allowed to be saved with empty alt (UI prevents submit; DB column is NOT NULL).
- [ ] Enumeration resistance per `auth-flow.md` channel list (UI text, response body, timing, Server Action surface, headers). Outcomes (success, validation failure, not-allowlisted, transient error) must be indistinguishable across all six channels.

**Tests required:**
- `attaching an image updates parent.image_id` (TS-04).
- `replacing an image orphans the previous image row` (TS-04).
- `attempting to save with empty alt text fails at the form` (TS-01 error).

**Depends on:** T25

**Specialist:** `@ui-swarnimbagre`, `@supabase`

---

## T27 — Orphan image cleanup page

**Files:**
- `app/(admin)/admin/images/page.tsx` (create)
- `components/admin/OrphanCleanup.tsx` (create)
- `lib/admin-mutations.ts` (modify — add `deleteOrphanImages`)

**Functions to implement:**
- `deleteOrphanImages(): Promise<{ deleted: number, freedBytes: number }>` (≤80 lines, CQ-01) — Server Action. Selects orphans where `parent_id IS NULL AND parent_type IS NULL AND created_at < now() - interval '{ORPHAN_CLEANUP_THRESHOLD_DAYS} days'`. Deletes both Storage objects and `images` rows. Returns count and bytes freed.

**Acceptance criteria:**
- [ ] `ORPHAN_CLEANUP_THRESHOLD_DAYS = 7` is a named constant with a comment explaining the grace period (CQ-04).
- [ ] Page lists current orphans with bucket_path, created date, and size.
- [ ] "Clean orphans" button uses the same `DeleteConfirmModal` (resource: "orphaned images", count interpolated into the prompt).
- [ ] On success: shows "Deleted N images, freed ~M MB". Toast is fine here.
- [ ] On error: inline error, full log (EH-01, EH-02, EH-04).
- [ ] All deletes are parameterized (SEC-03).
- [ ] Enumeration resistance per `auth-flow.md` channel list (UI text, response body, timing, Server Action surface, headers). Outcomes (success, validation failure, not-allowlisted, transient error) must be indistinguishable across all six channels.

**Tests required:**
- `deleteOrphanImages deletes only rows older than 7 days` (TS-04 data write critical).
- `deleteOrphanImages does not delete recent orphans` (TS-01 error case for boundary).
- `deleteOrphanImages handles Storage failure with logged error` (TS-04 — touches Storage; 2 error tests).

**Depends on:** T25

**Specialist:** `@supabase`

---

## T28 — Admin smoke test (end-to-end)

**Files:** all admin files from T15–T27.

**Functions to implement:** [integration test]

**Acceptance criteria:**
- [ ] End-to-end Playwright flow:
  - Navigate to `/admin` while signed out → redirected to `/admin/login`.
  - Sign in via magic link (or pre-seeded session for the test).
  - Land on `/admin`.
  - Create a project → appears in list. Edit it → changes save. Publish it → slug becomes read-only. Delete it (confirm modal) → row removed.
  - Same flow for posts, including a post with raw Markdown that round-trips via the preview pane.
  - Stats: insert a manual stat → appears in list. Delete it → confirmed and removed.
  - Images: upload an image to a project (require alt text) → image attaches. Replace it → previous becomes orphan. Visit `/admin/images` → orphan listed.
  - Logout → back to `/admin/login`. Back button does not restore session.
- [ ] No console errors or warnings in any flow (CQ-05).
- [ ] No XSS reachable via title or alt text inputs (try `<script>` and `<img onerror>` — both render literally, no execution) (SEC-02 verified).
- [ ] Voice/UI rules pass: no SaaS phrases, no emoji in admin labels (CONSTRAINT-13).
- [ ] All admin Tailwind/shadcn styles stay inside `/admin/*` — visit `/projects` after admin work, verify computed style baseline unchanged (CONSTRAINT-03).

**Tests required:**
- The end-to-end Playwright suite above (TS-04: covers auth, data writes, access control).

**Depends on:** T27

**Specialist:** `@qa`

---

## Phase 2 Exit Criteria

- All 14 tasks complete; tests passing.
- Admin can do full CRUD on projects, posts, stats, and images locally + on the production deploy.
- No programmatic write path open yet (Phase 3).
- Mark Phase 2 row Done in [`plan-index.md`](plan-index.md). Mark Phase 3 row Active. Log transition in `docs/session-log.md`.
