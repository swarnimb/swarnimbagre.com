import Link from 'next/link';
import { SiteHeader } from '@/components/public/SiteHeader';
import { excerptFromContent, formatPostDate } from '@/lib/post-summary';
import type { Post } from '@/lib/types';

/**
 * `/writing` — the post list.
 *
 * Each row links to `/writing/[slug]`. The design export pointed every row
 * back at the list itself, which would have left post bodies unreachable;
 * keeping the detail route was the T46 Q2 decision.
 *
 * The whole row is the link, so the hover arrow and the title recolor are
 * driven by `.lrow:hover` in CSS rather than by state here.
 */

const LEDE =
  'Mostly essays I wrote to figure out what I think. Occasionally a build log. Never a thread.';

const CLOSING =
  'Written between builds. New pieces land here first, usually once a project is finished enough to explain.';

const EMPTY = 'Nothing published yet.';

export function Writing({ posts }: { posts: Post[] }) {
  return (
    <div className="container">
      <SiteHeader />

      <div className="title-block">
        <h1 className="page-title">Writing</h1>
        <p className="page-lede">{LEDE}</p>
      </div>

      {posts.length === 0 ? (
        <p className="page-lede">{EMPTY}</p>
      ) : (
        <section className="lsection">
          {posts.map((post) => (
            <Link className="lrow" key={post.id} href={`/writing/${post.slug}`}>
              <span className="lrow-date">{formatPostDate(post.created_at)}</span>
              <div>
                <h2 className="ltitle">
                  {post.title}
                  <span className="larrow" aria-hidden="true">
                    &rarr;
                  </span>
                </h2>
                <p className="lexcerpt">{excerptFromContent(post.content)}</p>
              </div>
            </Link>
          ))}
        </section>
      )}

      <p className="lclosing">{CLOSING}</p>
    </div>
  );
}
