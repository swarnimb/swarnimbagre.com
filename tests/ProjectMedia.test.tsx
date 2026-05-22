import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ProjectMedia } from '@/components/public/ProjectMedia';
import type { PublicProjectMediaItem } from '@/lib/types';

// Stub the carousel so these tests do not pull in embla. The path must match
// the specifier `ProjectMedia.tsx` uses to import `ProjectMediaCarousel`;
// `@/components/public/ProjectMediaCarousel` resolves to the same module.
vi.mock('@/components/public/ProjectMediaCarousel', () => ({
  ProjectMediaCarousel: (props: { media: unknown[]; view: string; ariaLabel: string }) => (
    <div
      data-testid="project-media-carousel"
      data-view={props.view}
      data-count={props.media.length}
    />
  ),
}));

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
    caption: null,
    orderIndex: 0,
    ...overrides,
  };
}

describe('ProjectMedia — branching on URL props', () => {
  it('renders before/after slider when both imageUrl and imageAfterUrl are present', () => {
    const { container } = render(
      <ProjectMedia
        imageUrl="https://example.com/before.jpg"
        imageAfterUrl="https://example.com/after.jpg"
        title="tennis-elbow"
      />,
    );
    // BeforeAfterMedia renders the draggable wrapper with cursor:ew-resize.
    const slider = container.querySelector('[style*="ew-resize"]');
    expect(slider).not.toBeNull();
    // Both images render — before and after.
    const images = container.querySelectorAll('img');
    expect(images).toHaveLength(2);
    expect(images[0].getAttribute('src')).toBe('https://example.com/before.jpg');
    expect(images[1].getAttribute('src')).toBe('https://example.com/after.jpg');
  });

  it('renders a single still <img> when only imageUrl is present', () => {
    const { container } = render(
      <ProjectMedia imageUrl="https://example.com/only.jpg" title="putt-or-not" />,
    );
    const images = container.querySelectorAll('img');
    expect(images).toHaveLength(1);
    expect(images[0].getAttribute('src')).toBe('https://example.com/only.jpg');
    expect(images[0].getAttribute('alt')).toBe('putt-or-not');
  });

  it('renders nothing when neither URL is present', () => {
    const { container } = render(<ProjectMedia title="agentless" />);
    expect(container.firstChild).toBeNull();
  });

  it('falls back to still <img> when imageAfterUrl is set without imageUrl (defensive)', () => {
    // The slider requires both URLs. With only after, the still branch
    // returns null because primary imageUrl is absent.
    const { container } = render(
      <ProjectMedia imageAfterUrl="https://example.com/after.jpg" title="drumlog" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('uses the project title as the alt attribute on the still image', () => {
    const { container } = render(
      <ProjectMedia imageUrl="https://example.com/x.jpg" title="afford.lunch" />,
    );
    const img = container.querySelector('img');
    expect(img?.getAttribute('alt')).toBe('afford.lunch');
  });
});

describe('ProjectMedia — carousel branching on media prop', () => {
  it('renders the carousel when media has two or more items', () => {
    const { getByTestId } = render(
      <ProjectMedia
        title="putt-or-not"
        media={[mediaItem({ id: 'a' }), mediaItem({ id: 'b' })]}
      />,
    );
    const stub = getByTestId('project-media-carousel');
    expect(stub).toBeInTheDocument();
    expect(stub.getAttribute('data-count')).toBe('2');
  });

  it('passes the view prop through to the carousel', () => {
    const { getByTestId } = render(
      <ProjectMedia
        title="putt-or-not"
        view="detail"
        media={[mediaItem({ id: 'a' }), mediaItem({ id: 'b' })]}
      />,
    );
    expect(getByTestId('project-media-carousel').getAttribute('data-view')).toBe('detail');
  });

  it('defaults the carousel view to list when view is omitted', () => {
    const { getByTestId } = render(
      <ProjectMedia title="putt-or-not" media={[mediaItem({ id: 'a' })]} />,
    );
    expect(getByTestId('project-media-carousel').getAttribute('data-view')).toBe('list');
  });

  it('falls through to the legacy path when media is an empty array', () => {
    const { container, queryByTestId } = render(
      <ProjectMedia
        imageUrl="https://example.com/only.jpg"
        title="putt-or-not"
        media={[]}
      />,
    );
    expect(queryByTestId('project-media-carousel')).toBeNull();
    expect(container.querySelectorAll('img')).toHaveLength(1);
  });

  it('falls through to the legacy path when media is undefined', () => {
    const { container, queryByTestId } = render(
      <ProjectMedia imageUrl="https://example.com/only.jpg" title="putt-or-not" />,
    );
    expect(queryByTestId('project-media-carousel')).toBeNull();
    expect(container.querySelectorAll('img')).toHaveLength(1);
  });
});
