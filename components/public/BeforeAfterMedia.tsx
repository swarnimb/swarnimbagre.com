'use client'

import { useState, useEffect, useRef } from 'react'
import { renderBundleBefore, renderBundleAfter } from './BeforeAfterMediaScenes'

/**
 * Drag-to-compare slider showing two screenshots.
 *
 * T42 Session B extended the original bundle component (which rendered
 * hardcoded CSS scenes) to accept real signed Storage URLs via
 * `beforeUrl` / `afterUrl`. When URLs are supplied (the public-site path
 * after T42), the slider clips real `<img>` elements. When they are
 * absent, the original bundle `variant` scenes still render — preserved
 * for the design source `/docs/design-source/` and any non-DB caller.
 *
 * T43.G (CQ-02) extracted the CSS-drawn placeholder scenes into
 * `BeforeAfterMediaScenes.tsx` to keep this file under the 200-line
 * component cap. The drag math, divider, handle, and real-image path are
 * unchanged — a pure internal split.
 *
 * CONSTRAINT-05 Override 1.
 */

interface BeforeAfterMediaProps {
  /** Bundle variant key. Only used when `beforeUrl`/`afterUrl` are absent. */
  variant?: string;
  /** Signed Storage URL for the "before" image. */
  beforeUrl?: string | null;
  /** Signed Storage URL for the "after" image. */
  afterUrl?: string | null;
  /** Title for alt text on real images. Required for accessibility. */
  altTitle?: string;
}

/**
 * The slider position update — pulled out so both pointer and touch
 * handlers run the same clamping logic.
 */
function computePosition(clientX: number, rect: DOMRect): number {
  const x = clientX - rect.left;
  const pct = (x / rect.width) * 100;
  return Math.max(MIN_POSITION_PERCENT, Math.min(MAX_POSITION_PERCENT, pct));
}

/** Lowest slider position in percent. Matches bundle clamp. */
const MIN_POSITION_PERCENT = 4;

/** Highest slider position in percent. Matches bundle clamp. */
const MAX_POSITION_PERCENT = 96;

/** Initial slider position in percent — centered. */
const INITIAL_POSITION_PERCENT = 50;

export function BeforeAfterMedia({ variant, beforeUrl, afterUrl, altTitle = '' }: BeforeAfterMediaProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState(INITIAL_POSITION_PERCENT);
  const [drag, setDrag] = useState(false);

  useEffect(() => {
    if (!drag) return;
    const move = (e: MouseEvent | TouchEvent) => {
      const el = ref.current;
      if (!el) return;
      const touchX = (e as TouchEvent).touches?.[0]?.clientX;
      const clientX = touchX ?? (e as MouseEvent).clientX;
      setPos(computePosition(clientX, el.getBoundingClientRect()));
    };
    const up = () => setDrag(false);
    window.addEventListener('mousemove', move);
    window.addEventListener('touchmove', move);
    window.addEventListener('mouseup', up);
    window.addEventListener('touchend', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchend', up);
    };
  }, [drag]);

  const startDrag = (clientX: number) => {
    const el = ref.current;
    if (!el) return;
    setDrag(true);
    setPos(computePosition(clientX, el.getBoundingClientRect()));
  };

  const useRealImages = Boolean(beforeUrl && afterUrl);
  const before = useRealImages
    ? renderRealImage(beforeUrl!, `${altTitle} (before)`)
    : renderBundleBefore();
  const after = useRealImages
    ? renderRealImage(afterUrl!, `${altTitle} (after)`)
    : renderBundleAfter(variant);

  return (
    <div
      ref={ref}
      onMouseDown={(e) => startDrag(e.clientX)}
      onTouchStart={(e) => startDrag(e.touches[0].clientX)}
      style={{ position: 'absolute', inset: 0, cursor: 'ew-resize', userSelect: 'none' }}
    >
      {before}
      <div style={{ position: 'absolute', inset: 0, clipPath: `inset(0 0 0 ${pos}%)` }}>
        {after}
      </div>
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: `${pos}%`,
          width: 1,
          background: 'var(--accent)',
          boxShadow: '0 0 0 3px var(--accent-glow)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: `${pos}%`,
          transform: 'translate(-50%, -50%)',
          width: 26,
          height: 26,
          borderRadius: 999,
          background: 'var(--bg)',
          border: '1px solid var(--accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          font: '500 10px var(--font-mono)',
          color: 'var(--accent)',
          pointerEvents: 'none',
        }}
      >
        {/* Bundle uses the unicode left-right-arrows glyph — kept verbatim. */}
        ⇆
      </div>
    </div>
  );
}

function renderRealImage(url: string, alt: string) {
  return (
    <img
      src={url}
      alt={alt}
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
