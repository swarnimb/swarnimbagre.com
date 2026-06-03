import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ProjectCard } from '@/components/public/ProjectCard';
import type { PublicProjectMediaItem } from '@/lib/types';

// Stub the carousel so these tests do not pull in embla. The path resolves to
// the same module `ProjectMedia.tsx` imports via `./ProjectMediaCarousel`.
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

/** Number of `<circle>` elements ProgressRing renders without the done glow. */
const RING_CIRCLES_WITHOUT_GLOW = 2;

/** Number of `<circle>` elements ProgressRing renders with the done glow. */
const RING_CIRCLES_WITH_GLOW = 3;

/**
 * The progress ring's wrapping `<span>` is the only element on the card that
 * carries `role="img"` with an `aria-label` starting "progress ". Scope all
 * ring assertions through it so any nested SVGs do not skew circle counts.
 */
function findRing(container: HTMLElement): HTMLElement | null {
  return container.querySelector('[role="img"][aria-label^="progress "]');
}

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

describe('ProjectCard — smoke render', () => {
  it('renders the title and blurb', () => {
    render(<ProjectCard title="putt-or-not" blurb="Disc golf stats tracker." />);
    expect(screen.getByText('putt-or-not')).toBeInTheDocument();
    expect(screen.getByText('Disc golf stats tracker.')).toBeInTheDocument();
  });
});

describe('ProjectCard — title-link gating (Override 3, T45.D)', () => {
  it('renders the title as a gold-underline link when onClick is provided', () => {
    render(
      <ProjectCard title="putt-or-not" blurb="b" onClick={() => {}} />,
    );
    const titleLink = screen.getByRole('link', { name: 'putt-or-not' });
    expect(titleLink).toBeInTheDocument();
    expect(titleLink).toHaveClass('link');
  });

  it('renders an inert title (no link, cursor default) when no onClick', () => {
    const { container } = render(
      <ProjectCard title="putt-or-not" blurb="b" />,
    );
    // The title heading exists...
    const heading = screen.getByRole('heading', { name: 'putt-or-not' });
    expect(heading).toBeInTheDocument();
    // ...but it is not wrapped in an anchor / `.link` affordance.
    expect(screen.queryByRole('link', { name: 'putt-or-not' })).toBeNull();
    expect(heading.querySelector('a')).toBeNull();
    expect(container.querySelector('.link')).toBeNull();
    // The card frame is non-interactive.
    const article = container.querySelector('article') as HTMLElement;
    expect(article.style.cursor).toBe('default');
  });
});

describe('ProjectCard — link rendering by URL presence', () => {
  it('renders all three TypoIcons when github, live, and post URLs are present', () => {
    render(
      <ProjectCard
        title="putt-or-not"
        blurb="Disc golf stats tracker."
        githubUrl="https://github.com/sb/putt"
        liveUrl="https://putt.example"
        postUrl="/writing/putt"
      />,
    );
    expect(screen.getByTitle('code')).toBeInTheDocument();
    expect(screen.getByTitle('site')).toBeInTheDocument();
    expect(screen.getByTitle('notes')).toBeInTheDocument();
  });

  it('renders zero TypoIcons (and hides the link row) when no URLs are present', () => {
    const { container } = render(
      <ProjectCard title="afford.lunch" blurb="A finance app." />,
    );
    expect(container.querySelectorAll('a[title]')).toHaveLength(0);
  });

  it('renders only the github icon when only githubUrl is present', () => {
    render(
      <ProjectCard
        title="drumlog"
        blurb="Drum practice timer."
        githubUrl="https://github.com/sb/drumlog"
      />,
    );
    expect(screen.getByTitle('code')).toBeInTheDocument();
    expect(screen.queryByTitle('site')).not.toBeInTheDocument();
    expect(screen.queryByTitle('notes')).not.toBeInTheDocument();
  });
});

describe('ProjectCard — progress ring gating', () => {
  it('renders the ring (no glow) at progress=0', () => {
    const { container } = render(
      <ProjectCard title="t" blurb="b" progressPercent={0} />,
    );
    const ring = findRing(container);
    expect(ring).not.toBeNull();
    expect(ring!.querySelectorAll('circle')).toHaveLength(RING_CIRCLES_WITHOUT_GLOW);
  });

  it('renders the ring with done glow at progress=100', () => {
    const { container } = render(
      <ProjectCard title="t" blurb="b" progressPercent={100} />,
    );
    const ring = findRing(container);
    expect(ring).not.toBeNull();
    expect(ring!.querySelectorAll('circle')).toHaveLength(RING_CIRCLES_WITH_GLOW);
  });

  it('renders no ring at all when progress is null', () => {
    const { container } = render(
      <ProjectCard title="t" blurb="b" progressPercent={null} />,
    );
    expect(findRing(container)).toBeNull();
  });
});

describe('ProjectCard — media branching', () => {
  it('renders the legacy single still <img> and no carousel when media is omitted', () => {
    const { container } = render(
      <ProjectCard
        title="putt-or-not"
        blurb="b"
        imageUrl="https://example.com/only.jpg"
      />,
    );
    expect(screen.queryByTestId('project-media-carousel')).toBeNull();
    const images = container.querySelectorAll('img');
    expect(images).toHaveLength(1);
    expect(images[0].getAttribute('src')).toBe('https://example.com/only.jpg');
  });

  it('renders the carousel stub with data-view="list" when media rows are present', () => {
    render(
      <ProjectCard
        title="putt-or-not"
        blurb="b"
        media={[mediaItem({ id: 'a' }), mediaItem({ id: 'b' })]}
      />,
    );
    const stub = screen.getByTestId('project-media-carousel');
    expect(stub).toBeInTheDocument();
    expect(stub.getAttribute('data-view')).toBe('list');
    expect(stub.getAttribute('data-count')).toBe('2');
  });

  it('falls through to the legacy path when media is an empty array', () => {
    const { container } = render(
      <ProjectCard
        title="putt-or-not"
        blurb="b"
        imageUrl="https://example.com/only.jpg"
        media={[]}
      />,
    );
    expect(screen.queryByTestId('project-media-carousel')).toBeNull();
    expect(container.querySelectorAll('img')).toHaveLength(1);
  });
});
