import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getAdminAllowedEmail } from '@/lib/env';
import { toLogSafeError } from '@/lib/errors';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Operation tag for structured log lines emitted from this route. */
const CALLBACK_OPERATION = 'adminAuthCallback';

/** Generic error query string appended on any failure path (EH-04, SEC-05). */
const FAILURE_REDIRECT = '/admin/login?error=callback_failed';

/** Destination once the session is established. */
const SUCCESS_REDIRECT = '/admin';

/** Email-OTP type values accepted by `supabase.auth.verifyOtp`. */
const VALID_EMAIL_OTP_TYPES = new Set([
  'email',
  'magiclink',
  'recovery',
  'invite',
  'email_change',
  'signup',
]);

/**
 * Build an absolute redirect URL anchored to the incoming request origin.
 *
 * Using the request origin avoids hardcoding a host (CQ-04) and keeps
 * preview deployments self-consistent.
 */
function buildRedirect(request: NextRequest, path: string): URL {
  return new URL(path, request.url);
}

/**
 * Log a callback failure with structured context. Never logs raw tokens or
 * the magic-link query string (SEC-05). Callers MUST pass a pre-reduced
 * `toLogSafeError(...)` shape (or an already-safe literal) — never a raw
 * caught error, whose `message` can echo the submitted email (F-29).
 */
function logCallbackFailure(reason: string, error?: unknown): void {
  console.error(`[auth] ${CALLBACK_OPERATION} failed`, {
    operation: CALLBACK_OPERATION,
    reason,
    error,
  });
}

/**
 * Defense-in-depth allowlist check (F-1 mitigation).
 *
 * Called after a Supabase auth method has reported success and a session
 * exists. Fetches the authoritative user record via `getUser()` — which round-
 * trips to Supabase rather than trusting cookie contents — and rejects any
 * session whose email does not match `ADMIN_ALLOWED_EMAIL`. On rejection the
 * session is invalidated via `signOut()` so a forged or replayed token cannot
 * leave a live cookie behind. Returns `null` on accept, the failure redirect
 * URL on reject; the caller bounces unchanged.
 *
 * The login-page boundary check in `lib/auth.ts` is the primary defense; this
 * is the belt to that suspenders. Same generic error code is used on reject so
 * no UI surface distinguishes "wrong email" from "verifyOtp failed" (SEC-05).
 *
 * @param supabase Request-scoped Supabase server client.
 * @param request  The incoming Next.js request, used only to anchor redirect origin.
 * @returns A NextResponse redirect to `FAILURE_REDIRECT` on reject, otherwise null.
 */
async function rejectIfNotAllowlisted(
  supabase: SupabaseClient,
  request: NextRequest,
): Promise<NextResponse | null> {
  let allowed: string;
  try {
    allowed = getAdminAllowedEmail();
  } catch (error) {
    logCallbackFailure('allowlist env not configured', toLogSafeError(error));
    await supabase.auth.signOut();
    return NextResponse.redirect(buildRedirect(request, FAILURE_REDIRECT));
  }
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    logCallbackFailure(
      'getUser returned no user after session establish',
      toLogSafeError(error),
    );
    await supabase.auth.signOut();
    return NextResponse.redirect(buildRedirect(request, FAILURE_REDIRECT));
  }
  const candidate = data.user.email?.trim().toLowerCase() ?? '';
  if (candidate !== allowed) {
    logCallbackFailure('authenticated user not allowlisted', {
      operation: CALLBACK_OPERATION,
      emailProvided: !!data.user.email,
      error: 'not_allowlisted',
    });
    await supabase.auth.signOut();
    return NextResponse.redirect(buildRedirect(request, FAILURE_REDIRECT));
  }
  return null;
}

/**
 * Magic-link return endpoint for the admin panel.
 *
 * Supabase Auth posts the user back here after they click the link in their
 * inbox. Two shapes are supported:
 *
 * 1. `?token_hash=...&type=email` — the default magic-link payload from
 *    `signInWithOtp` without PKCE; verified via `verifyOtp`.
 * 2. `?code=...` — the PKCE payload (e.g., if OAuth providers are added
 *    later); verified via `exchangeCodeForSession`.
 *
 * On success the session is persisted as `httpOnly` cookies by the SSR
 * helper and the user is bounced to `/admin`. On any failure the response
 * redirects to `/admin/login` with a generic error code; the full reason
 * lives in the server log (EH-04, SEC-05).
 *
 * @param request The incoming Next.js request.
 * @returns NextResponse — a 307 redirect to either `/admin` or `/admin/login`.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const code = searchParams.get('code');

  const supabase = await createServerClient();

  if (tokenHash && type && VALID_EMAIL_OTP_TYPES.has(type)) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as 'email',
    });
    if (error) {
      logCallbackFailure('verifyOtp returned error', toLogSafeError(error));
      return NextResponse.redirect(buildRedirect(request, FAILURE_REDIRECT));
    }
    const rejection = await rejectIfNotAllowlisted(supabase, request);
    if (rejection) return rejection;
    return NextResponse.redirect(buildRedirect(request, SUCCESS_REDIRECT));
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      logCallbackFailure('exchangeCodeForSession returned error', toLogSafeError(error));
      return NextResponse.redirect(buildRedirect(request, FAILURE_REDIRECT));
    }
    const rejection = await rejectIfNotAllowlisted(supabase, request);
    if (rejection) return rejection;
    return NextResponse.redirect(buildRedirect(request, SUCCESS_REDIRECT));
  }

  logCallbackFailure('missing token_hash/type or code in callback URL');
  return NextResponse.redirect(buildRedirect(request, FAILURE_REDIRECT));
}
