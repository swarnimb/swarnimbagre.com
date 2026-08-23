import type { PublicProjectMediaItem } from '@/lib/types';

/**
 * Pure helpers behind the full-screen image viewer (T48).
 *
 * These read the DOM but render nothing and hold no React state, so the two
 * paths that would otherwise only be reachable through a real click sequence
 * — resolving a click to a slide, and building a post's slide list — stay
 * unit-testable without a component harness.
 */

/**
 * Distance in px a touch must travel before it counts as a swipe rather than
 * a tap. Lives here rather than in `ProjectFrame` so the carousel and the
 * viewer cannot drift into two gesture styles on the same images.
 */
export const SWIPE_THRESHOLD_PX = 40;

/** One openable image, resolved. `url` is never null — placeholders are dropped. */
export interface LightboxSlide {
  key: string;
  url: string;
  alt: string;
  /**
   * Position in the group this slide came from: the carousel's track index,
   * or document order within a post body. The viewer's own indices skip
   * unresolvable images, so this is what maps a viewer position back onto the
   * carousel it opened from.
   */
  sourceIndex: number;
}

/** The carousel's slide shape, which permits an unresolved (null) URL. */
export interface CarouselSlide {
  key: string;
  url: string | null;
  alt: string;
}

/**
 * The wrapping bound shared by the carousel and the viewer. Two different
 * bound behaviours on the same set of images would be a defect, not a
 * preference, so `ProjectFrame.go()` calls this too.
 *
 * @param index Requested position, which may sit outside the range.
 * @param count Number of slides in the group.
 * @returns A position inside `[0, count)`; `0` for an empty group.
 */
export function wrapIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  return ((index % count) + count) % count;
}

/**
 * Drop the slides the carousel renders as an `sb-slide-label` placeholder.
 * `lib/public-project-media.ts` nulls a media URL per item when it cannot be
 * signed, and a viewer opened on one of those would show nothing.
 *
 * @param slides The carousel's flattened slides, in track order.
 * @returns The openable subset, in the same order, each carrying the track
 *          index it came from. Empty when no slide resolved.
 */
export function toLightboxSlides(slides: CarouselSlide[]): LightboxSlide[] {
  const openable: LightboxSlide[] = [];
  slides.forEach((slide, sourceIndex) => {
    if (!slide.url) return;
    openable.push({ key: slide.key, url: slide.url, alt: slide.alt, sourceIndex });
  });
  return openable;
}

/**
 * Read the rendered images out of a post body, in document order.
 *
 * Called when a click is handled, never on mount: `MarkdownContent` injects
 * its HTML inside an effect, so the `<img>` nodes do not exist during the
 * first render and a list built then would always be empty.
 *
 * @param container The element the sanitized post HTML was injected into.
 * @returns One slide per `<img>` with a non-empty `src`, in document order.
 *          Empty before the injection effect has run.
 */
export function collectPostImages(container: HTMLElement): LightboxSlide[] {
  const slides: LightboxSlide[] = [];
  Array.from(container.querySelectorAll('img')).forEach((image, sourceIndex) => {
    const url = (image.getAttribute('src') ?? '').trim();
    if (url === '') return;
    slides.push({
      key: `post-image-${sourceIndex}`,
      url,
      alt: image.getAttribute('alt') ?? '',
      sourceIndex,
    });
  });
  return slides;
}

/**
 * Resolve a click inside a post body to a position in `collectPostImages()`.
 *
 * @param container The element the post HTML was injected into.
 * @param target    The click's target.
 * @returns The slide index, or `null` when the click was not on an eligible
 *          image — anything that is not an `<img>`, an image outside the
 *          container, an image with no `src`, or an image wrapped in a link,
 *          which must follow its link instead of opening the viewer.
 */
export function indexOfImage(
  container: HTMLElement,
  target: EventTarget | null,
): number | null {
  if (!(target instanceof HTMLImageElement)) return null;
  if (!container.contains(target)) return null;
  if (target.closest('a') !== null) return null;

  const sourceIndex = Array.from(container.querySelectorAll('img')).indexOf(target);
  const index = collectPostImages(container).findIndex(
    (slide) => slide.sourceIndex === sourceIndex,
  );
  return index === -1 ? null : index;
}

/**
 * Flatten media rows to slides. A row carrying a before/after pair
 * contributes two slides, so the carousel counter reflects what the viewer
 * can actually page through.
 *
 * @param media Public media rows for one project, in display order.
 * @returns One slide per image. `url` is null for a row whose Storage URL
 *          could not be signed; the carousel renders those as a label.
 */
export function toSlides(media: PublicProjectMediaItem[]): CarouselSlide[] {
  const slides: CarouselSlide[] = [];
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
