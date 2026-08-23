/**
 * DOM-level helpers for the full-screen image viewer (T48).
 *
 * Separate from `lightbox-slides.ts`, which shapes slide data: these two touch
 * the live document — the pinch-zoom state of the visual viewport, and the
 * focus ring inside an open dialog — and neither has anything to say about
 * slides.
 */

/** `visualViewport.scale` at or below this means the visitor has not zoomed. */
const UNZOOMED_SCALE = 1;

/**
 * Report whether the visitor has pinch-zoomed the page.
 *
 * The viewer implements no zoom of its own, so native pinch-zoom stays live —
 * and once zoomed, a one-finger pan reads as a swipe and would navigate or
 * dismiss the viewer under the visitor. The gesture handlers stand down while
 * this is true.
 *
 * @returns `true` when the visual viewport reports a scale above 1. `false`
 *          when it reports 1 or less, and when `visualViewport` is absent —
 *          the API is feature-detected, and no API means no zoom to detect.
 */
export function isPinchZoomed(): boolean {
  const scale = typeof window === 'undefined' ? undefined : window.visualViewport?.scale;
  return (scale ?? UNZOOMED_SCALE) > UNZOOMED_SCALE;
}

/**
 * Keep Tab focus inside an open dialog, wrapping at both ends.
 *
 * Every focusable the overlay renders is a `<button>`, so that is the whole
 * query. Called from a keydown handler that has already matched `Tab`.
 *
 * @param event  The keydown event. Its default is prevented on any wrap, and
 *               on every Tab when the dialog holds nothing focusable — focus
 *               must not escape to the page behind the overlay.
 * @param dialog The dialog element to trap focus within.
 */
export function trapTab(event: KeyboardEvent, dialog: HTMLElement): void {
  const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('button'));
  if (focusable.length === 0) {
    event.preventDefault();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;
  if (event.shiftKey && (active === first || active === dialog)) {
    last.focus();
    event.preventDefault();
  } else if (!event.shiftKey && active === last) {
    first.focus();
    event.preventDefault();
  }
}
