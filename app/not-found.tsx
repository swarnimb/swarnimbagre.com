import Link from 'next/link';
import { SiteHeader } from '@/components/public/SiteHeader';

/**
 * Public 404 — T41.
 *
 * The design export has no 404 page, so per CONSTRAINT-05 nothing here is
 * invented: this is assembled entirely from classes that already exist
 * (`.container`, `.title-block`, `.page-title`, `.page-lede`, `.h-actions`,
 * `.h-btn`) plus the shared `SiteHeader`. No new tokens, no new CSS, no
 * overrides. Same approach `.post-body` took for the post-detail page.
 *
 * `SiteHeader` is the route back out on its own; the two pills below it exist
 * because a 404 is the one page where the way out should not be a menu.
 */
export default function NotFound() {
  return (
    <main className="container">
      <SiteHeader />

      <div className="title-block">
        <h1 className="page-title">Nothing here.</h1>
        <p className="page-lede">
          This URL does not go anywhere. It may have moved, it may have been a
          draft I never published, or it may be a typo, mine or yours. I would
          not rule out mine.
        </p>
      </div>

      <div className="h-actions">
        <Link href="/" className="h-btn h-btn--fill">
          Back to the start
        </Link>
        <Link href="/writing" className="h-btn h-btn--outline">
          Try the writing
        </Link>
      </div>
    </main>
  );
}
