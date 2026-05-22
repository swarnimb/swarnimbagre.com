import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import type { PublicProjectMediaItem } from '@/lib/types';

/**
 * T43.G acceptance — `ProjectMediaCarousel` (CONSTRAINT-05 Override 2).
 *
 * embla-carousel-react is mocked: jsdom has no layout engine, so the real
 * hook cannot compute scroll snaps. The mock records the config it was
 * constructed with (asserted for the reduced-motion case) and exposes a
 * controllable fake API so dot / arrow / keyboard wiring can be verified
 * without a real carousel.
 */

// --- embla mock -------------------------------------------------------
const emblaConstructorCalls: unknown[] = [];

function makeFakeApi(slideCount: number) {
  let index = 0;
  const listeners: Record<string, (() => void)[]> = {};
  const emit = (evt: string) => (listeners[evt] ?? []).forEach((fn) => fn());
  const api = {
    selectedScrollSnap: () => index,
    canScrollPrev: () => index > 0,
    canScrollNext: () => index < slideCount - 1,
    scrollNext: () => {
      if (index < slideCount - 1) {
        index += 1;
        emit('select');
      }
    },
    scrollPrev: () => {
      if (index > 0) {
        index -= 1;
        emit('select');
      }
    },
    scrollTo: (i: number) => {
      index = i;
      emit('select');
    },
    on: (evt: string, fn: () => void) => {
      (listeners[evt] ??= []).push(fn);
      return api;
    },
    off: (evt: string, fn: () => void) => {
      listeners[evt] = (listeners[evt] ?? []).filter((f) => f !== fn);
      return api;
    },
  };
  return api;
}

let currentSlideCount = 0;

// The real `useEmblaCarousel` returns a stable [ref, api] tuple across
// re-renders. Mirror that with a per-instance `useRef` cache, otherwise a
// `setState`-triggered re-render would hand the component a fresh API with
// its slide index reset to 0.
vi.mock('embla-carousel-react', async () => {
  const react = await vi.importActual<typeof import('react')>('react');
  return {
    default: (options: unknown) => {
      emblaConstructorCalls.push(options);
      const cache = react.useRef<unknown>(null);
      if (cache.current === null) {
        const ref = () => {};
        cache.current = [ref, makeFakeApi(currentSlideCount)];
      }
      return cache.current as [unknown, unknown];
    },
  };
});

// Import AFTER the mock is registered.
const { ProjectMediaCarousel } = await import('@/components/public/ProjectMediaCarousel');

// --- fixtures ---------------------------------------------------------
function item(overrides: Partial<PublicProjectMediaItem> = {}): PublicProjectMediaItem {
  return {
    id: `m-${Math.abs(JSON.stringify(overrides).length)}-${overrides.orderIndex ?? 0}`,
    imageUrl: 'https://example.com/a.jpg',
    imageAlt: 'alpha shot',
    imageAfterUrl: null,
    imageAfterAlt: null,
    caption: null,
    orderIndex: 0,
    ...overrides,
  };
}

function threeSingles(): PublicProjectMediaItem[] {
  return [
    item({ id: 's1', imageAlt: 'first', orderIndex: 0 }),
    item({ id: 's2', imageAlt: 'second', orderIndex: 1 }),
    item({ id: 's3', imageAlt: 'third', orderIndex: 2 }),
  ];
}

function mockMatchMedia(reduced: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduced && query.includes('reduce'),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

beforeEach(() => {
  emblaConstructorCalls.length = 0;
  currentSlideCount = 0;
  mockMatchMedia(false);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ProjectMediaCarousel — happy path', () => {
  it('3-slide carousel renders 3 dots, both arrows, first slide visible', () => {
    currentSlideCount = 3;
    const { container, getByLabelText } = render(
      <ProjectMediaCarousel media={threeSingles()} ariaLabel="Project media" view="detail" />,
    );
    const dots = container.querySelectorAll('button[aria-label^="Slide "]');
    expect(dots).toHaveLength(3);
    expect(getByLabelText('Previous slide')).toBeTruthy();
    expect(getByLabelText('Next slide')).toBeTruthy();
    // First slide image is rendered.
    const imgs = container.querySelectorAll('img');
    expect(imgs.length).toBeGreaterThanOrEqual(1);
    expect(imgs[0].getAttribute('alt')).toBe('first');
  });
});

describe('ProjectMediaCarousel — single-slide branch', () => {
  it('renders 0 dots and 0 arrows for a single media item', () => {
    currentSlideCount = 1;
    const { container, queryByLabelText } = render(
      <ProjectMediaCarousel
        media={[item({ id: 'only', imageAlt: 'lone' })]}
        ariaLabel="Project media"
        view="list"
      />,
    );
    expect(container.querySelectorAll('button[aria-label^="Slide "]')).toHaveLength(0);
    expect(queryByLabelText('Previous slide')).toBeNull();
    expect(queryByLabelText('Next slide')).toBeNull();
  });
});

describe('ProjectMediaCarousel — zero-slide branch', () => {
  it('returns null and leaves the container empty', () => {
    currentSlideCount = 0;
    const { container } = render(
      <ProjectMediaCarousel media={[]} ariaLabel="Project media" view="list" />,
    );
    expect(container.firstChild).toBeNull();
  });
});

describe('ProjectMediaCarousel — keyboard navigation', () => {
  it('ArrowRight advances the live region; ArrowLeft at slide 0 does nothing', () => {
    currentSlideCount = 3;
    const { container } = render(
      <ProjectMediaCarousel media={threeSingles()} ariaLabel="Project media" view="detail" />,
    );
    const region = container.querySelector('[role="group"]') as HTMLElement;
    const live = container.querySelector('[aria-live="polite"]') as HTMLElement;
    expect(live.textContent).toBe('Slide 1 of 3, first');

    // ArrowLeft at boundary — no change.
    fireEvent.keyDown(region, { key: 'ArrowLeft' });
    expect(live.textContent).toBe('Slide 1 of 3, first');

    // ArrowRight advances.
    fireEvent.keyDown(region, { key: 'ArrowRight' });
    expect(live.textContent).toBe('Slide 2 of 3, second');
  });
});

describe('ProjectMediaCarousel — reduced motion', () => {
  it('constructs embla with duration 0 when prefers-reduced-motion is set', () => {
    mockMatchMedia(true);
    currentSlideCount = 3;
    render(
      <ProjectMediaCarousel media={threeSingles()} ariaLabel="Project media" view="detail" />,
    );
    const opts = emblaConstructorCalls[0] as { duration?: number };
    expect(opts.duration).toBe(0);
  });

  it('constructs embla with non-zero duration when motion is allowed', () => {
    mockMatchMedia(false);
    currentSlideCount = 3;
    render(
      <ProjectMediaCarousel media={threeSingles()} ariaLabel="Project media" view="detail" />,
    );
    const opts = emblaConstructorCalls[0] as { duration?: number };
    expect(opts.duration).not.toBe(0);
  });
});

describe('ProjectMediaCarousel — multi-instance DOM hygiene', () => {
  it('two carousels on one page have non-overlapping dot IDs', () => {
    currentSlideCount = 3;
    const { container } = render(
      <div>
        <ProjectMediaCarousel media={threeSingles()} ariaLabel="Carousel A" view="list" />
        <ProjectMediaCarousel media={threeSingles()} ariaLabel="Carousel B" view="list" />
      </div>,
    );
    const dotIds = Array.from(
      container.querySelectorAll('button[aria-label^="Slide "]'),
    ).map((b) => b.id);
    expect(dotIds).toHaveLength(6);
    expect(new Set(dotIds).size).toBe(6);
  });
});

describe('ProjectMediaCarousel — pair-slide drag priority', () => {
  it('pointerdown on the divider hit zone stops propagation to embla', () => {
    currentSlideCount = 2;
    const pair = item({
      id: 'pair',
      imageUrl: 'https://example.com/before.jpg',
      imageAfterUrl: 'https://example.com/after.jpg',
      imageAlt: 'compare',
    });
    const { container } = render(
      <ProjectMediaCarousel
        media={[pair, item({ id: 's2', imageAlt: 'second' })]}
        ariaLabel="Project media"
        view="detail"
      />,
    );
    const hitZone = container.querySelector('[data-divider-hitzone="true"]');
    expect(hitZone).not.toBeNull();
    const evt = new Event('pointerdown', { bubbles: true, cancelable: true });
    const stopSpy = vi.spyOn(evt, 'stopPropagation');
    hitZone!.dispatchEvent(evt);
    expect(stopSpy).toHaveBeenCalled();
  });
});

describe('ProjectMediaCarousel — ARIA live region', () => {
  it('aria-live text matches "Slide N of M, [alt]" on slide change', () => {
    currentSlideCount = 3;
    const { container } = render(
      <ProjectMediaCarousel media={threeSingles()} ariaLabel="Project media" view="detail" />,
    );
    const live = container.querySelector('[aria-live="polite"]') as HTMLElement;
    const dots = container.querySelectorAll('button[aria-label^="Slide "]');

    expect(live.textContent).toBe('Slide 1 of 3, first');
    fireEvent.click(dots[2]);
    expect(live.textContent).toBe('Slide 3 of 3, third');
  });
});
