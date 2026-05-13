# Auth Flow: swarnimbagre.com

**Date:** 2026-05-07
**Status:** Spec only. Implementation lives in Phase 2 T17 (admin middleware + login page wiring).

This document is the specification for admin authentication on swarnimbagre.com. It satisfies DS-02 — the architectural decision (magic-link, single user, no passwords) is documented before the code that depends on it is written. Configuration of Supabase Auth and creation of the admin user happen in Phase 1 T9; the application-side login page, callback route, and `/admin/*` middleware ship in Phase 2 T17. Anything described here as "the middleware does X" is a requirement against T17, not a description of code that exists today.

Out of scope: public-site auth (there is none — all public reads are anon role + RLS), the OpenClaw write path (shared-secret Edge Function — see CONSTRAINT-04), and any future multi-user model (closed off by CONSTRAINT-09).

---

## 1. Auth Model Summary

- Magic-link only. No passwords are stored or accepted.
- Email provider only. No OAuth, no phone, no SAML (CONSTRAINT-09).
- Single allowed user: `swarnim.build@gmail.com`.
- JWT expiry: 1 hour (Supabase default — no customization).
- Refresh expiry: 30 days inactivity (Supabase default — no customization).
- No "remember me" toggle. No role tiers. No password reset (no passwords to reset).
- No signup flow. The single user is created manually in the Supabase Auth dashboard. "Allow new users to sign up" is OFF.

---

## 2. Login Flow

1. User navigates to `/admin/login`.
2. The page renders a single-field form: email. The user enters `swarnim.build@gmail.com`.
3. Client calls `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: 'https://swarnimbagre.com/admin/auth/callback' } })`. Supabase sends a magic link to the inbox.
4. Regardless of whether the email matches the allowlisted address, the response must be uniform across all six observable channels enumerated in §2a (UI text, response body, response timing, Server Action surface, response headers, status code). This avoids leaking which addresses are valid (SEC-04 — defense against user enumeration). The literal UI text is a single template: "If an account exists for that address, a sign-in link has been sent." The other channels are not optional and not separable — see §2a.
5. User opens the email and clicks the magic link. The link points at `https://swarnimbagre.com/admin/auth/callback?token_hash=...&type=email`.
6. The `/admin/auth/callback` route handler calls `supabase.auth.verifyOtp({ token_hash, type: 'email' })` to exchange the token for a session. (`verifyOtp` is the correct method for the `token_hash` + `type` query-param shape that `signInWithOtp` produces. `exchangeCodeForSession` is for the PKCE/`?code=...` flow, which is not used here.)
7. On success, `@supabase/ssr` writes the session cookies — `sb-access-token` and `sb-refresh-token` — as `httpOnly`, `Secure`, `SameSite=Lax`.
8. The callback redirects to `/admin` (the dashboard home).
9. On every subsequent request to `/admin/*`, the Next.js middleware (T17) checks for a valid session. No session, expired session, or wrong user email → redirect to `/admin/login`.

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

The auth provider does not by itself restrict which email addresses may sign in. Enforcement is layered:

| Layer | Where | What it does | Failure mode |
|---|---|---|---|
| 1. Operational | Supabase Auth dashboard | Exactly one user record exists, for `swarnim.build@gmail.com`. "Allow new users to sign up" is OFF, so an OTP request for a non-existent email does not auto-create an account. | If "Allow new users" is ever flipped on, anyone could create an account. Treat this setting as a config-level invariant. |
| 2. Defense in depth | `/admin/*` middleware (T17) | Reads `session.user.email`. If it is not equal to `process.env.ADMIN_ALLOWED_EMAIL`, clears the session and redirects to `/admin/login`. | Catches the case where Layer 1 is misconfigured or a second user is ever created. |

`ADMIN_ALLOWED_EMAIL` is a server-only env var set to `swarnim.build@gmail.com` in Vercel and in local `.env.local`. It is added to `.env.example` as part of T17, **not** T9. T9's `.env.example` carries only the three Supabase vars listed in Section 8 below.

---

## 4. Logout Flow

1. User clicks "Logout" in the admin UI.
2. Client (or Server Action) calls `supabase.auth.signOut()`. This clears the session cookies and revokes the refresh token server-side.
3. Redirect to `/` (public home).

---

## 5. Lockout Fallback

If the magic link cannot be received (lost inbox access, email provider outage, deliverability issue):

1. Open the Supabase dashboard → Authentication → Users.
2. Locate `swarnim.build@gmail.com` and either trigger "Send magic link" / "Send password recovery" from the row actions, or copy a one-time recovery URL.
3. If the user record itself is unrecoverable (account fully compromised or destroyed), delete the record and recreate it with the same email. **Data loss risk: zero.** All admin-managed data lives in `projects`, `posts`, `stats`, `images` — none of it is keyed off the auth user's UUID. The admin's identity is the email, not the UUID. RLS uses role-based policies (`authenticated` vs `anon`), not user-id matching.

This is a single-user system. If the only inbox is permanently lost, recovery requires Supabase dashboard access, which is a separate failure mode (Supabase dashboard login uses GitHub or a GitHub-linked email — losing both inboxes simultaneously is the unrecoverable case, and it falls outside this system's scope).

---

## 6. Session Expiry Behavior

- The JWT (access token) expires after 1 hour. The Supabase JS SDK silently refreshes it using the refresh token, with no user-visible interruption.
- The refresh token expires after 30 days of inactivity. Once expired, the next request reaching `/admin/*` finds no valid session → middleware redirects to `/admin/login`.
- To start a new session, the user requests a fresh magic link. There is no "stay logged in" toggle — 30 days of inactivity is the cap, by design.

---

## 7. What's NOT in this document

This is the spec. Implementation tasks:

- **T9 (Phase 1):** Supabase Auth dashboard configuration (email provider on, all others off; user created; signup disabled). This document.
- **T17 (Phase 2):** `/admin/login` page, `/admin/auth/callback` route handler, `middleware.ts` admin gate, `ADMIN_ALLOWED_EMAIL` env var added to `.env.example`. Tests for the full flow.
- **Subsequent admin tasks:** Logout button wiring, session-expiry redirect UX.

If anything in this document conflicts with what is actually implemented in T17, update this document at that time. The contract is: this doc and the code agree at all times after T17 ships.

---

## 8. Environment Variables Confirmed for T9

`.env.example` carries exactly the three vars required by T9 acceptance:

| Var | Public? | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL — used by the auth client. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Anon key — used by `supabase.auth.signInWithOtp` and the public read layer. |
| `SUPABASE_SERVICE_ROLE_KEY` | **no — server only** | Not used by the user-facing auth flow. Listed for completeness; consumed by server-only admin paths in later tasks. |

`ADMIN_ALLOWED_EMAIL` is intentionally not added in T9. It arrives with the middleware in T17.
