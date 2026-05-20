import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MobileProjectCard } from '@/components/public/mobile/MobileProjectCard';

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

describe('MobileProjectCard — link rendering by URL presence', () => {
  it('renders all three TypoIcons when github, live, and post URLs are present', () => {
    render(
      <MobileProjectCard
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
      <MobileProjectCard title="afford.lunch" blurb="A finance app." />,
    );
    expect(container.querySelectorAll('a[title]')).toHaveLength(0);
  });

  it('renders only the github icon when only githubUrl is present', () => {
    render(
      <MobileProjectCard
        title="drumlog"
        blurb="Drum practice timer."
        githubUrl="https://github.com/sb/drumlog"
      />,
    );
    expect(screen.getByTitle('code')).toBeInTheDocument();
    expect(screen.queryByTitle('site')).not.toBeInTheDocument();
    expect(screen.queryByTitle('notes')).not.toBeInTheDocument();
  });

  it('renders only live + post when github is null but live and post are set', () => {
    render(
      <MobileProjectCard
        title="tennis-elbow"
        blurb="Match log spreadsheet."
        githubUrl={null}
        liveUrl="https://tennis.example"
        postUrl="/writing/tennis"
      />,
    );
    expect(screen.queryByTitle('code')).not.toBeInTheDocument();
    expect(screen.getByTitle('site')).toBeInTheDocument();
    expect(screen.getByTitle('notes')).toBeInTheDocument();
  });

  it('uses the URL as the anchor href so the bundle hover treatment receives a real target', () => {
    render(
      <MobileProjectCard
        title="agentless"
        blurb="Agent framework experiments."
        githubUrl="https://github.com/sb/agentless"
      />,
    );
    expect(screen.getByTitle('code')).toHaveAttribute(
      'href',
      'https://github.com/sb/agentless',
    );
  });
});

describe('MobileProjectCard — progress ring gating', () => {
  it('renders the ring (no glow) at progress=0', () => {
    const { container } = render(
      <MobileProjectCard title="t" blurb="b" progressPercent={0} />,
    );
    const ring = findRing(container);
    expect(ring).not.toBeNull();
    expect(ring!.querySelectorAll('circle')).toHaveLength(RING_CIRCLES_WITHOUT_GLOW);
  });

  it('renders the ring with done glow at progress=100', () => {
    const { container } = render(
      <MobileProjectCard title="t" blurb="b" progressPercent={100} />,
    );
    const ring = findRing(container);
    expect(ring).not.toBeNull();
    expect(ring!.querySelectorAll('circle')).toHaveLength(RING_CIRCLES_WITH_GLOW);
  });

  it('renders no ring at all when progress is null', () => {
    const { container } = render(
      <MobileProjectCard title="t" blurb="b" progressPercent={null} />,
    );
    expect(findRing(container)).toBeNull();
  });

  it('renders no ring at all when progress is undefined', () => {
    const { container } = render(<MobileProjectCard title="t" blurb="b" />);
    expect(findRing(container)).toBeNull();
  });
});

describe('MobileProjectCard — media branching', () => {
  it('renders the before/after slider when both imageUrl and imageAfterUrl are present', () => {
    const { container } = render(
      <MobileProjectCard
        title="tennis-elbow"
        blurb="b"
        imageUrl="https://example.com/before.jpg"
        imageAfterUrl="https://example.com/after.jpg"
      />,
    );
    // BeforeAfterMedia renders the draggable wrapper with cursor:ew-resize.
    expect(container.querySelector('[style*="ew-resize"]')).not.toBeNull();
    const images = container.querySelectorAll('img');
    expect(images).toHaveLength(2);
  });

  it('renders a single still <img> when only imageUrl is present', () => {
    const { container } = render(
      <MobileProjectCard
        title="putt-or-not"
        blurb="b"
        imageUrl="https://example.com/only.jpg"
      />,
    );
    const images = container.querySelectorAll('img');
    expect(images).toHaveLength(1);
    expect(images[0].getAttribute('src')).toBe('https://example.com/only.jpg');
  });

  it('renders no <img> when both imageUrl and imageAfterUrl are null', () => {
    const { container } = render(<MobileProjectCard title="t" blurb="b" />);
    expect(container.querySelectorAll('img')).toHaveLength(0);
  });
});

describe('MobileProjectCard — bundle continuity', () => {
  it('does not render the legacy StatusPill on the card', () => {
    const { container } = render(
      <MobileProjectCard title="t" blurb="b" progressPercent={50} />,
    );
    // StatusPill uses uppercase letterspaced status text. Assert against the
    // shape by checking no element has the text any pill status would emit.
    expect(container.textContent).not.toMatch(/ACTIVE|DORMANT|SHIPPED|ABANDONED/i);
  });
});
