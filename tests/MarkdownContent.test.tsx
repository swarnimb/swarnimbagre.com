import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MarkdownContent } from '@/components/public/MarkdownContent';

/**
 * The post-body half of the T48 viewer. The slide list is built at click time
 * because the `<img>` nodes are injected by an effect and do not exist during
 * the first render — these tests exercise that path end to end rather than
 * through the helpers alone.
 */

afterEach(() => {
  cleanup();
});

describe('MarkdownContent — full-screen viewer', () => {
  it('opens the viewer on the clicked body image', () => {
    render(<MarkdownContent md={'![a chart](/one.png)\n\n![a photo](/two.png)'} imageLabel="A Post" />);
    fireEvent.click(screen.getByAltText('a photo'));
    const dialog = screen.getByRole('dialog', { name: 'Image viewer for A Post' });
    expect(dialog.textContent).toContain('Image 2 of 2');
  });

  it('returns focus to the image that opened it, not to the body', () => {
    render(<MarkdownContent md={`![a chart](/one.png)

![a photo](/two.png)`} imageLabel="A Post" />);
    fireEvent.click(screen.getByAltText('a photo'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(screen.getByAltText('a photo'));
  });

  it('ignores a click that is not on an image', () => {
    render(<MarkdownContent md={'some words\n\n![a chart](/one.png)'} imageLabel="A Post" />);
    fireEvent.click(screen.getByText('some words'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('lets a linked image follow its link instead of opening the viewer', () => {
    render(<MarkdownContent md={'[![a chart](/one.png)](/elsewhere)'} imageLabel="A Post" />);
    // The click really does follow the link, which jsdom cannot perform —
    // swallow the navigation so the assertion is about the viewer, not jsdom.
    const swallow = (event: Event) => event.preventDefault();
    document.addEventListener('click', swallow);
    fireEvent.click(screen.getByAltText('a chart'));
    document.removeEventListener('click', swallow);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
