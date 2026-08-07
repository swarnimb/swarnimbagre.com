import type { MetadataRoute } from 'next';
import { getPublishedPosts } from '@/lib/db';
import { safeLoad } from '@/lib/safe-load';
import type { Post } from '@/lib/types';

/**
 * `/sitemap.xml` — T41.
 *
 * The public route set is exactly five surfaces: the four roots below plus
 * `/writing/<slug>`. There is no project detail route — it was deleted in the
 * T46 redesign — so nothing under `/projects/` is emitted.
 *
 * Drafts are excluded twice over, on purpose. `getPublishedPosts` applies
 * `status='published'` inside the query, and this module re-checks the status
 * on every row before emitting a URL. That is redundant everywhere else in the
 * codebase, but this is the one surface that hands URLs to crawlers: a draft
 * that reaches here gets fetched, indexed, and cached by third parties, and no
 * later fix un-publishes it. The cost of the second check is one comparison.
 *
 * `force-dynamic` because `createServerClient` reads request cookies, which is
 * not available during static generation. Every other public route already
 * opts out the same way.
 */
export const dynamic = 'force-dynamic';

const SITE_ORIGIN = 'https://swarnimbagre.com';

/** The four public root routes, in navigation order. */
const ROOT_ROUTES = [
  { path: '/', priority: 1 },
  { path: '/projects', priority: 0.8 },
  { path: '/writing', priority: 0.8 },
  { path: '/other', priority: 0.6 },
] as const;

const POST_PRIORITY = 0.7;

/** Only this status is ever handed to a crawler. */
const PUBLISHED_STATUS = 'published';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // A failed query degrades to "roots only" rather than a 500 on the crawler's
  // request. `safeLoad` logs the failure with full context (CONSTRAINT-14 /
  // EH-01): the sitemap is a page-level boundary, so this is the sanctioned
  // place for a catch.
  const posts = await safeLoad<Post[]>(
    () => getPublishedPosts(),
    [],
    'route:sitemap',
  );

  const now = new Date();

  const roots: MetadataRoute.Sitemap = ROOT_ROUTES.map((route) => ({
    url: `${SITE_ORIGIN}${route.path}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: route.priority,
  }));

  const postEntries: MetadataRoute.Sitemap = posts
    .filter((post) => post.status === PUBLISHED_STATUS)
    .map((post) => ({
      url: `${SITE_ORIGIN}/writing/${post.slug}`,
      lastModified: new Date(post.updated_at),
      changeFrequency: 'monthly',
      priority: POST_PRIORITY,
    }));

  return [...roots, ...postEntries];
}
