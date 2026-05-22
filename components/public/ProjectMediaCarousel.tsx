'use client'

import { useCallback, useEffect, useId, useState } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import type { PublicProjectMediaItem } from '@/lib/types'
import { MediaSlide, Caption, Arrow } from './ProjectMediaCarouselParts'

/**
 * Public-site media carousel for a project's `project_media` rows.
 *
 * Wraps `embla-carousel-react` for gesture / keyboard / slide
 * coordination only — embla ships zero visual chrome, so every dot,
 * arrow, caption, and frame here is hand-built and styled exclusively
 * via the bundle's CSS variables.
 *
 * Branching:
 *   - 0 items  → renders nothing.
 *   - 1 item   → single static slide, no dots, no arrows.
 *   - 2+ items → embla carousel with dots, arrows, swipe, and keyboard.
 *
 * T43.G — CONSTRAINT-05 Override 2. The `view` prop is required and is
 * NOT in the plan's documented `{ media, ariaLabel }` signature; Override
 * 2 specifies different dot / arrow sizing for list vs detail, so the
 * orchestrator passes it explicitly. Flagged for T43.I doc close-out.
 */

interface ProjectMediaCarouselProps {
  /** Ordered media rows, pre-resolved to signed URLs (T43.D). */
  media: PublicProjectMediaItem[];
  /** Accessible name for the carousel region. */
  ariaLabel: string;
  /** Surface context — drives dot / arrow sizing per Override 2. */
  view: 'list' | 'detail';
}

const VIEW_SIZING = {
  list: { dot: 6, dotPitch: 8, dotsPad: '8px 0 14px', arrow: 14, hit: 32 },
  detail: { dot: 8, dotPitch: 10, dotsPad: '12px 0 18px', arrow: 18, hit: 40 },
} as const;

/** Width of the divider hit zone that steals drags from embla. */
const DIVIDER_HIT_ZONE_PX = 28;

/** True when the user has asked for reduced motion. SSR-safe (guards window). */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Best available alt text for a media item, for the aria-live announcement. */
function slideAlt(item: PublicProjectMediaItem | undefined): string {
  if (!item) return '';
  return item.imageAlt || item.imageAfterAlt || '';
}

export function ProjectMediaCarousel({
  media,
  ariaLabel,
  view,
}: ProjectMediaCarouselProps): React.ReactElement | null {
  const baseId = useId();
  const sizing = VIEW_SIZING[view];
  const reduced = prefersReducedMotion();
  const [emblaRef, emblaApi] = useEmblaCarousel({
    axis: 'x',
    loop: false,
    dragFree: false,
    containScroll: 'trimSnaps',
    duration: reduced ? 0 : 25,
  });
  const [selected, setSelected] = useState(0);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const sync = useCallback(() => {
    if (!emblaApi) return;
    setSelected(emblaApi.selectedScrollSnap());
    setCanPrev(emblaApi.canScrollPrev());
    setCanNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    sync();
    emblaApi.on('select', sync).on('reInit', sync);
    return () => {
      emblaApi.off('select', sync).off('reInit', sync);
    };
  }, [emblaApi, sync]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!emblaApi) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      emblaApi.scrollNext();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      emblaApi.scrollPrev();
    }
  };

  if (media.length === 0) return null;

  if (media.length === 1) {
    return (
      <div role="group" aria-label={ariaLabel}>
        <MediaSlide item={media[0]} hitZone={DIVIDER_HIT_ZONE_PX} stealDrag={false} />
        <Caption text={media[0].caption} />
      </div>
    );
  }

  const total = media.length;
  return (
    <div
      role="group"
      aria-roledescription="carousel"
      aria-label={ariaLabel}
      tabIndex={0}
      onKeyDown={onKeyDown}
      style={{ outline: 'none' }}
    >
      <div ref={emblaRef} style={{ overflow: 'hidden' }}>
        <div style={{ display: 'flex' }}>
          {media.map((item) => (
            <div key={item.id} style={{ flex: '0 0 100%', minWidth: 0 }}>
              <MediaSlide item={item} hitZone={DIVIDER_HIT_ZONE_PX} stealDrag />
            </div>
          ))}
        </div>
      </div>

      <Caption text={media[selected]?.caption ?? null} />

      <div
        aria-live="polite"
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          overflow: 'hidden',
          clip: 'rect(0 0 0 0)',
          whiteSpace: 'nowrap',
        }}
      >
        {`Slide ${selected + 1} of ${total}, ${slideAlt(media[selected])}`}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          padding: sizing.dotsPad,
        }}
      >
        <Arrow
          dir="prev"
          disabled={!canPrev}
          size={sizing.arrow}
          hit={sizing.hit}
          onClick={() => emblaApi?.scrollPrev()}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: sizing.dotPitch - sizing.dot }}>
          {media.map((item, i) => (
            <button
              key={item.id}
              type="button"
              id={`${baseId}-dot-${i}`}
              aria-label={`Slide ${i + 1}`}
              aria-current={i === selected}
              onClick={() => emblaApi?.scrollTo(i)}
              style={{
                width: sizing.dot,
                height: sizing.dot,
                padding: 0,
                borderRadius: 999,
                cursor: 'pointer',
                background: i === selected ? 'var(--accent)' : 'transparent',
                border: i === selected ? 'none' : '1px solid var(--hairline)',
                transition:
                  'background-color 220ms var(--ease), border-color 220ms var(--ease)',
              }}
            />
          ))}
        </div>
        <Arrow
          dir="next"
          disabled={!canNext}
          size={sizing.arrow}
          hit={sizing.hit}
          onClick={() => emblaApi?.scrollNext()}
        />
      </div>
    </div>
  );
}
