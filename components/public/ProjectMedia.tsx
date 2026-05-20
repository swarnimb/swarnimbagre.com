'use client'

import { BeforeAfterMedia } from './BeforeAfterMedia'

/**
 * Media slot for a project card. T42 Session B removed the bundle's
 * `DemoLoop` / `StillMedia` animated-scene branches from the data path —
 * the public site now renders real screenshots (or a before/after slider
 * over two real screenshots).
 *
 * Branching:
 *   - both `imageUrl` and `imageAfterUrl` present → before/after slider
 *     via the existing `BeforeAfterMedia` component.
 *   - only `imageUrl` present → static `<img>`.
 *   - neither present → render nothing. Empty media slot is acceptable
 *     for projects added before screenshots are uploaded; the surrounding
 *     `ProjectCard` background fills the gap.
 *
 * URLs are pre-resolved at the page-level Server Component using
 * `getImageById` + `getImageUrl` so this client component never touches
 * Storage directly. CONSTRAINT-05 Override 1.
 */

interface ProjectMediaProps {
  /** Signed Storage URL for the primary screenshot, pre-resolved by the page. */
  imageUrl?: string | null;
  /** Signed Storage URL for the after-screenshot, pre-resolved by the page. */
  imageAfterUrl?: string | null;
  /** Project title — used as the alt text on the rendered `<img>`. */
  title?: string;
}

/**
 * Render the appropriate media branch for a project card.
 *
 * Note: the legacy props `kind` and `variant` (driven by the bundle's
 * `DemoLoop` system) are intentionally absent. Callers must migrate to
 * `imageUrl` / `imageAfterUrl` (T42 Session B).
 */
export function ProjectMedia({ imageUrl, imageAfterUrl, title = '' }: ProjectMediaProps) {
  if (imageUrl && imageAfterUrl) {
    return <BeforeAfterMedia beforeUrl={imageUrl} afterUrl={imageAfterUrl} altTitle={title} />;
  }
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={title}
        loading="lazy"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
        }}
      />
    );
  }
  return null;
}
