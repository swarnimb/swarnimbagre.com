import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from './supabase';
import { ServiceError } from './errors';

/** Operation tag for structured log lines and thrown errors (EH-02). */
const ASSERT_ADMIN_SESSION_OPERATION = 'assertAdminSession';

/**
 * Assert that the caller holds a valid admin session, or throw.
 *
 * ## Why this exists (F-39, `docs/security-report.md` audit 24)
 *
 * Every admin Server Action previously relied on Postgres RLS as its ONLY
 * authorization layer. SEC-04 requires two checks -- authenticated AND
 * authorized -- and only the second existed, at the database. That matters
 * more than it looks: Next.js dispatches a Server Action on the `Next-Action`
 * request header against whatever URL is POSTed, not against the route the
 * action nominally belongs to. Since T46 narrowed the middleware matcher to
 * `/admin/:path*`, an attacker who lifts an action ID out of the client bundle
 * can POST it to `/` -- a path middleware never sees -- and the action body
 * runs in full. The only thing refusing the write was the RLS policy, so a
 * single bad policy in any future migration would have become an immediate
 * unauthenticated write path with nothing behind it.
 *
 * This guard is that second layer. It does not replace RLS; RLS remains the
 * authoritative resource-level gate. This is the authentication half.
 *
 * ## Why `getUser()` and not `getSession()`
 *
 * `getSession()` decodes the SSR cookie and checks `exp` locally. It does not
 * verify the JWT signature, so a hand-forged cookie satisfies it. `getUser()`
 * round-trips to Supabase and validates the token server-side. The same change
 * was made at the middleware gate (F-40). A presence check is not an auth
 * check, and this module previously argued otherwise -- that reasoning is
 * retired.
 *
 * ## Why it lives here and not in a `'use server'` module
 *
 * Exporting this from `lib/auth.ts` or any `*-mutations.ts` file would promote
 * it to a publicly callable Server Action, handing any client a wire-level
 * oracle for "is an admin session currently present?" -- a probe channel
 * orthogonal to the six-channel uniformity contract. SEC-08.
 *
 * ## Throwing contract
 *
 * Throws `ServiceError` on every failure mode -- absent session, Supabase
 * error, network throw. Callers are the Server Action wrappers, which already
 * catch everything non-Zod and convert to the uniform `GENERIC_FORM_ERROR`
 * envelope, so an unauthenticated caller receives a response byte-identical to
 * any other failure. It deliberately does NOT return a boolean: a guard whose
 * failure mode is a falsy return is one forgotten `if` away from being a
 * no-op.
 *
 * Logs carry the operation tag and error name only -- never token contents,
 * session, email, or raw error message (SEC-05, EH-02).
 *
 * @param client Optional injected client (DI seam for tests). Defaults to a
 *               request-scoped server client reading the SSR auth cookie.
 * @throws ServiceError when no verified admin user backs the request.
 */
export async function assertAdminSession(
  client?: SupabaseClient,
): Promise<void> {
  const supabase = client ?? (await createServerClient());
  let userId: string | undefined;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.error(`[auth] ${ASSERT_ADMIN_SESSION_OPERATION} rejected`, {
        operation: ASSERT_ADMIN_SESSION_OPERATION,
        errorName: error.name,
      });
      throw new ServiceError('admin session check failed', {
        operation: ASSERT_ADMIN_SESSION_OPERATION,
        cause: new Error(`auth.getUser returned ${error.name}`),
      });
    }
    userId = data.user?.id;
  } catch (cause) {
    if (cause instanceof ServiceError) throw cause;
    console.error(`[auth] ${ASSERT_ADMIN_SESSION_OPERATION} threw`, {
      operation: ASSERT_ADMIN_SESSION_OPERATION,
      errorName: cause instanceof Error ? cause.name : 'unknown',
    });
    throw new ServiceError('admin session check threw', {
      operation: ASSERT_ADMIN_SESSION_OPERATION,
      cause,
    });
  }
  if (!userId) {
    console.error(`[auth] ${ASSERT_ADMIN_SESSION_OPERATION} absent`, {
      operation: ASSERT_ADMIN_SESSION_OPERATION,
    });
    throw new ServiceError('no admin session', {
      operation: ASSERT_ADMIN_SESSION_OPERATION,
      cause: new Error('auth.getUser returned no user'),
    });
  }
}
