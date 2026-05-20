'use client'

import { useState } from 'react'
import { ProjectThumb } from './ProjectThumb'
import { ProgressRing } from './ProgressRing'
import { TypoIcon } from './TypoIcon'

/**
 * Single horizontal project row used on Home (scroller) and similar list
 * surfaces. T42 Session B replaced the bundle's `StatusPill` slot with
 * `ProgressRing` (driven by `progress_percent`) and replaced the
 * open-form `links` array with three fixed conditional URL fields
 * (`githubUrl`, `liveUrl`, `postUrl`) so the component renders straight
 * off DB columns rather than through a hand-shaped link array.
 *
 * Each of the three URL fields is rendered as a `TypoIcon` only when the
 * URL is non-null. When all three are null, the link row is hidden
 * entirely. This matches CONSTRAINT-05 Override 1: same visual lexicon
 * as the bundle, sourced from real data instead of bundle dummy data.
 */

interface ProjectRowProps {
  /** Display title — the only required field. */
  title: string;
  /** Single-line blurb under the title. */
  blurb: string;
  /** Optional progress 0–100. Null/undefined hides the ring. */
  progressPercent?: number | null;
  /** External GitHub URL. Null/undefined hides the github icon. */
  githubUrl?: string | null;
  /** External live-site URL. Null/undefined hides the live icon. */
  liveUrl?: string | null;
  /** Internal or external write-up URL. Null/undefined hides the post icon. */
  postUrl?: string | null;
  /** Thumbnail motif key — see `lib/thumb-kinds.ts`. Falls back to `dots`. */
  thumbKind?: string | null;
  /** Click handler — typically navigates to the project detail page. */
  onClick?: () => void;
}

export function ProjectRow({
  title,
  blurb,
  progressPercent,
  githubUrl,
  liveUrl,
  postUrl,
  thumbKind,
  onClick,
}: ProjectRowProps) {
  const [hover, setHover] = useState(false);
  const hasAnyLink = Boolean(githubUrl || liveUrl || postUrl);
  return (
    <article
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: '72px 1fr',
        gap: 24,
        padding: '28px 0',
        borderBottom: '1px solid var(--hairline)',
        alignItems: 'center',
        transition: 'border-color var(--dur) var(--ease)',
        borderBottomColor: hover ? 'var(--hairline-2)' : 'var(--hairline)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
        <ProjectThumb kind={thumbKind ?? undefined} size={56} />
      </div>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <h3
            style={{
              font: '500 24px/1.25 var(--font-serif)',
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
            <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center' }}>
              <ProgressRing percent={progressPercent} />
            </span>
          )}
        </div>
        <p
          style={{
            font: 'var(--body)',
            color: 'var(--fg-muted)',
            margin: '8px 0 0',
            maxWidth: 620,
            textWrap: 'pretty',
          }}
        >
          {blurb}
        </p>
        {hasAnyLink && (
          <div style={{ display: 'flex', gap: 18, marginTop: 14, alignItems: 'baseline', flexWrap: 'wrap' }}>
            {githubUrl && <TypoIcon kind="github" href={githubUrl} />}
            {liveUrl && <TypoIcon kind="live" href={liveUrl} />}
            {postUrl && <TypoIcon kind="post" href={postUrl} />}
          </div>
        )}
      </div>
    </article>
  );
}
