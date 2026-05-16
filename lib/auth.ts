'use server';

import { redirect } from 'next/navigation';
import { attemptMagicLink } from './auth-internal';
import { padToFloor } from './timing';
import { createServerClient } from './supabase';

/**
 * Server Action — public entry point for the magic-link sign-in flow.
 *
 * Wraps `attemptMagicLink` (imported from the non-`'use server'` module
 * `lib/auth-internal.ts`) so the wire-observable behavior is uniform across
 * outcomes:
 *
 * - **Server Action surface (F-14, SEC-09):** this module is the project's
 *   only `'use server'` file. It exports one function per auth flow — today
 *   `signInWithMagicLink` (this function) and `signOut` (below). Next.js
 *   promotes every export to a publicly-addressable Server Action with a
 *   stable hashed action ID that ships in the client bundle, so the SEC-09
 *   allowlist (enforced by `tests/server-actions-manifest.test.ts`) is the union of one ID per flow.
 *   `attemptMagicLink` is deliberately kept in a sibling module without the
 *   `'use server'` directive — it remains a regular function import, not a
 *   Server Action. See `docs/security-report.md` audit 3 finding F-14.
 *
 * - **Wire shape (F-13):** never throws; always resolves with `undefined`.
 *   Errors from the inner helper are caught and discarded here. The inner
 *   helper has already logged structured context on every failure path — this
 *   wrapper deliberately does NOT log again, because an extra `console.error`
 *   on the catch path would itself introduce a timing differential between
 *   success and failure paths, reopening F-12 at a smaller scale.
 *
 * - **Timing channel (F-12):** every invocation waits until at least
 *   `MIN_DURATION_MS` has elapsed before returning, regardless of whether the
 *   inner helper resolved or threw. The bound is a floor — if Supabase is
 *   unusually slow and pushes past `MIN_DURATION_MS`, the response just runs
 *   over. The success and failure paths both flow through the `finally` block,
 *   so the bound applies uniformly.
 *
 * The three fixes are paired: F-14 makes the wrapper the only callable
 * endpoint, F-13 makes the wire shape uniform, F-12 makes the wire timing
 * uniform. Together they close the single-probe enumeration oracle documented
 * in `docs/security-report.md`.
 *
 * @param email Plain-text email address. Forwarded verbatim to the inner
 *              helper, which validates it.
 * @returns Resolves with `undefined` after at least `MIN_DURATION_MS` ms.
 */
export async function signInWithMagicLink(email: string): Promise<void> {
  const start = performance.now();
  try {
    await attemptMagicLink(email);
  } catch {
    // Inner helper already logged structured context. Re-logging here would
    // introduce a timing difference between success and failure paths and
    // reopen F-12 at a smaller scale (SEC-04).
  } finally {
    await padToFloor(start);
  }
}

/**
 * Server Action — signs the current admin out and redirects to /admin/login.
 *
 * Pairs with `signInWithMagicLink` above. Same six-channel discipline applied
 * (`docs/auth-flow.md` §2a):
 *
 * - **Server Action surface (F-14, SEC-09):** this is the second of two
 *   exports in this `'use server'` module. Each one is an auth flow (sign-in,
 *   sign-out). SEC-09's allowlist is the union of the two action IDs.
 * - **Wire shape (F-13):** never throws; always resolves with `undefined`.
 *   The Supabase `signOut()` error path is swallowed without re-logging — for
 *   the same reason F-12 documents on `signInWithMagicLink`: a `console.error`
 *   on the catch path is itself a side-effect with a measurable cost and
 *   reopens the timing oracle at a smaller scale. The catch is intentionally
 *   silent (not a violation of EH-01 — the rule's intent is met by this
 *   documented, deliberate discipline; observability of failed sign-outs is
 *   not load-bearing because the user always ends up at `/admin/login`).
 * - **Timing channel (F-12):** every invocation waits until at least
 *   `MIN_DURATION_MS` has elapsed before calling `redirect()`, regardless of
 *   the Supabase call's actual duration or outcome. Bound is a floor.
 * - **Location/cookie/status uniformity (channels 5/6):** `redirect()` runs
 *   on every outcome — success, expired session, and Supabase error all land
 *   the user on `/admin/login` with the same response shape.
 */
export async function signOut(): Promise<void> {
  const start = performance.now();
  try {
    const supabase = await createServerClient();
    await supabase.auth.signOut();
  } catch {
    // Deliberately silent — re-logging here would reopen the F-12 timing
    // oracle by introducing a side-effect cost only on the failure path.
  } finally {
    await padToFloor(start);
  }
  redirect('/admin/login');
}
