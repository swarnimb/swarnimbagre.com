'use server';

import { attemptMagicLink } from './auth-internal';

/**
 * Minimum wall-clock duration the public Server Action takes before resolving,
 * in milliseconds. Closes the timing-channel email enumeration vector
 * documented as F-12: without this bound, a non-allowlisted rejection returns
 * in microseconds while an allowlisted call awaits Supabase (~100-500ms),
 * giving an external observer a single-probe oracle on the admin address.
 * 750ms is enough to swallow both the fast and slow paths under normal network
 * conditions without becoming user-perceptible.
 */
const MIN_DURATION_MS = 750;

/**
 * Server Action — public entry point for the magic-link sign-in flow.
 *
 * Wraps `attemptMagicLink` (imported from the non-`'use server'` module
 * `lib/auth-internal.ts`) so the wire-observable behavior is uniform across
 * outcomes:
 *
 * - **Server Action surface (F-14):** this module is the project's only
 *   `'use server'` file and exports exactly one function. Next.js promotes
 *   every export of a `'use server'` module to a publicly-addressable Server
 *   Action with a stable hashed action ID that ships in the client bundle, so
 *   adding any second export here would silently expose a second RPC endpoint.
 *   `attemptMagicLink` is therefore deliberately kept in a sibling module
 *   without the directive — it remains a regular function import, not a
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
    const elapsed = performance.now() - start;
    const remaining = MIN_DURATION_MS - elapsed;
    if (remaining > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, remaining));
    }
  }
}
