# Auth Flow: swarnimbagre.com

**Date:** 2026-05-07 (originated as pre-T17 spec; reconciled to as-built at T38, 2026-05-15)
**Status:** As-built reference. T17 has shipped — the login page, callback route, and `/admin/*` middleware exist; §2–§4 describe what the code actually does, not a requirement against future work.

This document originated as the DS-02 specification for admin authentication on swarnimbagre.com — the architectural decision (magic-link, single user, no passwords) documented before the code was written. T17 has since shipped and this doc has been reconciled against the implementation (`lib/auth.ts`, `lib/auth-internal.ts`, `app/(admin)/admin/auth/callback/route.ts`, `middleware.ts`, `lib/supabase.ts`). The contract holds: this doc and the code agree.

Out of scope: public-site auth (there is none — all public reads are anon role + RLS), the OpenClaw write path (shared-secret Edge Function — see CONSTRAINT-04), and any future multi-user model (closed off by CONSTRAINT-09).

---

## 1. Auth Model Summary

- Magic-link only. No passwords are stored or accepted.
- Email provider only. No OAuth, no phone, no SAML (CONSTRAINT-09).
- Single allowed user: whatever `ADMIN_ALLOWED_EMAIL` is set to. The address is env-configured, not hardcoded, and deliberately not committed to the repo — see `lib/env.ts::getAdminAllowedEmail`.
- JWT expiry: 1 hour (Supabase default — no customization).
- Refresh expiry: 30 days inactivity (Supabase default — no customization).
- No "remember me" toggle. No role tiers. No password reset (no passwords to reset).
- No signup flow. The single user is created manually in the Supabase Auth dashboard. "Allow new users to sign up" is OFF.

---

## 2. Login Flow

1. User navigates to `/admin/login`.
2. The page renders a single-field form: email. The user enters the admin email.
3. The form submits to the `signInWithMagicLink` Server Action (`lib/auth.ts`, `'use server'`), which wraps the internal helper `attemptMagicLink` (`lib/auth-internal.ts`). The sign-in is server-side — there is no browser/client Supabase call on this path. The helper zod-validates the email, runs the allowlist check (`assertAllowlistedEmail`), then calls `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo, shouldCreateUser: false } })`. `emailRedirectTo` is built dynamically as `${getSiteUrl()}/admin/auth/callback`, where `getSiteUrl()` resolves `NEXT_PUBLIC_SITE_URL` first and falls back to a `https://`-prefixed `NEXT_PUBLIC_VERCEL_URL` — it is **not** a hardcoded host. `shouldCreateUser: false` is security-load-bearing: an unknown email cannot auto-provision an authenticated user even if the dashboard signup toggle is misconfigured (Layer 1, §3). On success Supabase sends a magic link to the inbox.
4. Regardless of whether the email matches the allowlisted address, the response must be uniform across all six observable channels enumerated in §2a (UI text, response body, response timing, Server Action surface, response headers, status code). This avoids leaking which addresses are valid (SEC-04 — defense against user enumeration). The literal UI text is a single template: "If an account exists for that address, a sign-in link has been sent." The other channels are not optional and not separable — see §2a.
5. User opens the email and clicks the magic link. The link points at `${getSiteUrl()}/admin/auth/callback?token_hash=...&type=email` (the origin is whatever `getSiteUrl()` resolved at send time, not a hardcoded host).
6. The `/admin/auth/callback` route handler supports two payload shapes. The production magic-link path is `?token_hash=...&type=email`, verified via `supabase.auth.verifyOtp({ token_hash, type })`. The handler also retains a live `?code=...` branch verified via `supabase.auth.exchangeCodeForSession(code)` — the PKCE shape — intentionally kept for a future OAuth path even though the current single-user magic-link model does not exercise it. Both branches, on success, run the `rejectIfNotAllowlisted` check (§3 Layer 2) before redirecting.
7. On success, `@supabase/ssr` persists the session via `httpOnly` cookies. The exact cookie names and attributes are managed internally by the SSR library and are not set explicitly by application code — modern `@supabase/ssr` uses a chunked `sb-<project-ref>-auth-token` cookie scheme rather than discrete `sb-access-token` / `sb-refresh-token` cookies. The `httpOnly`, `Secure`, `SameSite=Lax` behavior is library-managed, not asserted by app code.
8. The callback redirects to `/admin` (the dashboard home).
9. On every subsequent request to a gated `/admin/*` path, the Next.js middleware checks for a valid session via `getSession()`. No session or a `getSession()` error → redirect to `/admin/login`. The middleware does not compare the user email; that comparison already happened at steps 3 and 6 (§3 Layer 2).

---

## 2a. Uniform Observable Response — Channel Decomposition

**Property:** "Uniform observable response" means an attacker probing the auth endpoint cannot distinguish outcomes (registered email, non-registered email, format error, transient failure) by ANY observable channel. The six channels below are non-negotiable. Closing five and leaving one open leaves the enumeration oracle open.

1. **UI text channel.** The user-visible message is identical across outcomes. Use a single template: "If an account exists for that address, a sign-in link has been sent." Format errors (zod parse fail) are the only carve-out — they reveal email syntax, not registration state, so a distinct "enter a valid email" message is acceptable for that case.
   - *Verification:* Snapshot test on `LoginForm` asserting the success message is byte-identical for allowlisted, non-allowlisted, and transient-failure outcomes.

2. **Response body channel.** The wire-level Server Action response payload shape is identical across outcomes. The public Server Action returns `void`/`undefined` and never throws to the wire. Internal helpers that throw are wrapped in a `try/catch` that swallows the throw and resolves with `undefined`.
   - *Verification:* Test that asserts the raw `fetch` response body (React Flight frame) is byte-equal for an allowlisted call and a non-allowlisted call.

3. **Response timing channel.** Wall-clock response time has a constant-time floor: `MIN_DURATION_MS = 750`. Fast paths pad to the floor with `setTimeout` inside a `try/finally`. Slow paths run over the floor without truncation (this is a floor, not a ceiling — truncating slow paths would introduce a different oracle).
   - *Verification:* Test using fake timers (covering both `setTimeout` and `performance.now`) that asserts the wrapper resolves at ≥750ms for both the throw-internally and resolve-internally paths.

4. **Server Action surface channel.** Exactly one action ID per auth flow exists in `.next/server/server-reference-manifest.json`. Internal helpers — any function that throws or has outcome-dependent timing — live in a separate file WITHOUT `'use server'`, typically `lib/auth-internal.ts`, and are imported into the `'use server'` wrapper. Every `export` from a `'use server'` module becomes a publicly addressable Server Action endpoint; this is the Next.js semantics and is not configurable.
   - *Verification:* Build-output grep — `.next/server/server-reference-manifest.json` lists exactly one action ID for the login page, and `.next/static/chunks/app/(admin)/admin/login/page.js` contains exactly one action ID.

5. **Response headers channel.** `Set-Cookie` and all other response headers are identical across outcomes. The Supabase SSR client's default PKCE flow writes a `*-code-verifier` cookie on the call-Supabase branch but not on the throw-and-skip branch — set `auth: { flowType: 'implicit' }` at client construction so magic-link `signInWithOtp` does not emit the verifier cookie. `verifyOtp` with `token_hash` is not PKCE-dependent and continues to work.
   - *Verification:* Test that asserts the Server Action response's `Set-Cookie` header set is byte-equal for the throw path and the call-Supabase path.

6. **Status code channel.** HTTP status is identical across outcomes — typically 200 for the Server Action; Next.js handles the framing. Any error path that surfaces a non-200 status to the wire is a leak.
   - *Verification:* Test asserting `response.status === 200` for allowlisted, non-allowlisted, and transient-failure outcomes.

**Why this decomposition exists:** T17 surfaced F-1/F-2/F-12/F-13/F-14/F-15 over three `@security` audit rounds because the prior spec wording "shows the same generic response" was read as UI-text-only. Each round moved one architectural layer deeper — UI text, then timing, then wire body, then action surface, then response headers. Channels make the requirement enforceable: every channel has a named property and a named verification, and a fix is not complete until all six are verified.

---

## 3. Email Allowlist Enforcement

The auth provider does not by itself restrict which email addresses may sign in. Enforcement is layered. It does **not** live in the `/admin/*` middleware — the middleware checks session presence/validity only (see Layer 3). The email comparison happens at the sign-in helper (before the magic link is sent) and again at the callback route (after the session is established), so a non-allowlisted email never obtains a valid admin session.

| Layer | Where | What it does | Failure mode |
|---|---|---|---|
| 1. Operational | Supabase Auth dashboard | Exactly one user record exists, for the configured admin email. "Allow new users to sign up" is OFF, so an OTP request for a non-existent email does not auto-create an account. Reinforced in code: `attemptMagicLink` passes `shouldCreateUser: false` to `signInWithOtp`. | If "Allow new users" is ever flipped on, the `shouldCreateUser: false` flag still blocks auto-provisioning. Treat the dashboard setting as a config-level invariant regardless. |
| 2. Allowlist comparison | `lib/auth-internal.ts` (`assertAllowlistedEmail`, pre-send) and `app/(admin)/admin/auth/callback/route.ts` (`rejectIfNotAllowlisted`, post-session) | Sign-in helper: compares the submitted email to `getAdminAllowedEmail()` before `signInWithOtp` is called; a mismatch throws and no link is sent. Callback: after `verifyOtp`/`exchangeCodeForSession` succeeds, calls `getUser()` (a Supabase round-trip, not a cookie read), compares `data.user.email` to `getAdminAllowedEmail()`, and on mismatch calls `signOut()` then redirects to `/admin/login?error=callback_failed`. | The callback `signOut()` ensures a forged or replayed token cannot leave a live cookie behind even if a non-allowlisted token somehow reaches the callback. |
| 3. Session gate | `/admin/*` middleware (`middleware.ts`) | Checks session presence/validity only via `getSession()`. No session or `getSession()` error → redirect to `/admin/login`. Adds the SEC-09 timing floor and emits no `Set-Cookie` on the redirect outcomes so all three redirect cases are byte-uniform. Does **not** perform any email comparison. | Catches expired or absent sessions. Email allowlisting is already enforced upstream by Layer 2, so the gate does not need to re-check the address. |

`ADMIN_ALLOWED_EMAIL` is a server-only env var set to the admin email in Vercel and in local `.env.local` (the real value is never committed to the repo), read via `getAdminAllowedEmail()`. It is added to `.env.example` as part of T17, **not** T9. T9's `.env.example` carries only the three Supabase vars listed in Section 8 below.

**Follow-up (non-blocking):** An optional redundant email check could be added to the middleware (compare the session user's email to `ADMIN_ALLOWED_EMAIL` and clear the session on mismatch) purely as additional defense in depth. This is not required and does not block anything. The callback-route check is already effective and is in fact stronger than a middleware cookie read would be: `rejectIfNotAllowlisted` uses a `getUser()` round-trip to Supabase to obtain the authoritative user record, whereas the middleware only has the cookie session available. Combined with the pre-send check in the sign-in helper, a non-allowlisted address has no path to a valid admin session, so the middleware addition is an optional hardening, not a gap.

---

## 4. Logout Flow

1. User clicks "Logout" in the admin UI.
2. The `signOut` Server Action (`lib/auth.ts`, `'use server'`) calls `supabase.auth.signOut()`. This clears the session cookies and revokes the refresh token server-side. The same six-channel discipline as sign-in applies — the catch is silent and the timing floor is enforced before redirect.
3. Redirect to `/admin/login`.

---

## 5. Lockout Fallback

If the magic link cannot be received (lost inbox access, email provider outage, deliverability issue), work down this list. Steps are ordered least to most drastic — stop at the first one that gets you a session.

**Read this first: the email budget.** Supabase's built-in SMTP is rate-limited project-wide — 2 emails per hour on the default configuration. The budget is shared across everything the project sends, and an email that is sent but never received still spends it. A genuine lockout therefore gives roughly two attempts per hour on any email-based path, and steps 1 and 2 below are both email-based. Step 3 sends nothing and is not subject to the cap. *Unverified: the exact number is a Supabase platform default, not something this repo can assert — check `Auth → Rate Limits` in the dashboard before planning around it. If a custom SMTP provider has been configured, the built-in cap does not apply and the provider's limits do instead.*

### 5.1 What does not work

Two things that look like fallbacks are not.

- **"Send password recovery" from the user row.** There are no passwords in this system to recover (CONSTRAINT-09, §1). Even if the recovery email arrived, its link carries `type=recovery`, and the callback's `VALID_EMAIL_OTP_TYPES` set accepts only `email` and `magiclink` — `recovery` is refused deliberately (F-4). It was documented here as a fallback until 2026-08-06; it never could have worked. Do not reach for it.
- **Copying a Supabase-generated action / recovery URL out of the dashboard and pasting it into a browser.** Those links point at the project's own `/auth/v1/verify` endpoint, which verifies the token and then redirects to the configured Site URL — the apex root `/` per CONSTRAINT-21 — not to `/admin/auth/callback`. `/admin/auth/callback` is the only place in this app that consumes an auth payload, and nothing at `/` does. Under `flowType: 'implicit'` (CONSTRAINT-18) the tokens also arrive in the URL *fragment*, which never reaches the server at all. No session is established. *Unverified: this is read off the auth model the code encodes plus Supabase's documented verify-endpoint behaviour, not off an observed redemption.* Step 3 exists precisely to route around this — it hands the token to this app's callback directly and never touches `/auth/v1/verify`.

### 5.2 Step 1 — Request a fresh link from `/admin/login`

The obvious one, worth ruling out first: a single failed delivery is more often a transient provider issue than a lockout. Costs one of the two hourly emails. If two attempts in an hour both fail to arrive, stop retrying — you are spending the budget you will want for step 2.

### 5.3 Step 2 — Dashboard → Authentication → Users → "Send magic link"

Open the Supabase dashboard, find the admin user row, trigger "Send magic link".

This is the one dashboard row action that should work. It sends using the project's **Magic Link email template**, which has been customized away from the stock `{{ .ConfirmationURL }}` body to the `token_hash` shape that lands on `/admin/auth/callback?token_hash=…&type=email` (§2 step 5). That template is unversioned operational config held only in the dashboard — see `architecture.md` §5.4 — so this step's correctness depends entirely on the template still being intact. There is no `emailRedirectTo` involved: the origin comes from the template's `{{ .SiteURL }}` base, which is the canonical apex per CONSTRAINT-21.

*Unverified: that the row action uses the project's customized Magic Link template rather than a stock body is inferred, not observed. The corroboration is that §2's described link shape is the `token_hash` shape and production sign-in works, which is only possible with the template customized — and `architecture.md` §5.4 records that customization as existing config.*

Costs one of the two hourly emails. If the template has drifted back to stock, this step fails the same way §5.1's second bullet describes, and you have spent an email finding out. Go to step 3.

### 5.4 Step 3 — Mint a session with the service-role key (no email at all)

This is the real escape hatch. It requires an operator who still holds `SUPABASE_SERVICE_ROLE_KEY` and needs no inbox, no SMTP, and no dashboard email quota.

The mechanism is already proven inside this repo: `app/api/test/sign-in/route.ts` mints admin sessions for the Playwright suite by calling `auth.admin.generateLink({ type: 'magiclink' })` with the service-role key and redeeming the returned `properties.hashed_token` through `verifyOtp`. `scripts/recover-admin-session.ts` does the same generate step, then prints the URL that lets a browser perform the redeem step against the production callback.

1. From a checkout whose `.env.local` carries `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `ADMIN_ALLOWED_EMAIL`, run:

   ```
   npx tsx scripts/recover-admin-session.ts
   ```

   The origin defaults to `NEXT_PUBLIC_SITE_URL`, falling back to `NEXT_PUBLIC_VERCEL_URL` — the same precedence `lib/auth-internal.ts::getSiteUrl` uses. Pass an origin as the first argument to override it (`npx tsx scripts/recover-admin-session.ts http://localhost:3000` recovers a session against a local dev server instead of production).

2. It prints one URL of the shape `{origin}/admin/auth/callback?token_hash=<one-time>&type=email`.

3. Open that URL in a browser. `/admin/auth/callback` is one of the two strict-equality exemptions in the middleware gate, so it is reachable without a session. The callback's `token_hash` branch calls `verifyOtp`, `rejectIfNotAllowlisted` confirms the user is `ADMIN_ALLOWED_EMAIL`, the SSR helper writes the session cookies, and the browser lands on `/admin`.

Why this works where §5.1's dashboard links do not: the browser never visits `/auth/v1/verify`, so the Site URL and the redirect-URL allowlist are not consulted, and no fragment is involved. The token goes straight into this app's own callback, which is the same code path a real magic link exercises.

Conditions and limits:

- The Supabase user record must already exist. `generateLink` does not create one — if the record is gone, go to step 4 first, then come back.
- The printed URL is single-use and expires on the project's email-OTP expiry, 1 hour by default. *Unverified: the expiry value is a dashboard setting this repo does not read.*
- Treat the printed URL as a live credential — it is a session in a string. Do not paste it into chat, a ticket, or a commit.
- *Unverified: whether `generateLink` also queues an email (and therefore spends the hourly budget) was not tested. The token is returned in the API response either way, so the step works regardless — but do not assume it is free if you are also rationing steps 1 and 2.*
- If `SUPABASE_SERVICE_ROLE_KEY` is what has been lost, this step is unavailable and you are on step 4 or the unrecoverable case.

### 5.5 Step 4 — Delete and recreate the user record

If the user record itself is unrecoverable (account fully compromised or destroyed), delete the record in the dashboard and recreate it with the same email.

**Data loss risk: zero.** Verified against the schema: `supabase/migrations/*` contains no reference to `auth.users`, `auth.uid()`, or any `user_id` / `owner_id` / `author_id` / `created_by` column. All admin-managed data lives in `projects`, `posts`, `stats`, `images` and none of it is keyed off the auth user's UUID. The admin's identity is the email held in `ADMIN_ALLOWED_EMAIL`, not the UUID. RLS is role-based throughout (`authenticated` vs `anon`), not user-id matching — so a new UUID behind the same email has exactly the same access as the old one.

Recreate the user as email-confirmed, then recover a session with step 3 (or step 2 if email is working). Note that recreating the record does not by itself sign anyone in.

### 5.6 The unrecoverable case

This is a single-user system. If the only inbox is permanently lost and `SUPABASE_SERVICE_ROLE_KEY` is gone with it, recovery requires Supabase dashboard access, which is a separate failure mode (Supabase dashboard login uses GitHub or a GitHub-linked email — losing both inboxes simultaneously is the unrecoverable case, and it falls outside this system's scope).

---

## 6. Session Expiry Behavior

- The JWT (access token) expires after 1 hour. The Supabase JS SDK silently refreshes it using the refresh token, with no user-visible interruption.
- The refresh token expires after 30 days of inactivity. Once expired, the next request reaching `/admin/*` finds no valid session → middleware redirects to `/admin/login`.
- To start a new session, the user requests a fresh magic link. There is no "stay logged in" toggle — 30 days of inactivity is the cap, by design.

---

## 7. Implementation lineage

Where the pieces this doc describes were built:

- **T9 (Phase 1):** Supabase Auth dashboard configuration (email provider on, all others off; user created; signup disabled).
- **T17 (Phase 2):** `/admin/login` page, `/admin/auth/callback` route handler, `middleware.ts` admin gate, `ADMIN_ALLOWED_EMAIL` env var added to `.env.example`, tests for the full flow.
- **Subsequent admin tasks:** logout button wiring, session-expiry redirect UX.
- **T38 (Phase 4):** this doc reconciled to as-built — allowlist enforcement location corrected (callback + sign-in helper, not middleware), logout redirect corrected to `/admin/login`, §2 narrative aligned to §2a, cookie naming softened to library-managed.
- **2026-08-06:** §5 rewritten. The prior fallback advised "Send password recovery" (no passwords exist — CONSTRAINT-09) and copying a dashboard recovery URL (never traverses `/admin/auth/callback`, so no session results). Replaced with a ladder ordered least-to-most-drastic, the built-in-SMTP email budget stated up front, and a service-role escape hatch added: `scripts/recover-admin-session.ts`. Nothing in the auth code changed.

The contract: this doc and the code agree. Any future change to the auth flow updates this document in the same task.

---

## 8. Environment Variables Confirmed for T9

`.env.example` carries exactly the three vars required by T9 acceptance:

| Var | Public? | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL — used by the auth client. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Anon key — used by `supabase.auth.signInWithOtp` and the public read layer. |
| `SUPABASE_SERVICE_ROLE_KEY` | **no — server only** | Not used by the user-facing auth flow. Listed for completeness; consumed by server-only admin paths in later tasks. |

`ADMIN_ALLOWED_EMAIL` is intentionally not added in T9. It arrives with the middleware in T17.
