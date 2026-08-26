'use client';

import { CarouselChevron } from './CarouselChevron';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  SWIPE_THRESHOLD_PX,
  clampIndex,
  type LightboxSlide,
} from '@/lib/lightbox-slides';
import { isPinchZoomed, trapTab } from '@/lib/lightbox-dom';

/**
 * The full-screen image viewer (T48). Hand-rolled like the carousel it opens
 * from: a library would need a named Override plus a route-chunk measurement
 * under CONSTRAINT-22, and the public site has held zero runtime JS
 * dependencies since T46. It stays small because it carries no zoom state —
 * mobile keeps native pinch-zoom, desktop keeps ctrl+scroll — so panning,
 * swipe-to-navigate and swipe-to-dismiss cannot conflict.
 *
 * Portalled on purpose: `.sb-track` is transformed, and a transformed
 * ancestor makes `position: fixed` resolve against it rather than the
 * viewport, which would clip the overlay inside the card.
 */

interface ImageLightboxProps {
  slides: LightboxSlide[];
  startIndex: number;
  /**
   * Names the group in every assistive-technology string — several carousels
   * stack on `/projects`, so a bare "Close" or "Next" says too little.
   */
  label: string;
  onClose: () => void;
  onIndexChange?: (index: number) => void;
}

/**
 * @param slides        The group's images. Never empty in practice; a group
 *                      that cannot render one closes itself and logs.
 * @param startIndex    Position within `slides` to open on.
 * @param label         Group name used in every aria label.
 * @param onClose       Called on Escape, backdrop click, swipe down, and the
 *                      close control. The caller unmounts the viewer.
 * @param onIndexChange Called with the new position on every navigation, so a
 *                      carousel can follow the viewer.
 */
export function ImageLightbox({
  slides,
  startIndex,
  label,
  onClose,
  onIndexChange,
}: ImageLightboxProps) {
  const [current, setCurrent] = useState(startIndex);
  const dialogRef = useRef<HTMLDivElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  // Focus restoration is the caller's job, not this component's: capturing
  // `document.activeElement` here and re-focusing it on unmount looks correct
  // and fails in a real browser, because the element can be replaced between
  // mount and unmount and `focus()` on a detached node silently does nothing.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  // A viewer opened on a group it cannot render would otherwise sit invisible
  // with the scroll lock held and no control to release it: no dialog node, so
  // Escape is dead, and no backdrop to click. Unreachable by construction from
  // both call sites today — which is exactly why it must not fail quietly.
  useEffect(() => {
    if (slides[current]) return;
    console.error('[image-lightbox] opened with no renderable slide', {
      operation: 'ImageLightbox.render',
      group: label,
      startIndex,
      current,
      slideCount: slides.length,
    });
    onClose();
  });

  function show(next: number) {
    const index = clampIndex(next, slides.length);
    setCurrent(index);
    onIndexChange?.(index);
  }

  // Re-registered every render, not keyed on a dependency list: the handler
  // reads `current`, and a stale closure here pages the wrong way.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const dialog = dialogRef.current;
      if (!dialog) return;
      if (event.key === 'Escape') return onClose();
      if (event.key === 'Tab') return trapTab(event, dialog);
      if (slides.length < 2) return;
      if (event.key === 'ArrowLeft') show(current - 1);
      if (event.key === 'ArrowRight') show(current + 1);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  });

  function onTouchStart(event: React.TouchEvent) {
    const touch = event.touches[0];
    touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  }

  function onTouchEnd(event: React.TouchEvent) {
    const start = touchStart.current;
    touchStart.current = null;
    if (start === null || isPinchZoomed()) return;
    const touch = event.changedTouches[0];
    const movedX = (touch?.clientX ?? start.x) - start.x;
    const movedY = (touch?.clientY ?? start.y) - start.y;
    if (Math.abs(movedX) > Math.abs(movedY)) {
      if (slides.length > 1 && Math.abs(movedX) >= SWIPE_THRESHOLD_PX) {
        show(movedX < 0 ? current + 1 : current - 1);
      }
      return;
    }
    if (movedY >= SWIPE_THRESHOLD_PX) onClose();
  }

  const slide = slides[current];
  if (!slide || typeof document === 'undefined') return null;
  const multi = slides.length > 1;

  return createPortal(
    <div
      ref={dialogRef}
      className="sb-lb"
      role="dialog"
      aria-modal="true"
      aria-label={`Image viewer for ${label}`}
      tabIndex={-1}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <img
        className="sb-lb-image"
        src={slide.url}
        alt={slide.alt}
        onError={() =>
          console.error('[image-lightbox] slide image failed to load', {
            operation: 'renderSlide',
            group: label,
            index: current,
            slideKey: slide.key,
          })
        }
      />
      <button
        type="button"
        className="sb-arrow sb-lb-close"
        aria-label={`Close the image viewer for ${label}`}
        onClick={onClose}
      >
        &times;
      </button>
      {multi && (
        <>
          <span className="sb-live" aria-live="polite" aria-atomic="true">
            {`Image ${current + 1} of ${slides.length}: ${slide.alt}`}
          </span>
          <button
            type="button"
            className="sb-arrow sb-arrow--prev"
            aria-label={`Previous image of ${label}`}
            onClick={() => show(current - 1)}
            disabled={current === 0}
          >
            <CarouselChevron direction="prev" />
          </button>
          <button
            type="button"
            className="sb-arrow sb-arrow--next"
            aria-label={`Next image of ${label}`}
            onClick={() => show(current + 1)}
            disabled={current === slides.length - 1}
          >
            <CarouselChevron direction="next" />
          </button>
        </>
      )}
    </div>,
    document.body,
  );
}
