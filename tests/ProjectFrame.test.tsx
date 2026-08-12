import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ProjectFrame, toSlides } from '@/components/public/ProjectFrame';
import type { PublicProjectMediaItem } from '@/lib/types';

/**
 * T46: the card's media frame flattens media rows to slides before it
 * renders. A row carrying a before/after pair is two things a viewer can page
 * through, so it has to count as two slides; the counter and dots read off
 * this list.
 *
 * The second block covers the live region added for the T46 accessibility
 * regression: paging the track moves no focus, so without it a screen reader
 * is told nothing when the image changes.
 */

afterEach(() => {
  cleanup();
});

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

describe('ProjectFrame live region', () => {
  const pair = [
    mediaItem({
      id: 'pair',
      imageAlt: 'the list view',
      imageAfterUrl: 'https://example.com/after.jpg',
      imageAfterAlt: 'the same view rebuilt',
    }),
  ];

  it('announces the active slide and updates when the viewer pages on', () => {
    render(<ProjectFrame media={pair} title="Thing" />);

    const live = screen.getByText(/^Image 1 of 2:/);
    expect(live).toHaveAttribute('aria-live', 'polite');
    expect(live).toHaveAttribute('aria-atomic', 'true');
    expect(live.textContent).toBe('Image 1 of 2: the list view');

    fireEvent.click(screen.getByRole('button', { name: 'Next image of Thing' }));

    expect(screen.getByText(/^Image 2 of 2:/).textContent).toBe(
      'Image 2 of 2: the same view rebuilt',
    );
  });

  it('renders no live region when there is nothing to page through', () => {
    render(<ProjectFrame media={[mediaItem({ imageAlt: 'only one' })]} title="Thing" />);

    expect(screen.queryByText(/^Image \d+ of/)).toBeNull();
  });
});
