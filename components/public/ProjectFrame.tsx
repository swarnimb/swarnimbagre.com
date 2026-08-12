'use client';

import { useRef, useState } from 'react';
import type { PublicProjectMediaItem } from '@/lib/types';

/**
 * The media frame at the top of a project card.
 *
 * Hand-rolled rather than embla-backed. The export's carousel is a single
 * transformed track with dots, arrows and a swipe threshold — about sixty
 * lines — so matching it directly is both more faithful (exact 0.4s
 * cubic-bezier, exact 40px threshold) and one fewer dependency than
 * restyling embla to imitate it. That retires the T43 embla wrapper and,
 * with it, CONSTRAINT-22's 15KB route-chunk budget.
 *
 * Per T46 Q7 the card renders photographs only: a project with no media
 * rows shows "no preview yet" rather than falling back to an SVG motif.
 */

const SWIPE_THRESHOLD_PX = 40;

type Slide = {
  key: string;
  url: string | null;
  alt: string;
};

/**
 * Flatten media rows to slides. A row carrying a before/after pair
 * contributes two slides, so the carousel counter reflects what the viewer
 * can actually page through.
 */
export function toSlides(media: PublicProjectMediaItem[]): Slide[] {
  const slides: Slide[] = [];
  for (const item of media) {
    slides.push({
      key: `${item.id}-a`,
      url: item.imageUrl,
      alt: item.imageAlt,
    });
    if (item.imageAfterUrl) {
      slides.push({
        key: `${item.id}-b`,
        url: item.imageAfterUrl,
        alt: item.imageAfterAlt ?? item.imageAlt,
      });
    }
  }
  return slides;
}

export function ProjectFrame({
  media,
  title,
}: {
  media: PublicProjectMediaItem[];
  title: string;
}) {
  const slides = toSlides(media);
  const [current, setCurrent] = useState(0);
  const touchStartX = useRef<number | null>(null);

  if (slides.length === 0) {
    return (
      <div className="sb-frame">
        <div className="sb-noprev">no preview yet</div>
      </div>
    );
  }

  const multi = slides.length > 1;
  const go = (next: number) =>
    setCurrent((next + slides.length) % slides.length);

  function onTouchStart(event: React.TouchEvent) {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  }

  function onTouchEnd(event: React.TouchEvent) {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start === null || !multi) return;
    const delta = (event.changedTouches[0]?.clientX ?? start) - start;
    if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return;
    go(delta < 0 ? current + 1 : current - 1);
  }

  return (
    <div
      className="sb-frame"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div
        className="sb-track"
        style={{ transform: `translateX(${-current * 100}%)` }}
      >
        {slides.map((slide) => (
          <div className="sb-slide" key={slide.key}>
            {slide.url ? (
              // eslint-disable-next-line @next/next/no-img-element -- Storage
              // URLs are signed and short-lived, so next/image's optimizer
              // cannot cache them usefully.
              <img src={slide.url} alt={slide.alt} />
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
            it on change. Wording tracks the arrow and dot labels ("image",
            not "slide"); keep the three in step if that phrasing is revisited.
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
    </div>
  );
}
