'use client';

import Image from 'next/image';
import { useRef, useState } from 'react';
import type { PublicProjectMediaItem } from '@/lib/types';
import { ImageLightbox } from './ImageLightbox';
import {
  SWIPE_THRESHOLD_PX,
  toLightboxSlides,
  toSlides,
  wrapIndex,
} from '@/lib/lightbox-slides';
import { useRestoreFocus } from '@/lib/use-restore-focus';

/**
 * The media frame at the top of a project card.
 *
 * Hand-rolled rather than embla-backed: matching the export's single
 * transformed track directly is both more faithful (exact 0.4s cubic-bezier,
 * exact 40px threshold) and one fewer dependency than restyling embla to
 * imitate it. See docs/design-decisions.md for the full rationale.
 *
 * Per T46 Q7 the card renders photographs only: a project with no media
 * rows shows "no preview yet" rather than falling back to an SVG motif.
 *
 * T48: the current slide is activatable and opens the full-screen viewer on
 * this carousel's images alone.
 */

/**
 * Re-exported so the carousel's own module stays the entry point for its
 * slide model; the implementation lives with the other slide helpers.
 */
export { toSlides } from '@/lib/lightbox-slides';

export function ProjectFrame({
  media,
  title,
}: {
  media: PublicProjectMediaItem[];
  title: string;
}) {
  const slides = toSlides(media);
  const [current, setCurrent] = useState(0);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const touchStartX = useRef<number | null>(null);
  const swiped = useRef(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const rememberOpener = useRestoreFocus(
    openIndex !== null,
    (index) => frameRef.current?.querySelectorAll<HTMLElement>('.sb-slide-open')[index],
  );

  if (slides.length === 0) {
    return (
      <div className="sb-frame">
        <div className="sb-noprev">no preview yet</div>
      </div>
    );
  }

  // Slides whose URL never resolved render as a label, not an image, so they
  // are not openable — which makes viewer indices and track indices diverge.
  // `sourceIndex` is what maps one back onto the other.
  const openable = toLightboxSlides(slides);
  const multi = slides.length > 1;
  const go = (next: number) => setCurrent(wrapIndex(next, slides.length));

  function onTouchStart(event: React.TouchEvent) {
    touchStartX.current = event.touches[0]?.clientX ?? null;
    swiped.current = false;
  }

  function onTouchEnd(event: React.TouchEvent) {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start === null) return;
    const delta = (event.changedTouches[0]?.clientX ?? start) - start;
    if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return;
    // A touch sequence emits a synthetic click once it ends. Without this
    // mark, every swipe across the track would also open the viewer.
    swiped.current = true;
    if (!multi) return;
    go(delta < 0 ? current + 1 : current - 1);
  }

  function openViewer(trackIndex: number, opener: HTMLElement) {
    if (swiped.current) {
      swiped.current = false;
      return;
    }
    const index = openable.findIndex((slide) => slide.sourceIndex === trackIndex);
    if (index === -1) return;
    // Safari does not focus a button on click.
    opener.focus();
    rememberOpener(index);
    setOpenIndex(index);
  }

  return (
    <div
      ref={frameRef}
      className="sb-frame"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      /* Bubbles after the slide's own handler, so the swipe mark is cleared
         whether or not the synthetic click landed on the opener. */
      onClick={() => {
        swiped.current = false;
      }}
    >
      <div
        className="sb-track"
        style={{ transform: `translateX(${-current * 100}%)` }}
      >
        {slides.map((slide, index) => (
          <div className="sb-slide" key={slide.key}>
            {slide.url ? (
              <button
                type="button"
                className="sb-slide-open"
                tabIndex={index === current ? 0 : -1}
                aria-label={`Open image ${index + 1} of ${title} full screen`}
                onClick={(event) => openViewer(index, event.currentTarget)}
              >
                {/*
                  The images bucket is public (migration 017), so these URLs
                  are permanent and next/image can optimise and edge-cache
                  them. `sizes` reflects the real grid: full width on phones,
                  two-up on tablets, ~420px tracks in the 1240px container.
                */}
                <Image
                  src={slide.url}
                  alt={slide.alt}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1000px) 50vw, 420px"
                />
              </button>
            ) : (
              <span className="sb-slide-label">{slide.alt}</span>
            )}
          </div>
        ))}
      </div>

      {multi && (
        <>
          <span className="sb-counter">
            {current + 1} / {slides.length}
          </span>

          {/*
            The counter above is the sighted viewer's position indicator. A
            screen reader gets nothing from it, because paging the track moves
            no focus — so this off-screen region carries the same fact plus the
            alt text of the slide that just arrived, and the reader announces
            it on change. Wording tracks the arrow, dot and full-screen-viewer
            labels ("image", not "slide"); keep the four in step if that
            phrasing is revisited.
          */}
          <span className="sb-live" aria-live="polite" aria-atomic="true">
            {`Image ${current + 1} of ${slides.length}: ${slides[current].alt}`}
          </span>

          <button
            type="button"
            className="sb-arrow sb-arrow--prev"
            aria-label={`Previous image of ${title}`}
            onClick={() => go(current - 1)}
          >
            &lsaquo;
          </button>
          <button
            type="button"
            className="sb-arrow sb-arrow--next"
            aria-label={`Next image of ${title}`}
            onClick={() => go(current + 1)}
          >
            &rsaquo;
          </button>

          <div className="sb-dots">
            {slides.map((slide, index) => (
              <button
                key={slide.key}
                type="button"
                className="sb-dot"
                aria-label={`Go to image ${index + 1} of ${title}`}
                aria-current={index === current}
                onClick={() => setCurrent(index)}
              />
            ))}
          </div>
        </>
      )}

      {openIndex !== null && (
        <ImageLightbox
          slides={openable}
          startIndex={openIndex}
          label={title}
          onClose={() => setOpenIndex(null)}
          onIndexChange={(index) => setCurrent(openable[index].sourceIndex)}
        />
      )}
    </div>
  );
}
