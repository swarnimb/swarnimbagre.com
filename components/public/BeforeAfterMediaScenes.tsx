'use client'

/**
 * Design-time CSS-drawn placeholder scenes for `BeforeAfterMedia`.
 *
 * The original bundle component rendered these hardcoded "spreadsheet →
 * app" mock scenes. After T42 the public-site data path always supplies
 * real signed Storage URLs, so these scenes only render for the design
 * source (`/docs/design-source/`) and any non-DB caller that omits
 * `beforeUrl` / `afterUrl`.
 *
 * Extracted from `BeforeAfterMedia.tsx` at T43.G (CQ-02) to keep that
 * file under the 200-line component cap. This is a pure internal split —
 * the visual output of `renderBundleBefore` / `renderBundleAfter` is
 * byte-identical to the pre-split implementation.
 *
 * CONSTRAINT-05 Override 1.
 */

/** The CSS-drawn "before" scene — a faux spreadsheet of match rows. */
export function renderBundleBefore() {
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

/** The CSS-drawn "after" scene — a faux app summary with a trend line. */
export function renderBundleAfter(_variant: string | undefined) {
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
