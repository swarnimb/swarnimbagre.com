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

/**
 * Cross-resource Channel 1 (UI text) generic form error string per
 * `auth-flow.md` §2a. Surfaced by every admin mutation wrapper (projects,
 * posts, stats, and future image mutations) on any non-validation failure —
 * Supabase rejection, trigger raise, RLS denial, network blip, internal
 * throw. The wire string is intentionally:
 *
 * - **Resource-agnostic** — the same string is used by `createProject`,
 *   `deletePost`, `insertStat`, etc. so an attacker cannot tell which
 *   resource family the failure originated in by reading the form error.
 * - **Reason-agnostic** — no specificity about whether the failure was a
 *   trigger raise, a unique-constraint violation, an RLS denial, or a
 *   network outage. Specificity would re-open a Channel 1 leak.
 * - **Voice-aligned** — CONSTRAINT-13: dry, terse, no SaaS phrasing,
 *   no emoji.
 *
 * MUST remain identical (byte-for-byte) across every admin mutation wrapper.
 * Drift between resource families would itself become an enumeration channel
 * — an attacker could distinguish a `posts` failure from a `stats` failure
 * by comparing the form-error strings letter by letter. This module is the
 * single source of truth; per-resource mutation modules import from here.
 */
export const GENERIC_FORM_ERROR = 'Could not save. Try again.';
