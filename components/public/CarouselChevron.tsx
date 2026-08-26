/**
 * Chevron mark for the carousel and lightbox navigation buttons.
 *
 * Replaces the `&lsaquo;` / `&rsaquo;` characters these buttons used to
 * render. Those are typographic quotation marks, not navigation glyphs: their
 * shape, weight and optical centring all shift with whatever font resolves,
 * and in Space Grotesk they sit high and read thin at 22px.
 *
 * Stroke width 2 with round caps and joins, matching the weight the design
 * export uses for its own inline SVGs (see `SocialIcons`). `currentColor`
 * keeps the colour in CSS, so `.sb-arrow` can invert it on hover without the
 * icon knowing anything about the palette.
 *
 * `aria-hidden` because the button already carries an accessible label.
 */
export function CarouselChevron({
  direction,
}: {
  direction: 'prev' | 'next';
}) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <polyline points={direction === 'prev' ? '14 6 8 12 14 18' : '10 6 16 12 10 18'} />
    </svg>
  );
}
