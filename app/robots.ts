import type { MetadataRoute } from 'next';

/**
 * `/robots.txt` — T41.
 *
 * Crawlers are welcome on the public site and nowhere else. `/admin` is behind
 * Supabase Auth and `/api` is machine surface, so neither belongs in an index;
 * disallowing them is a hygiene measure, not a security control — the auth
 * middleware is what actually gates them.
 *
 * The origin is inlined rather than read from env, matching the `canonical`
 * values already hardcoded on every public page (`app/page.tsx`,
 * `app/projects/page.tsx`, `app/writing/page.tsx`, `app/other/page.tsx`,
 * `app/writing/[slug]/page.tsx`). One apex, one string, no config to drift.
 */
const SITE_ORIGIN = 'https://swarnimbagre.com';

/** Route prefixes that must never be crawled or indexed. */
const DISALLOWED_PATHS = ['/admin', '/api'];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: DISALLOWED_PATHS,
    },
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
    host: SITE_ORIGIN,
  };
}
