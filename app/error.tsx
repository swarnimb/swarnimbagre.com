'use client';

import Link from 'next/link';
import { SiteHeader } from '@/components/public/SiteHeader';
import { SOCIAL_LINKS } from '@/lib/social-links';

/**
 * Public-route error boundary — T41.
 *
 * Same LOUD posture as `app/(admin)/error.tsx`: the message and digest are
 * printed verbatim rather than swallowed behind a generic apology, and the
 * boundary offers a retry wired to `reset()`. The styling is the public site's,
 * not shadcn — shadcn is admin-only.
 *
 * The design export has no error page, so per CONSTRAINT-05 nothing here is
 * invented. Every class already exists (`.container`, `.title-block`,
 * `.page-title`, `.page-lede`, `.meta`, `.sb-actions`, `.sb-action`), and the
 * only inline values are existing spacing tokens plus a one-off
 * `overflow-wrap` on the runtime message, the same idiom
 * `app/writing/[slug]/page.tsx` already uses.
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
 */
export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.ReactElement {
  return (
    <main className="container" role="alert">
      <SiteHeader />

      <div className="title-block">
        <h1 className="page-title">This page broke.</h1>
        <p className="page-lede">
          Something threw while this page was rendering. The details are below,
          unedited. Nothing here reports errors to me automatically, so it
          stays broken until I notice. If you want to speed that up:{' '}
          <a href={SOCIAL_LINKS.email}>
            {SOCIAL_LINKS.email.replace('mailto:', '')}
          </a>
        </p>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-2)',
            marginTop: 'var(--space-5)',
          }}
        >
          <p style={{ overflowWrap: 'anywhere' }}>
            {error.message || 'No error message was provided.'}
          </p>
          {error.digest ? <p className="meta">Digest: {error.digest}</p> : null}
        </div>
      </div>

      <div className="sb-actions">
        <button
          type="button"
          className="sb-action sb-action--primary"
          onClick={() => reset()}
        >
          Try again
        </button>
        <Link href="/" className="sb-action sb-action--secondary">
          Back to the start
        </Link>
      </div>
    </main>
  );
}
