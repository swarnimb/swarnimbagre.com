import { MIN_DURATION_MS } from './auth-constants';

/**
 * Pad the current operation's wall-clock duration up to the
 * `MIN_DURATION_MS` floor before resolving (Channel 3 — response timing,
 * SEC-09 / F-12 uniform-timing discipline).
 *
 * Single shared implementation for every auth-adjacent server-side surface:
 * `lib/auth.ts` (sign-in, sign-out) and the four admin mutation entry-point
 * modules (projects, posts, stats, images). Each caller records a start
 * timestamp via `performance.now()` and invokes this in a `finally` block so
 * the floor applies on every outcome — success, validation failure, Supabase
 * rejection, or internal throw — making response timing wire-uniform across
 * paths. Without the floor, fast paths (early rejection) return in
 * microseconds while slow paths (Supabase round-trip) take 100-500ms, which
 * is a single-probe enumeration oracle on session state and admin-address
 * validity.
 *
 * The bound is a floor, not a ceiling: if the operation already exceeded
 * `MIN_DURATION_MS` the function returns immediately without delay. Slow
 * paths run over without truncation — truncating them would introduce a
 * different oracle. The floor value is the project-wide constant in
 * `lib/auth-constants.ts`; it is imported here, never redefined.
 *
 * This module is a plain helper — it deliberately carries no `'use server'`
 * directive, so importing it into a `'use server'` module adds no Server
 * Action to that module's export surface.
 *
 * @param startedAt - The `performance.now()` value captured by the caller at
 *                     the start of the operation, in milliseconds.
 * @returns Resolves with `undefined` once at least `MIN_DURATION_MS` has
 *          elapsed since `startedAt` (immediately if it already has). Never
 *          throws.
 */
export async function padToFloor(startedAt: number): Promise<void> {
  const elapsed = performance.now() - startedAt;
  const remaining = MIN_DURATION_MS - elapsed;
  if (remaining > 0) {
    await new Promise<void>((resolve) => setTimeout(resolve, remaining));
  }
}
