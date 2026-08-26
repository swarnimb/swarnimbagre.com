import { describe, expect, it } from 'vitest';
import {
  collectPostImages,
  indexOfImage,
  toLightboxSlides,
  clampIndex,
} from '@/lib/lightbox-slides';

function container(html: string): HTMLElement {
  const element = document.createElement('div');
  element.innerHTML = html;
  return element;
}

describe('clampIndex', () => {
  it('stops at both ends instead of wrapping', () => {
    // ProjectFrame and ImageLightbox both page by current ± 1, so these are
    // the only inputs either can produce and both must agree. Paging past the
    // last image holds on the last image rather than returning to the first.
    expect(clampIndex(3, 3)).toBe(2);
    expect(clampIndex(-1, 3)).toBe(0);
    expect(clampIndex(1, 3)).toBe(1);
  });

  it('leaves in-range positions untouched', () => {
    expect(clampIndex(0, 3)).toBe(0);
    expect(clampIndex(2, 3)).toBe(2);
  });

  it('returns 0 for an empty group rather than NaN', () => {
    expect(clampIndex(1, 0)).toBe(0);
  });
});

describe('toLightboxSlides', () => {
  it('keeps resolved slides and records their track index', () => {
    const slides = toLightboxSlides([
      { key: 'a', url: 'https://example.test/one.png', alt: 'one' },
      { key: 'b', url: 'https://example.test/two.png', alt: 'two' },
    ]);
    expect(slides.map((slide) => slide.sourceIndex)).toEqual([0, 1]);
    expect(slides[1]).toMatchObject({ key: 'b', alt: 'two' });
  });

  it('drops a slide whose URL never resolved, keeping the track index of the rest', () => {
    const slides = toLightboxSlides([
      { key: 'a', url: null, alt: 'unavailable' },
      { key: 'b', url: 'https://example.test/two.png', alt: 'two' },
    ]);
    expect(slides).toHaveLength(1);
    expect(slides[0].sourceIndex).toBe(1);
  });
});

describe('collectPostImages', () => {
  it('returns one slide per rendered image, in document order', () => {
    const body = container(
      '<p><img src="/one.png" alt="one"></p><p><img src="/two.png" alt="two"></p>',
    );
    expect(collectPostImages(body)).toEqual([
      { key: 'post-image-0', url: '/one.png', alt: 'one', sourceIndex: 0 },
      { key: 'post-image-1', url: '/two.png', alt: 'two', sourceIndex: 1 },
    ]);
  });

  it('skips an image with an empty src', () => {
    const body = container('<img src="" alt="broken"><img src="/two.png" alt="two">');
    const slides = collectPostImages(body);
    expect(slides).toHaveLength(1);
    expect(slides[0]).toMatchObject({ url: '/two.png', sourceIndex: 1 });
  });
});

describe('indexOfImage', () => {
  it('resolves a click on an image to its slide index', () => {
    const body = container('<img src="/one.png" alt="one"><img src="/two.png" alt="two">');
    const second = body.querySelectorAll('img')[1];
    expect(indexOfImage(body, second)).toBe(1);
  });

  it('returns null for a click that is not on an image', () => {
    const body = container('<p>text</p><img src="/one.png" alt="one">');
    expect(indexOfImage(body, body.querySelector('p'))).toBeNull();
    expect(indexOfImage(body, null)).toBeNull();
  });

  it('returns null for an image inside an anchor, so the link is followed instead', () => {
    const body = container('<a href="/elsewhere"><img src="/one.png" alt="one"></a>');
    expect(indexOfImage(body, body.querySelector('img'))).toBeNull();
  });

  it('returns null for an image the slide list skipped', () => {
    const body = container('<img src="" alt="broken">');
    expect(indexOfImage(body, body.querySelector('img'))).toBeNull();
  });
});
