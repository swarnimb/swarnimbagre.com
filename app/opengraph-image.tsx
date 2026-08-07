import { ImageResponse } from 'next/og';

/**
 * Site-wide Open Graph / Twitter card image — T41.
 *
 * Composed from the T46 palette only: cream ground (`--bg` #F4F1EA), the
 * deep-green accent (`--accent` #1F3D2F), and the two text greys
 * (`--fg-strong` #16140E, `--fg-muted` #837D70). No new colors.
 *
 * FONTS: `next/font` cannot be used inside `ImageResponse` — the loader hands
 * back a CSS class, and Satori needs the raw font bytes. The documented way in
 * is to fetch the TTF at render time. That is a network call on an external
 * host, so every fetch is guarded: if Google Fonts is slow, blocked, or
 * changes its response shape, `loadGoogleFont` returns `null`, that family is
 * simply not registered, and Satori falls back to its bundled sans. The card
 * then renders with the right palette and layout and the wrong typeface —
 * which is a worse card, not a broken build or a 500 on a crawler's request.
 */
export const alt = 'Swarnim Bagre: projects, writing, and assorted hobby stats';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const WORDMARK = 'Swarnim Bagre';
const LEDE =
  'Projects, writing, and assorted hobby stats. Built by someone figuring it out in public.';

/** T46 palette, verbatim from `app/styles/colors_and_type.css`. */
const BG = '#F4F1EA';
const ACCENT = '#1F3D2F';
const FG_STRONG = '#16140E';
const FG_MUTED = '#837D70';

/**
 * Fetch one Google font as raw TTF bytes for Satori.
 *
 * @param family Google Fonts family name, e.g. `'Instrument Serif'`.
 * @param text   Glyph subset to request. Keeps the payload to the characters
 *               actually drawn on the card.
 * @returns The font bytes, or `null` if anything at all went wrong. Callers
 *          must treat `null` as "render without this family".
 */
async function loadGoogleFont(
  family: string,
  text: string,
): Promise<ArrayBuffer | null> {
  try {
    const query = `family=${encodeURIComponent(family)}&text=${encodeURIComponent(text)}`;
    const cssResponse = await fetch(`https://fonts.googleapis.com/css2?${query}`);
    if (!cssResponse.ok) {
      throw new Error(`css2 responded ${cssResponse.status}`);
    }
    const css = await cssResponse.text();
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    if (!url) {
      throw new Error('no truetype src in css2 response');
    }
    const fontResponse = await fetch(url);
    if (!fontResponse.ok) {
      throw new Error(`font responded ${fontResponse.status}`);
    }
    return await fontResponse.arrayBuffer();
  } catch (error) {
    // Loud, but non-fatal: the card still renders, in the fallback face.
    console.error('[opengraph-image] font load failed', {
      family,
      errorName: error instanceof Error ? error.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : new Error().stack,
    });
    return null;
  }
}

export default async function OpengraphImage(): Promise<ImageResponse> {
  const [serif, sans] = await Promise.all([
    loadGoogleFont('Instrument Serif', WORDMARK),
    loadGoogleFont('Space Grotesk', LEDE),
  ]);

  const fonts = [
    serif
      ? { name: 'Instrument Serif', data: serif, style: 'normal' as const, weight: 400 as const }
      : null,
    sans
      ? { name: 'Space Grotesk', data: sans, style: 'normal' as const, weight: 400 as const }
      : null,
  ].filter((font) => font !== null);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          background: BG,
          padding: '96px 104px',
        }}
      >
        <div
          style={{
            width: 96,
            height: 4,
            background: ACCENT,
            marginBottom: 56,
          }}
        />
        <div
          style={{
            fontFamily: 'Instrument Serif, serif',
            fontSize: 132,
            lineHeight: 1,
            color: FG_STRONG,
          }}
        >
          {WORDMARK}
        </div>
        <div
          style={{
            fontFamily: 'Space Grotesk, sans-serif',
            fontSize: 34,
            lineHeight: 1.45,
            color: FG_MUTED,
            marginTop: 36,
            maxWidth: 820,
          }}
        >
          {LEDE}
        </div>
      </div>
    ),
    { ...size, fonts: fonts.length > 0 ? fonts : undefined },
  );
}
