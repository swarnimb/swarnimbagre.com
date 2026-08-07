'use client';

import Link from 'next/link';
import { SiteHeader } from '@/components/public/SiteHeader';

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
 * `.page-title`, `.page-lede`, `.meta`, `.h-actions`, `.h-btn`), and the only
 * inline values are existing spacing tokens, the same idiom
 * `app/writing/[slug]/page.tsx` already uses.
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
          unedited. Better than pretending the page is empty on purpose.
          Nothing here reports errors to me automatically, so it stays broken
          until I notice.
        </p>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-2)',
            marginTop: 'var(--space-5)',
          }}
        >
          <p className="meta">
            {error.message || 'No error message was provided.'}
          </p>
          {error.digest ? <p className="meta">Digest: {error.digest}</p> : null}
        </div>
      </div>

      <div className="h-actions">
        <button type="button" className="h-btn h-btn--fill" onClick={() => reset()}>
          Try again
        </button>
        <Link href="/" className="h-btn h-btn--outline">
          Back to the start
        </Link>
      </div>
    </main>
  );
}
