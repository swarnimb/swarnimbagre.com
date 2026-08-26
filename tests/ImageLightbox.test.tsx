import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ProjectFrame } from '@/components/public/ProjectFrame';
import type { PublicProjectMediaItem } from '@/lib/types';

/**
 * T48 wiring coverage. The pure helpers are unit-tested in
 * `lightbox-slides.test.ts`; this file covers the four behaviours that only
 * exist once the viewer is attached to a real carousel — the swipe/click
 * collision, dismissal, focus restore, and the placeholder exclusion.
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

/** The activatable image of the slide currently on screen. */
function openControl(index: number) {
  return screen.getByRole('button', { name: `Open image ${index} of Thing full screen` });
}

describe('ProjectFrame — full-screen viewer', () => {
  it('opens on the clicked image and dismisses on Escape, restoring focus', () => {
    render(<ProjectFrame media={[mediaItem()]} title="Thing" />);
    const opener = openControl(1);

    fireEvent.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'Image viewer for Thing' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(document.body.style.overflow).toBe('hidden');
    // Focus really moved off the opener, so the restore below proves itself.
    expect(document.activeElement).toBe(dialog);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
    expect(document.body.style.overflow).toBe('');
  });

  it('closes on a backdrop click but not on a click on the image itself', () => {
    render(<ProjectFrame media={[mediaItem()]} title="Thing" />);
    fireEvent.click(openControl(1));
    const dialog = screen.getByRole('dialog');

    // The carousel slide behind carries the same alt, so target the overlay's
    // own image rather than the ambiguous query.
    fireEvent.click(dialog.querySelector('.sb-lb-image') as HTMLElement);
    expect(screen.queryByRole('dialog')).not.toBeNull();

    fireEvent.click(dialog);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes on a downward swipe and stays open on a short one', () => {
    render(<ProjectFrame media={[mediaItem()]} title="Thing" />);
    fireEvent.click(openControl(1));
    const dialog = screen.getByRole('dialog');

    // Under the 40px threshold: not a dismissal.
    fireEvent.touchStart(dialog, { touches: [{ clientX: 0, clientY: 0 }] });
    fireEvent.touchEnd(dialog, { changedTouches: [{ clientX: 0, clientY: 20 }] });
    expect(screen.queryByRole('dialog')).not.toBeNull();

    fireEvent.touchStart(dialog, { touches: [{ clientX: 0, clientY: 0 }] });
    fireEvent.touchEnd(dialog, { changedTouches: [{ clientX: 0, clientY: 120 }] });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders no navigation controls for a one-image group', () => {
    render(<ProjectFrame media={[mediaItem()]} title="Thing" />);
    fireEvent.click(openControl(1));
    expect(screen.queryByRole('button', { name: 'Next image of Thing' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Close the image viewer for Thing' })).toBeTruthy();
  });

  it('stops at both ends with the arrow keys exactly as the carousel does', () => {
    render(
      <ProjectFrame
        media={[mediaItem({ imageAfterUrl: 'https://example.com/after.jpg', imageAfterAlt: 'after' })]}
        title="Thing"
      />,
    );
    fireEvent.click(openControl(1));
    // Paging back from the first image holds there rather than jumping to the
    // last: on a set this small a wrap reads as a glitch, not as navigation.
    fireEvent.keyDown(document, { key: 'ArrowLeft' });
    expect(screen.getByRole('dialog').textContent).toContain('Image 1 of 2');
    // ...and paging forward past the last holds on the last.
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(screen.getByRole('dialog').textContent).toContain('Image 2 of 2');
  });

  it('leaves the carousel on the image the viewer was last showing', () => {
    render(
      <ProjectFrame
        media={[mediaItem({ imageAfterUrl: 'https://example.com/after.jpg', imageAfterAlt: 'after' })]}
        title="Thing"
      />,
    );
    fireEvent.click(openControl(1));
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    fireEvent.keyDown(document, { key: 'Escape' });
    // The carousel no longer draws a visible counter, so its position is read
    // from the live region that announces the same thing to screen readers.
    expect(screen.getByText(/Image 2 of 2/)).toBeTruthy();
  });

  it('does not open the viewer when the click is the tail of a swipe', () => {
    const frame = document.body;
    render(
      <ProjectFrame
        media={[mediaItem({ imageAfterUrl: 'https://example.com/after.jpg', imageAfterAlt: 'after' })]}
        title="Thing"
      />,
    );
    const track = frame.querySelector('.sb-frame') as HTMLElement;

    fireEvent.touchStart(track, { touches: [{ clientX: 200, clientY: 0 }] });
    fireEvent.touchEnd(track, { changedTouches: [{ clientX: 100, clientY: 0 }] });
    // The synthetic click a touch sequence emits afterwards must be ignored.
    fireEvent.click(openControl(2));

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('excludes a slide whose image never resolved', () => {
    render(
      <ProjectFrame
        media={[mediaItem({ imageUrl: null, imageAlt: 'unavailable' }), mediaItem({ id: 'm2' })]}
        title="Thing"
      />,
    );
    expect(screen.queryByRole('button', { name: 'Open image 1 of Thing full screen' })).toBeNull();
    fireEvent.click(openControl(2));
    expect(screen.getByRole('dialog').textContent).not.toContain(' of 2');
  });
});
