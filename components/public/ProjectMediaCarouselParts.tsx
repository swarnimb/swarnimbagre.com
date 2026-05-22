'use client'

import type { PublicProjectMediaItem } from '@/lib/types'
import { BeforeAfterMedia } from './BeforeAfterMedia'

/**
 * Presentational chrome for `ProjectMediaCarousel` — the slide frame, the
 * before/after pair wrapper with its drag-priority hit zone, the muted
 * caption, and the nav arrow.
 *
 * Extracted from `ProjectMediaCarousel.tsx` at T43.G to keep that file
 * under the 200-line component cap (same split pattern as the CQ-02
 * `BeforeAfterMediaScenes` extraction). embla coordination logic stays in
 * the parent; everything here is pure render styled via bundle tokens.
 *
 * T43.G — CONSTRAINT-05 Override 2.
 */

interface MediaSlideProps {
  item: PublicProjectMediaItem;
  hitZone: number;
  stealDrag: boolean;
}

/**
 * One slide's image frame — a 16/9 letterbox over `var(--bg)`. Pair rows
 * (non-null `imageAfterUrl`) render `BeforeAfterMedia`; otherwise a single
 * `object-fit: contain` `<img>`.
 */
export function MediaSlide({ item, hitZone, stealDrag }: MediaSlideProps) {
  return (
    <div
      style={{
        aspectRatio: '16 / 9',
        position: 'relative',
        background: 'var(--bg)',
        overflow: 'hidden',
      }}
    >
      {item.imageAfterUrl ? (
        <PairSlide item={item} hitZone={hitZone} stealDrag={stealDrag} />
      ) : (
        <img
          src={item.imageUrl ?? ''}
          alt={item.imageAlt}
          loading="lazy"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            display: 'block',
          }}
        />
      )}
    </div>
  );
}

interface PairSlideProps {
  item: PublicProjectMediaItem;
  hitZone: number;
  stealDrag: boolean;
}

/**
 * A before/after pair inside the carousel. The transparent overlay strip
 * (`hitZone`-wide, centered on the divider) intercepts `pointerdown` /
 * `touchstart` / `mousedown` so the divider drag wins over an embla
 * swipe. Outside the strip, gestures reach embla normally.
 */
function PairSlide({ item, hitZone, stealDrag }: PairSlideProps) {
  const stop = (e: { stopPropagation: () => void }) => {
    if (stealDrag) e.stopPropagation();
  };
  return (
    <>
      <BeforeAfterMedia
        beforeUrl={item.imageUrl}
        afterUrl={item.imageAfterUrl}
        altTitle={item.imageAlt}
      />
      <div
        data-divider-hitzone="true"
        onPointerDown={stop}
        onMouseDown={stop}
        onTouchStart={stop}
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: '50%',
          width: hitZone,
          transform: 'translateX(-50%)',
          cursor: 'ew-resize',
        }}
      />
    </>
  );
}

/**
 * Muted prose caption below the image frame. A null `text` collapses the
 * block entirely — no reserved space. The global `.meta-sm` uppercase +
 * letter-spacing is overridden here because captions are prose, not
 * metric labels (precedent: `Footer`).
 */
export function Caption({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <div
      style={{
        font: 'var(--meta-sm)',
        color: 'var(--fg-muted)',
        textTransform: 'none',
        letterSpacing: '0',
        padding: '12px 16px 0',
      }}
    >
      {text}
    </div>
  );
}

interface ArrowProps {
  dir: 'prev' | 'next';
  disabled: boolean;
  size: number;
  hit: number;
  onClick: () => void;
}

/**
 * A single nav arrow. The visible content is the literal `←` / `→` glyph;
 * background is transparent with no fill and no shadow per Override 2.
 */
export function Arrow({ dir, disabled, size, hit, onClick }: ArrowProps) {
  return (
    <button
      type="button"
      aria-label={dir === 'prev' ? 'Previous slide' : 'Next slide'}
      disabled={disabled}
      onClick={onClick}
      style={{
        width: hit,
        height: hit,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        background: 'transparent',
        border: 'none',
        boxShadow: 'none',
        font: `${size}px var(--font-mono)`,
        color: disabled ? 'var(--fg-faint)' : 'var(--fg-muted)',
        cursor: disabled ? 'default' : 'pointer',
        transition: 'color 220ms var(--ease)',
      }}
    >
      {dir === 'prev' ? '←' : '→'}
    </button>
  );
}
