import type { Metadata } from 'next';
import { Writing } from '@/components/public/pages/Writing';
import { getPublishedPosts } from '@/lib/db';
import { safeLoad } from '@/lib/safe-load';
import type { Post } from '@/lib/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Writing — Swarnim Bagre',
  description:
    'Mostly essays I wrote to figure out what I think. Occasionally a build log. Never a thread.',
  alternates: {
    canonical: 'https://swarnimbagre.com/writing',
  },
};

/**
 * T46: date formatting and excerpt derivation moved to lib/post-summary.ts.
 * They were defined inline here and again in the mobile page; the list
 * component now calls the shared helpers directly, so rows are passed
 * through unmapped.
 */
export default async function WritingPage() {
  const posts = await safeLoad<Post[]>(
    () => getPublishedPosts(),
    [],
    'page:writing',
  );
  return <Writing posts={posts} />;
}
