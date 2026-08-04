import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPostBySlug } from '@/lib/db';
import { safeLoad } from '@/lib/safe-load';
import type { Post } from '@/lib/types';
import { SiteHeader } from '@/components/public/SiteHeader';
import { MarkdownContent } from '@/components/public/MarkdownContent';
import { formatPostDate } from '@/lib/post-summary';

const SITE_ORIGIN = 'https://swarnimbagre.com';
const DESCRIPTION_MAX = 160;
const BODY_MAX = 720;
const WRITING_INDEX_PATH = '/writing';

export const dynamic = 'force-dynamic';

interface DetailParams {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: DetailParams): Promise<Metadata> {
  const { slug } = await params;
  const post = await safeLoad<Post | null>(
    () => getPostBySlug(slug),
    null,
    'metadata:writing/[slug]',
  );
  if (!post) {
    return { title: 'Post not found — Swarnim Bagre' };
  }
  return {
    title: `${post.title} — Swarnim Bagre`,
    description: deriveDescription(post.content),
    alternates: { canonical: `${SITE_ORIGIN}/writing/${post.slug}` },
  };
}

/**
 * `/writing/[slug]` — the post body.
 *
 * T46 rebuilt this on the shared shell. The desktop/mobile fork is gone, as
 * is the footer; the page is now header, back link, date, title, body.
 *
 * This route is the reason the T46 Q2 decision kept detail pages at all: it
 * is where post bodies live, and it is the target of every project card's
 * "Writeup" action.
 */
export default async function PostDetailPage({ params }: DetailParams) {
  const { slug } = await params;
  const post = await safeLoad<Post | null>(
    () => getPostBySlug(slug),
    null,
    'page:writing/[slug]',
  );
  if (!post) notFound();

  return (
    <div className="container">
      <SiteHeader />

      <header style={{ maxWidth: BODY_MAX, marginBottom: 'var(--mb-title)' }}>
        <Link
          href={WRITING_INDEX_PATH}
          className="lrow-date"
          style={{ display: 'inline-block', padding: 0 }}
        >
          &larr; writing
        </Link>

        <div
          className="lrow-date"
          style={{ display: 'block', marginTop: 24, padding: 0 }}
        >
          {formatPostDate(post.created_at)}
        </div>

        <h1 className="page-title" style={{ marginTop: 12, marginBottom: 0 }}>
          {post.title}
        </h1>
      </header>

      <div style={{ maxWidth: BODY_MAX }}>
        <MarkdownContent md={post.content} className="post-body" />
      </div>
    </div>
  );
}

function deriveDescription(content: string): string {
  const firstPara = content.split(/\n\s*\n/)[0] ?? '';
  const clean = firstPara.replace(/\s+/g, ' ').trim();
  if (clean.length <= DESCRIPTION_MAX) return clean;
  return `${clean.slice(0, DESCRIPTION_MAX - 1).trimEnd()}…`;
}
