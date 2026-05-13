/**
 * Minimum wall-clock duration auth-adjacent server-side surfaces take before
 * resolving, in milliseconds. Closes the timing-channel enumeration vector
 * documented as F-12 (magic-link send) and SEC-09 (admin gate timing parity).
 *
 * Without this bound, fast paths (no cookie present, fast rejection) return in
 * microseconds while slow paths (cookie present -> Supabase round-trip)
 * complete in 100-500ms, giving an external observer a single-probe oracle on
 * session state and admin-address validity.
 *
 * Shared between `lib/auth.ts::signInWithMagicLink` (T17) and
 * `middleware.ts` admin-gate redirect outcomes (T18). Both surfaces enforce
 * the floor via try/finally + setTimeout. The bound is a floor, not a ceiling
 * -- slow paths run over without truncation (truncating slow paths would
 * introduce a different oracle).
 *
 * 750ms is enough to swallow Supabase's typical fast and slow paths under
 * normal network conditions without becoming user-perceptible.
 */
export const MIN_DURATION_MS = 750;
