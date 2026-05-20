import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MobileProjectRow } from '@/components/public/mobile/MobileProjectRow';

afterEach(() => {
  cleanup();
});

/** Number of `<circle>` elements ProgressRing renders without the done glow. */
const RING_CIRCLES_WITHOUT_GLOW = 2;

/** Number of `<circle>` elements ProgressRing renders with the done glow. */
const RING_CIRCLES_WITH_GLOW = 3;

/**
 * The progress ring's wrapping `<span>` is the only element on the row that
 * carries `role="img"` with an `aria-label` starting "progress ". Scope all
 * ring assertions through it so any nested SVGs do not skew circle counts.
 */
function findRing(container: HTMLElement): HTMLElement | null {
  return container.querySelector('[role="img"][aria-label^="progress "]');
}

describe('MobileProjectRow — link rendering by URL presence', () => {
  it('renders all three TypoIcons when github, live, and post URLs are present', () => {
    render(
      <MobileProjectRow
        index={1}
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
      <MobileProjectRow index={2} title="afford.lunch" blurb="A finance app." />,
    );
    expect(container.querySelectorAll('a[title]')).toHaveLength(0);
  });

  it('renders only the github icon when only githubUrl is present', () => {
    render(
      <MobileProjectRow
        index={3}
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
      <MobileProjectRow
        index={4}
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
      <MobileProjectRow
        index={5}
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

describe('MobileProjectRow — progress ring gating', () => {
  it('renders the ring (no glow) at progress=0', () => {
    const { container } = render(
      <MobileProjectRow index={1} title="t" blurb="b" progressPercent={0} />,
    );
    const ring = findRing(container);
    expect(ring).not.toBeNull();
    expect(ring!.querySelectorAll('circle')).toHaveLength(RING_CIRCLES_WITHOUT_GLOW);
  });

  it('renders the ring with done glow at progress=100', () => {
    const { container } = render(
      <MobileProjectRow index={1} title="t" blurb="b" progressPercent={100} />,
    );
    const ring = findRing(container);
    expect(ring).not.toBeNull();
    expect(ring!.querySelectorAll('circle')).toHaveLength(RING_CIRCLES_WITH_GLOW);
  });

  it('renders no ring at all when progress is null', () => {
    const { container } = render(
      <MobileProjectRow index={1} title="t" blurb="b" progressPercent={null} />,
    );
    expect(findRing(container)).toBeNull();
  });

  it('renders no ring at all when progress is undefined', () => {
    const { container } = render(<MobileProjectRow index={1} title="t" blurb="b" />);
    expect(findRing(container)).toBeNull();
  });
});

describe('MobileProjectRow — bundle continuity', () => {
  it('does not render the legacy StatusPill on the row', () => {
    const { container } = render(
      <MobileProjectRow index={1} title="t" blurb="b" progressPercent={50} />,
    );
    expect(container.textContent).not.toMatch(/ACTIVE|DORMANT|SHIPPED|ABANDONED/i);
  });

  it('renders the zero-padded two-digit index label', () => {
    const { container } = render(
      <MobileProjectRow index={7} title="t" blurb="b" />,
    );
    expect(container.textContent).toContain('07');
  });
});
