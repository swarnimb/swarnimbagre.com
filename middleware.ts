import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { MIN_DURATION_MS } from './lib/auth-constants';

const ADMIN_PATH_PREFIX = '/admin';
/**
 * Subpaths under /admin that must NOT be gated. Match is STRICT EQUALITY (per
 * F-16 audit-pass-5 finding) — any subpath beneath these (e.g.,
 * `/admin/login/recover`) IS gated. If a legitimate public subpath is added
 * later, list its exact path here; never widen to prefix matching.
 *
 * `/admin/login` is the gate's own escape hatch; `/admin/auth/callback`
 * mints the session and so cannot require one. Both also have their own
 * internal "if signed in -> /admin" checks (callback by design, login page
 * via createServerClient + getUser).
 */
const ADMIN_PUBLIC_SUBPATHS = ['/admin/login', '/admin/auth/callback'] as const;

const ADMIN_LOGIN_PATH = '/admin/login';

const REDIRECT_OUTCOME_NO_SESSION = 'admin gate: no session';
const REDIRECT_OUTCOME_EXPIRED = 'admin gate: session expired';
const REDIRECT_OUTCOME_ERROR = 'admin gate: unexpected error';

/**
 * Returns true when the path falls inside the gated `/admin/*` namespace
 * AND is not exactly one of the two public exemptions. Match is strict
 * equality — any subpath under `/admin/login/*` or `/admin/auth/callback/*`
 * is GATED. This prevents a future contributor from inadvertently shipping a
 * new route like `/admin/login/recover` as implicitly unauthenticated. If a
 * legitimate public subpath is ever needed, add the exact path to
 * ADMIN_PUBLIC_SUBPATHS — never via prefix matching. (F-16, audit pass 5.)
 */
function isGatedAdminPath(pathname: string): boolean {
  if (!pathname.startsWith(ADMIN_PATH_PREFIX)) return false;
  return !(ADMIN_PUBLIC_SUBPATHS as readonly string[]).includes(pathname);
}

/**
 * Build the canonical login redirect. No query params (Decision 5 -- avoids
 * open-redirect surface and UI-text channel divergence). Uniform across all
 * three redirect outcomes (B/C/D) so the response is byte-identical except
 * for the outcome's internal log line.
 */
function buildLoginRedirect(request: NextRequest): NextResponse {
  return NextResponse.redirect(new URL(ADMIN_LOGIN_PATH, request.url));
}

/**
 * Pad the elapsed time up to the SEC-09 constant-time floor. Applied only to
 * redirect outcomes (B/C/D) -- not to the pass-through path, which is
 * observably distinct anyway because it returns the actual page.
 */
async function padToFloor(start: number): Promise<void> {
  const elapsed = Date.now() - start;
  const remaining = MIN_DURATION_MS - elapsed;
  if (remaining > 0) {
    await new Promise<void>((resolve) => setTimeout(resolve, remaining));
  }
}

/**
 * Run the /admin/* session gate. Returns either the redirect response (B/C/D
 * outcomes -- padded to MIN_DURATION_MS) or the pass-through response
 * (outcome A -- the response built by the cookie adapter).
 *
 * The cookie adapter rebuilds `response` on every `setAll` invocation per the
 * @supabase/ssr documented pattern; mutating in place would silently drop
 * refreshed tokens. The closure variable is the response actually returned.
 */
async function runAdminGate(request: NextRequest): Promise<NextResponse> {
  const start = Date.now();
  const pathname = request.nextUrl.pathname;
  let response = NextResponse.next({ request });

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: { flowType: 'implicit' },
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (cookiesToSet) => {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value),
            );
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options),
            );
          },
        },
      },
    );

    // `getUser()`, NOT `getSession()` (F-40, audit 24). `getSession()` only
    // decodes the cookie and checks `exp` locally -- it never verifies the JWT
    // signature, so a hand-forged cookie with a future `exp` passed this gate
    // and rendered the admin shell. `getUser()` round-trips to Supabase and
    // validates the token server-side. Cost is one request per gated page load;
    // that is the correct price for the only check standing in front of /admin.
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.info(`[auth] ${REDIRECT_OUTCOME_EXPIRED}`, { path: pathname });
      await padToFloor(start);
      return buildLoginRedirect(request);
    }
    if (!data.user) {
      console.info(`[auth] ${REDIRECT_OUTCOME_NO_SESSION}`, { path: pathname });
      await padToFloor(start);
      return buildLoginRedirect(request);
    }
    return response;
  } catch (cause) {
    console.error(`[auth] ${REDIRECT_OUTCOME_ERROR}`, {
      path: pathname,
      errorName: cause instanceof Error ? cause.name : 'unknown',
    });
    await padToFloor(start);
    return buildLoginRedirect(request);
  }
}

/**
 * Top-level middleware entry.
 *
 * T46 removed the T10 device-variant branch. The public site is now a single
 * responsive tree with one breakpoint, so there is no server-side desktop /
 * mobile split to compute and no `x-device-variant` header to forward. The
 * matcher below was narrowed to `/admin/*` accordingly: middleware no longer
 * runs at all on public requests, which is both the correct behaviour and one
 * fewer edge invocation per page view.
 *
 * Public paths that somehow reach this function (they should not, given the
 * matcher) fall through untouched.
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const pathname = request.nextUrl.pathname;
  if (isGatedAdminPath(pathname)) {
    return runAdminGate(request);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Admin routes only (T18). T46 dropped the public-route match: nothing in
    // middleware applies to the public site any more. `:path*` matches the
    // bare `/admin` segment as well as everything beneath it.
    '/admin/:path*',
  ],
};
