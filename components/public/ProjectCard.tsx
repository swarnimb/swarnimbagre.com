'use client'

import { useState } from 'react'
import { ProgressRing } from './ProgressRing'
import { TypoIcon } from './TypoIcon'
import { ProjectMedia } from './ProjectMedia'

/**
 * Card-shaped project tile used on the `/projects` grid. T42 Session B
 * replaced the bundle's `StatusPill` header slot with `ProgressRing` and
 * replaced the open `links` array with the three fixed nullable URL
 * fields (`githubUrl`, `liveUrl`, `postUrl`). The media slot is now
 * driven by `imageId` / `imageAfterId` / `thumbKind` rather than the
 * bundle's `demo.kind`/`demo.variant` dummy data — see `ProjectMedia`.
 *
 * CONSTRAINT-05 Override 1.
 */

interface ProjectCardProps {
  /** Display title — required. */
  title: string;
  /** Single-line blurb under the title. */
  blurb: string;
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
  /** Click handler — typically navigates to the project detail page. */
  onClick?: () => void;
}

export function ProjectCard({
  title,
  blurb,
  progressPercent,
  githubUrl,
  liveUrl,
  postUrl,
  imageUrl,
  imageAfterUrl,
  onClick,
}: ProjectCardProps) {
  const [hover, setHover] = useState(false);
  const hasAnyLink = Boolean(githubUrl || liveUrl || postUrl);
  return (
    <article
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: 'var(--surface)',
        border: `1px solid ${hover ? 'var(--hairline-2)' : 'var(--hairline)'}`,
        borderRadius: 6,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        transition: 'border-color var(--dur) var(--ease), transform var(--dur) var(--ease)',
        transform: hover ? 'translateY(-2px)' : 'translateY(0)',
        cursor: onClick ? 'pointer' : 'default',
      }}
      onClick={onClick}
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
        <ProjectMedia imageUrl={imageUrl} imageAfterUrl={imageAfterUrl} title={title} />
      </div>

      <div style={{ padding: '22px 24px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h3
            style={{
              font: '500 24px/1.2 var(--font-serif)',
              color: 'var(--fg-strong)',
              margin: 0,
              letterSpacing: '-0.012em',
              flex: '1 1 auto',
              minWidth: 0,
            }}
          >
            <a
              href="#"
              className="link"
              onClick={(e) => {
                e.preventDefault();
                onClick && onClick();
              }}
            >
              {title}
            </a>
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
              marginTop: 8,
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
