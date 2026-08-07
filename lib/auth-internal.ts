import { z } from 'zod';
import { createServerClient } from './supabase';
import { getAdminAllowedEmail } from './env';
import { ServiceError, ValidationError, toLogSafeError } from './errors';

/**
 * Module note (F-14): this file deliberately does NOT carry the `'use server'`
 * directive. Next.js promotes every export of a `'use server'` module to a
 * publicly addressable Server Action, with a stable hashed action ID that
 * ships in the client bundle. Co-locating the throwing helper next to the
 * non-throwing wrapper in `lib/auth.ts` therefore exposes the helper as a
 * second RPC endpoint and structurally bypasses the F-12 + F-13 mitigations
 * (`docs/security-report.md` audit 3, finding F-14). The split keeps
 * `lib/auth.ts` at a single Server Action export (`signInWithMagicLink`);
 * `attemptMagicLink` is reachable only via that wrapper, never directly from
 * the browser.
 */

/**
 * Zod schema for the email field at the magic-link boundary (SEC-02).
 *
 * Bounded at 254 characters — the RFC 5321 maximum length of a reverse-path /
 * forward-path address — so an oversized string is rejected by the parse
 * instead of being carried into `assertAllowlistedEmail` and the Supabase
 * call (`docs/security-report.md` audit 19, finding F-3).
 *
 * The `.min(3)` floor is the F-3 recommendation verbatim. It is redundant in
 * practice: zod's `.email()` pattern requires a dotted domain with a 2+
 * character TLD, so the shortest string this schema accepts is 6 characters
 * (`a@b.co`). The theoretical 3-character address `a@b` does NOT pass. The
 * floor is kept because a length bound that states both ends is cheaper to
 * audit than one that leans on the format check for its lower end.
 */
export const EMAIL_SCHEMA = z.string().min(3).max(254).email();

/** Operation tag used in error logs for `signInWithMagicLink`. */
export const SIGN_IN_OPERATION = 'signInWithMagicLink';

/**
 * Compare a candidate email to the allowlisted admin email (CONSTRAINT-09).
 *
 * Throws `ServiceError` when the allowlist env var is missing — failing loud
 * at the auth boundary is safer than silently denying every login (EH-01).
 * Throws `ValidationError` on mismatch so the caller surfaces the same shape
 * used by any other rejection. The mismatch is logged with presence only —
 * never the raw email (SEC-05).
 *
 * @param email Normalized candidate email (already zod-validated for shape).
 * @throws ServiceError    when `ADMIN_ALLOWED_EMAIL` is not configured.
 * @throws ValidationError when the email is not the allowlisted address.
 */
export function assertAllowlistedEmail(email: string): void {
  let allowed: string;
  try {
    allowed = getAdminAllowedEmail();
  } catch (cause) {
    throw new ServiceError('admin allowlist not configured', {
      operation: SIGN_IN_OPERATION,
      cause,
    });
  }
  if (email.trim().toLowerCase() !== allowed) {
    console.error(`[auth] ${SIGN_IN_OPERATION} rejected`, {
      operation: SIGN_IN_OPERATION,
      emailProvided: true,
      error: 'not_allowlisted',
    });
    throw new ValidationError('email', 'not allowlisted');
  }
}

/**
 * Resolve the absolute site URL used to build the magic-link `emailRedirectTo`.
 *
 * Reads `NEXT_PUBLIC_SITE_URL` first, then falls back to a `https://`-prefixed
 * `NEXT_PUBLIC_VERCEL_URL` (Vercel provides the host without scheme). Throws
 * if neither is set — failing loud is better than silently emitting a magic
 * link that points at the wrong origin (EH-01, CQ-04).
 *
 * @returns Absolute site URL without a trailing slash.
 * @throws ServiceError if no site URL env var is configured.
 */
function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit && explicit.length > 0) return explicit.replace(/\/$/, '');
  const vercel = process.env.NEXT_PUBLIC_VERCEL_URL;
  if (vercel && vercel.length > 0) return `https://${vercel.replace(/\/$/, '')}`;
  throw new ServiceError('site URL env var not configured', {
    operation: SIGN_IN_OPERATION,
    cause: new Error(
      'Set NEXT_PUBLIC_SITE_URL (preferred) or rely on NEXT_PUBLIC_VERCEL_URL on Vercel.',
    ),
  });
}

/**
 * Internal magic-link helper. Throws on every failure mode (EH-05 typed errors
 * still apply at this internal boundary). The public Server Action
 * `signInWithMagicLink` in `lib/auth.ts` wraps this so the thrown errors never
 * reach the wire (F-13) and are masked by a constant-time bound (F-12).
 *
 * Validates the email at the boundary with zod (SEC-02), enforces the
 * single-user allowlist (CONSTRAINT-09, F-1), and passes `shouldCreateUser:
 * false` to Supabase so an unknown email cannot auto-provision a new
 * authenticated user even if Layer 1 (the dashboard toggle) is misconfigured.
 * Logs failures with presence only — never the raw email (SEC-05).
 *
 * Lives in a non-`'use server'` module (F-14): co-locating it with the
 * `'use server'` wrapper would expose it as a second Server Action endpoint
 * and structurally bypass the F-12 + F-13 mitigations. Exported only so unit
 * tests can assert the typed-error contract directly.
 *
 * @param email Plain-text email address. Validated before any network call.
 * @returns Resolves when Supabase has accepted the request.
 * @throws ValidationError when `email` is empty, malformed, longer than the
 *                         RFC 5321 254-character bound, or not allowlisted.
 * @throws ServiceError    when Supabase returns an error, the site URL is not
 *                         configured, or the allowlist env var is missing.
 */
export async function attemptMagicLink(email: string): Promise<void> {
  const parsed = EMAIL_SCHEMA.safeParse(email);
  if (!parsed.success) {
    throw new ValidationError('email', 'must be a valid email address');
  }
  assertAllowlistedEmail(parsed.data);
  const supabase = await createServerClient();
  const emailRedirectTo = `${getSiteUrl()}/admin/auth/callback`;
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: { emailRedirectTo, shouldCreateUser: false },
  });
  if (error) {
    console.error(`[auth] ${SIGN_IN_OPERATION} failed`, {
      operation: SIGN_IN_OPERATION,
      emailProvided: true,
      error: toLogSafeError(error),
    });
    throw new ServiceError(`${SIGN_IN_OPERATION} failed`, {
      operation: SIGN_IN_OPERATION,
      cause: error,
    });
  }
}
