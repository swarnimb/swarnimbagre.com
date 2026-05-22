'use client'

import { BeforeAfterMedia } from './BeforeAfterMedia'
import { ProjectMediaCarousel } from './ProjectMediaCarousel'
import type { PublicProjectMediaItem } from '@/lib/types'

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
  /**
   * Ordered `project_media` rows, pre-resolved to signed URLs (T43.D). When
   * present with at least one item, the carousel renders instead of the
   * legacy `imageUrl` / `imageAfterUrl` branches. When omitted or empty, the
   * legacy branches run unchanged (CONSTRAINT-05 backward-compat).
   */
  media?: PublicProjectMediaItem[];
  /** Surface context passed through to the carousel for dot / arrow sizing. */
  view?: 'list' | 'detail';
}

/**
 * Render the appropriate media branch for a project card.
 *
 * Note: the legacy props `kind` and `variant` (driven by the bundle's
 * `DemoLoop` system) are intentionally absent. Callers must migrate to
 * `imageUrl` / `imageAfterUrl` (T42 Session B).
 */
export function ProjectMedia({ imageUrl, imageAfterUrl, title = '', media, view = 'list' }: ProjectMediaProps) {
  if (media && media.length > 0) {
    return <ProjectMediaCarousel media={media} ariaLabel={`${title} media`} view={view} />;
  }
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
