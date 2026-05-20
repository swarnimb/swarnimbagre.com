'use client';

import { ReactNode } from 'react';
import { ProgressRing } from '../ProgressRing';
import { TypoIcon } from '../TypoIcon';

/**
 * Compact project row used on mobile list surfaces. Bundle structure
 * preserved: numeric `index` label, title + status slot, blurb beneath,
 * no grid column for a thumbnail (the bundle mobile row has no thumb).
 *
 * T42 Session C replaced the bundle's `StatusPill` slot with
 * `ProgressRing` and added the three fixed nullable URL fields
 * (`githubUrl`, `liveUrl`, `postUrl`) rendered as `TypoIcon` only when
 * the URL is non-null. When all three are null, the link row is hidden.
 *
 * CONSTRAINT-05 Override 1 — same scope as the desktop row.
 */

interface MobileProjectRowProps {
  /** Display index — rendered as a zero-padded two-digit label. */
  index: number;
  /** Display title — required. */
  title: ReactNode;
  /** Single-line blurb under the title. */
  blurb: ReactNode;
  /** Optional progress 0–100. Null/undefined hides the ring. */
  progressPercent?: number | null;
  /** External GitHub URL. Null/undefined hides the github icon. */
  githubUrl?: string | null;
  /** External live-site URL. Null/undefined hides the live icon. */
  liveUrl?: string | null;
  /** Write-up URL. Null/undefined hides the post icon. */
  postUrl?: string | null;
  /** Click handler — typically navigates to the project detail page. */
  onClick?: () => void;
}

export function MobileProjectRow({
  index,
  title,
  blurb,
  progressPercent,
  githubUrl,
  liveUrl,
  postUrl,
  onClick,
}: MobileProjectRowProps) {
  const hasAnyLink = Boolean(githubUrl || liveUrl || postUrl);
  return (
    <article
      onClick={onClick}
      style={{
        padding: '16px 0',
        borderBottom: '1px solid var(--hairline)',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div
        style={{
          font: 'var(--meta-sm)',
          color: 'var(--fg-faint)',
          letterSpacing: '0.14em',
          marginBottom: 6,
        }}
      >
        {String(index).padStart(2, '0')}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <h3
          style={{
            font: '500 22px/1.2 var(--font-serif)',
            color: 'var(--fg-strong)',
            margin: 0,
            letterSpacing: '-0.012em',
            flex: '1 1 auto',
            minWidth: 0,
          }}
        >
          {title}
        </h3>
        {progressPercent !== null && progressPercent !== undefined && (
          <span style={{ marginLeft: 'auto', flex: '0 0 auto', display: 'inline-flex', alignItems: 'center' }}>
            <ProgressRing percent={progressPercent} />
          </span>
        )}
      </div>
      <p
        style={{
          font: 'var(--body)',
          color: 'var(--fg-muted)',
          margin: '8px 0 0',
          textWrap: 'pretty',
        }}
      >
        {blurb}
      </p>
      {hasAnyLink && (
        <div
          style={{
            display: 'flex',
            gap: 18,
            marginTop: 12,
            flexWrap: 'wrap',
            alignItems: 'baseline',
          }}
        >
          {githubUrl && <TypoIcon kind="github" href={githubUrl} />}
          {liveUrl && <TypoIcon kind="live" href={liveUrl} />}
          {postUrl && <TypoIcon kind="post" href={postUrl} />}
        </div>
      )}
    </article>
  );
}
