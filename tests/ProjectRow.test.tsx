import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ProjectRow } from '@/components/public/ProjectRow';

afterEach(() => {
  cleanup();
});

/** Number of `<circle>` elements ProgressRing renders without the done glow. */
const RING_CIRCLES_WITHOUT_GLOW = 2;

/** Number of `<circle>` elements ProgressRing renders with the done glow. */
const RING_CIRCLES_WITH_GLOW = 3;

describe('ProjectRow — link rendering by URL presence', () => {
  it('renders all three TypoIcons when github, live, and post URLs are present', () => {
    render(
      <ProjectRow
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
      <ProjectRow title="afford.lunch" blurb="A finance app." />,
    );
    expect(container.querySelectorAll('a[title]')).toHaveLength(0);
  });

  it('renders only the github icon when only githubUrl is present', () => {
    render(
      <ProjectRow
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
      <ProjectRow
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
      <ProjectRow
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

/**
 * The progress ring's wrapping `<span>` is the only element on the row that
 * carries `role="img"` with an `aria-label` starting "progress ". Scope all
 * ring assertions through it so the thumbnail SVG's circles do not skew counts.
 */
function findRing(container: HTMLElement): HTMLElement | null {
  return container.querySelector('[role="img"][aria-label^="progress "]');
}

describe('ProjectRow — progress ring gating', () => {
  it('renders the ring (no glow) at progress=0', () => {
    const { container } = render(
      <ProjectRow title="t" blurb="b" progressPercent={0} />,
    );
    const ring = findRing(container);
    expect(ring).not.toBeNull();
    expect(ring!.querySelectorAll('circle')).toHaveLength(RING_CIRCLES_WITHOUT_GLOW);
  });

  it('renders the ring with done glow at progress=100', () => {
    const { container } = render(
      <ProjectRow title="t" blurb="b" progressPercent={100} />,
    );
    const ring = findRing(container);
    expect(ring).not.toBeNull();
    expect(ring!.querySelectorAll('circle')).toHaveLength(RING_CIRCLES_WITH_GLOW);
  });

  it('renders no ring at all when progress is null', () => {
    const { container } = render(
      <ProjectRow title="t" blurb="b" progressPercent={null} />,
    );
    expect(findRing(container)).toBeNull();
  });

  it('renders no ring at all when progress is undefined', () => {
    const { container } = render(<ProjectRow title="t" blurb="b" />);
    expect(findRing(container)).toBeNull();
  });
});

describe('ProjectRow — bundle continuity', () => {
  it('does not render the legacy StatusPill on the card', () => {
    const { container } = render(
      <ProjectRow title="t" blurb="b" progressPercent={50} />,
    );
    // StatusPill uses uppercase letterspaced status text inside a rounded span.
    // We assert against the data shape by checking no element has the text
    // "ACTIVE" / "DORMANT" / "SHIPPED" that the pill would have emitted.
    expect(container.textContent).not.toMatch(/ACTIVE|DORMANT|SHIPPED|ABANDONED/i);
  });

  it('still renders the project thumbnail at the configured kind', () => {
    const { container } = render(
      <ProjectRow title="t" blurb="b" thumbKind="disc" />,
    );
    // ProjectThumb renders an inline SVG inside a 56px square span.
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
