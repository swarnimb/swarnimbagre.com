import { describe, it, expect } from 'vitest';
import { toSlides } from '@/components/public/ProjectFrame';
import type { PublicProjectMediaItem } from '@/lib/types';

/**
 * T46: the card's media frame flattens media rows to slides before it
 * renders. A row carrying a before/after pair is two things a viewer can page
 * through, so it has to count as two slides; the counter and dots read off
 * this list.
 */

/** Build a render-ready media item with sensible defaults for tests. */
function mediaItem(overrides: Partial<PublicProjectMediaItem> = {}): PublicProjectMediaItem {
  return {
    id: 'm1',
    imageUrl: 'https://example.com/slide.jpg',
    imageAlt: 'slide',
    imageAfterUrl: null,
    imageAfterAlt: null,
    orderIndex: 0,
    ...overrides,
  };
}

describe('toSlides', () => {
  it('maps each single-image row to one slide in order', () => {
    const slides = toSlides([
      mediaItem({ id: 'a' }),
      mediaItem({ id: 'b', imageAlt: 'second' }),
    ]);
    expect(slides).toHaveLength(2);
    expect(slides.map((slide) => slide.key)).toEqual(['a-a', 'b-a']);
    expect(slides[1].alt).toBe('second');
  });

  it('splits a before/after row into two slides', () => {
    const slides = toSlides([
      mediaItem({
        id: 'pair',
        imageAfterUrl: 'https://example.com/after.jpg',
        imageAfterAlt: 'after',
      }),
    ]);
    expect(slides).toHaveLength(2);
    expect(slides.map((slide) => slide.key)).toEqual(['pair-a', 'pair-b']);
    expect(slides[0].url).toBe('https://example.com/slide.jpg');
    expect(slides[1].url).toBe('https://example.com/after.jpg');
    expect(slides[1].alt).toBe('after');
  });

  it('falls back to the primary alt when the after image has none', () => {
    const slides = toSlides([
      mediaItem({
        id: 'pair',
        imageAlt: 'primary',
        imageAfterUrl: 'https://example.com/after.jpg',
        imageAfterAlt: null,
      }),
    ]);
    expect(slides[1].alt).toBe('primary');
  });

  it('returns an empty list for a project with no media rows', () => {
    expect(toSlides([])).toEqual([]);
  });
});
