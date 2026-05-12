import {
  createServerClient as createSSRServerClient,
  createBrowserClient as createSSRBrowserClient,
} from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Build a Supabase client bound to the current request's cookies for use
 * inside Server Components, Route Handlers, and Server Actions.
 *
 * Next 15 made `cookies()` async, so this factory is async too. The `setAll`
 * callback is wrapped in try/catch because Server Component cookies are
 * read-only — middleware refreshes the session, making the no-op safe here.
 *
 * The auth client is configured with `flowType: 'implicit'` (F-15 mitigation).
 * `@supabase/ssr` defaults to PKCE, which writes a `*-code-verifier` Set-Cookie
 * header when `signInWithOtp` is invoked. The PKCE cookie is only written on
 * the call-Supabase branch of `signInWithMagicLink`, so its presence
 * distinguishes the allowlisted path from the throw-and-skip path at the
 * HTTP-header level — a single-probe enumeration channel orthogonal to the
 * F-12/F-13 closures. Implicit flow does not emit that cookie. The magic-link
 * callback at `app/(admin)/admin/auth/callback/route.ts` consumes the
 * `?token_hash=&type=` shape via `verifyOtp`, which is not PKCE-dependent, so
 * the change has no effect on the production callback path. The PKCE-shaped
 * `?code=` branch in the callback becomes dead under the current single-user
 * magic-link-only model but is intentionally retained for the future-OAuth
 * path documented in `docs/auth-flow.md`. See `docs/security-report.md` audit
 * 3 finding F-15.
 *
 * @returns A request-scoped Supabase client.
 * @throws  If `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`
 *          is missing at runtime (the non-null assertions will throw).
 */
export async function createServerClient() {
  const cookieStore = await cookies();
  return createSSRServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: 'implicit',
      },
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // RSC cookies are read-only. Middleware refreshes sessions; this no-op is safe.
          }
        },
      },
    },
  );
}

/**
 * Build a Supabase client for use in browser-side client components.
 *
 * Reads the same public env vars as {@link createServerClient}. No cookie
 * adapter is required here — the SSR helper manages browser storage itself.
 *
 * @returns A browser-scoped Supabase client.
 */
export function createBrowserClient() {
  return createSSRBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
