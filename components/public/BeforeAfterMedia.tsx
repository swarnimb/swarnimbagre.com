'use client'

import { useState, useEffect, useRef } from 'react'

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

function renderBundleBefore() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(180deg, #2a231a, #1c1712)',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ font: '500 10px var(--font-mono)', color: '#7A7060', letterSpacing: 2 }}>
        BEFORE · SPREADSHEET
      </div>
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          style={{
            display: 'grid',
            gridTemplateColumns: '60px 1fr 50px',
            gap: 6,
            padding: '4px 6px',
            background: i % 2 ? 'rgba(255,255,255,0.02)' : 'transparent',
            font: '400 10px var(--font-mono)',
            color: '#7A7060',
            borderBottom: '1px solid #2E2820',
          }}
        >
          <span>{`R${i + 1}`}</span>
          <span style={{ color: '#E8E0D0' }}>match {i + 11}</span>
          <span style={{ textAlign: 'right' }}>{['L', 'L', 'W', 'L', 'L'][i]}</span>
        </div>
      ))}
    </div>
  );
}

function renderBundleAfter(_variant: string | undefined) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse at 70% 30%, #2a231a, #1c1712 70%)',
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ font: '500 10px var(--font-mono)', color: '#A8C078', letterSpacing: 2 }}>
        AFTER · APP
      </div>
      <div style={{ font: '400 italic 22px/1 var(--font-serif)', color: '#F4ECDC' }}>4 – 11</div>
      <div style={{ font: '400 11px/1.4 var(--font-sans)', color: '#7A7060' }}>
        this season, generously counted
      </div>
      <svg viewBox="0 0 200 50" style={{ width: '100%', marginTop: 'auto' }}>
        <polyline
          points="0,40 30,32 60,36 90,22 120,28 150,14 180,18 200,8"
          fill="none"
          stroke="#C9A84C"
          strokeWidth="1.5"
        />
      </svg>
    </div>
  );
}
