'use client';

import { ReactNode } from 'react';
import { ProgressRing } from '../ProgressRing';
import { TypoIcon } from '../TypoIcon';
import { ProjectMedia } from '../ProjectMedia';
import type { PublicProjectMediaItem } from '@/lib/types';

/**
 * Full-width single-column project card used on the mobile `/projects`
 * stack and the mobile detail page. T42 Session C mirrors the desktop
 * `ProjectCard` work from Session B: replaced the bundle's `StatusPill`
 * header slot with `ProgressRing` (driven by `progressPercent`) and
 * replaced the open `links` array with the three fixed nullable URL
 * fields (`githubUrl`, `liveUrl`, `postUrl`). The media slot is driven
 * by `imageUrl` / `imageAfterUrl` via `ProjectMedia`.
 *
 * CONSTRAINT-05 Override 1 — same scope as the desktop card.
 */

interface MobileProjectCardProps {
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
  /** Signed Storage URL for the primary screenshot. Pre-resolved by the page. */
  imageUrl?: string | null;
  /** Signed Storage URL for the after-screenshot (enables before/after slider). */
  imageAfterUrl?: string | null;
  /**
   * Ordered `project_media` rows. When present with at least one item the
   * card's media slot renders the carousel; when omitted the legacy
   * `imageUrl` / `imageAfterUrl` branches run unchanged.
   */
  media?: PublicProjectMediaItem[];
  /** Surface context passed through to the media slot for carousel sizing. */
  view?: 'list' | 'detail';
  /** Click handler — typically navigates to the project detail page. */
  onClick?: () => void;
}

export function MobileProjectCard({
  title,
  blurb,
  progressPercent,
  githubUrl,
  liveUrl,
  postUrl,
  imageUrl,
  imageAfterUrl,
  media,
  view,
  onClick,
}: MobileProjectCardProps) {
  const hasAnyLink = Boolean(githubUrl || liveUrl || postUrl);
  return (
    <article
      onClick={onClick}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--hairline)',
        borderRadius: 8,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div
        style={{
          aspectRatio: '16 / 9',
          position: 'relative',
          background: 'var(--bg)',
          borderBottom: '1px solid var(--hairline)',
          overflow: 'hidden',
        }}
      >
        <ProjectMedia
          imageUrl={imageUrl}
          imageAfterUrl={imageAfterUrl}
          title={typeof title === 'string' ? title : ''}
          media={media}
          view={view}
        />
      </div>
      <div style={{ padding: '18px 18px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
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
            margin: 0,
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
              marginTop: 6,
              paddingTop: 14,
              borderTop: '1px solid var(--hairline)',
              flexWrap: 'wrap',
              alignItems: 'baseline',
            }}
          >
            {githubUrl && <TypoIcon kind="github" href={githubUrl} />}
            {liveUrl && <TypoIcon kind="live" href={liveUrl} />}
            {postUrl && <TypoIcon kind="post" href={postUrl} />}
          </div>
        )}
      </div>
    </article>
  );
}
