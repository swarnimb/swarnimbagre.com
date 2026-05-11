import { NextResponse, type NextRequest } from 'next/server';

/**
 * Token-based UA heuristic. Mozilla recommends `Mobi` as the canonical
 * mobile-browser token; the others cover platform names that historically
 * predate or omit it (older iPad UAs, embedded browsers, etc.).
 */
const MOBILE_UA_TOKENS = /Mobi|Android|iPhone|iPad|iPod/i;

const DEVICE_VARIANT_HEADER = 'x-device-variant';
const MOBILE_VARIANT = 'mobile';
const DESKTOP_VARIANT = 'desktop';

/**
 * Returns true if the User-Agent string matches a known mobile token.
 * Empty or missing UA strings default to desktop (false).
 */
export function isMobileUserAgent(ua: string): boolean {
  if (!ua) return false;
  return MOBILE_UA_TOKENS.test(ua);
}

/**
 * Reads the request User-Agent, classifies it as mobile or desktop, and
 * forwards a mutated request to downstream pages with `x-device-variant`
 * set. No rewrite, no redirect — single canonical URL per page (the page
 * reads the header via `headers()` from `next/headers` to pick a variant).
 */
export function middleware(request: NextRequest): NextResponse {
  const ua = request.headers.get('user-agent') ?? '';
  const variant = isMobileUserAgent(ua) ? MOBILE_VARIANT : DESKTOP_VARIANT;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(DEVICE_VARIANT_HEADER, variant);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: [
    // Public routes only. Skip admin, api, Next.js internals, and static assets.
    '/((?!admin|api|_next/static|_next/image|favicon.ico).*)',
  ],
};
