import Link from 'next/link';
import { SiteHeader } from '@/components/public/SiteHeader';

/**
 * Public 404 — T41.
 *
 * The design export has no 404 page, so per CONSTRAINT-05 nothing here is
 * invented: this is assembled entirely from classes that already exist
 * (`.container`, `.title-block`, `.page-title`, `.page-lede`, `.sb-actions`,
 * `.sb-action`) plus the shared `SiteHeader`. No new tokens, no new CSS, no
 * overrides. Same approach `.post-body` took for the post-detail page.
 *
 * Standing rule: system pages (404, error boundaries, any future
 * `loading.tsx`) compose the shared shell — `.container` + `SiteHeader` +
 * `.title-block` / `.page-title` / `.page-lede` — plus `.sb-action`. The
 * `h-*` classes are home-only and never leave the home page: they ARE home's
 * navigation (`app/styles/public-home.css:5-6`), since home is the only page
 * without nav in its header, and they carry no `min-height`, computing to
 * ~35px desktop / ~31.5px mobile. `.sb-action` is 44px, dropping to 42px at
 * the 640px breakpoint. On a dead-end page the action row is the only escape
 * route, so the 44px target is the correct one.
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

      <div className="sb-actions">
        <Link href="/" className="sb-action sb-action--primary">
          Back to the start
        </Link>
        <Link href="/writing" className="sb-action sb-action--secondary">
          Try the writing
        </Link>
      </div>
    </main>
  );
}
