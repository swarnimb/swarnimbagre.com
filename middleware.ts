import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { MIN_DURATION_MS } from './lib/auth-constants';

const MOBILE_UA_TOKENS = /Mobi|Android|iPhone|iPad|iPod/i;
const DEVICE_VARIANT_HEADER = 'x-device-variant';
const MOBILE_VARIANT = 'mobile';
const DESKTOP_VARIANT = 'desktop';

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
 * Token-based UA heuristic. Mozilla recommends `Mobi` as the canonical
 * mobile-browser token; the others cover platform names that historically
 * predate or omit it (older iPad UAs, embedded browsers, etc.).
 */
export function isMobileUserAgent(ua: string): boolean {
  if (!ua) return false;
  return MOBILE_UA_TOKENS.test(ua);
}

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

    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.info(`[auth] ${REDIRECT_OUTCOME_EXPIRED}`, { path: pathname });
      await padToFloor(start);
      return buildLoginRedirect(request);
    }
    if (!data.session) {
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
 * Reads the request User-Agent, classifies it as mobile or desktop, and
 * forwards a mutated request to downstream pages with `x-device-variant`
 * set. Preserves the T10 contract for public routes.
 */
function applyDeviceVariant(request: NextRequest): NextResponse {
  const ua = request.headers.get('user-agent') ?? '';
  const variant = isMobileUserAgent(ua) ? MOBILE_VARIANT : DESKTOP_VARIANT;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(DEVICE_VARIANT_HEADER, variant);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

/**
 * Top-level middleware entry. Branches on path: gated `/admin/*` paths run
 * the session gate; everything else gets the T10 device-variant header.
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const pathname = request.nextUrl.pathname;
  if (isGatedAdminPath(pathname)) {
    return runAdminGate(request);
  }
  return applyDeviceVariant(request);
}

export const config = {
  matcher: [
    // Public routes (T10) + admin routes (T18). Skip api, Next.js internals,
    // and static assets.
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
