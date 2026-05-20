import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ProgressRing } from '@/components/public/ProgressRing';

afterEach(() => {
  cleanup();
});

/** Total number of <circle> elements expected when the done-glow is absent. */
const CIRCLES_WITHOUT_GLOW = 2;

/** Total number of <circle> elements expected when the done-glow is present. */
const CIRCLES_WITH_GLOW = 3;

/**
 * Read the `stroke-dashoffset` attribute from the progress arc (the last
 * <circle> in the SVG — drawn on top of the background ring). Returns a
 * finite number; tests assert on it directly.
 */
function readArcDashOffset(container: HTMLElement): number {
  const circles = container.querySelectorAll('circle');
  const arc = circles[circles.length - 1];
  const raw = arc.getAttribute('stroke-dashoffset');
  return raw === null ? Number.NaN : Number(raw);
}

describe('ProgressRing — happy path render at canonical percents', () => {
  it('renders an arc whose dash offset equals the full circumference at percent=0', () => {
    const { container } = render(<ProgressRing percent={0} />);
    const arc = container.querySelectorAll('circle')[1];
    const circumference = Number(arc.getAttribute('stroke-dasharray'));
    expect(readArcDashOffset(container)).toBeCloseTo(circumference, 5);
  });

  it('renders an arc whose dash offset equals 0 at percent=100', () => {
    const { container } = render(<ProgressRing percent={100} />);
    expect(readArcDashOffset(container)).toBeCloseTo(0, 5);
  });

  it('renders an arc at 25% with dash offset close to 3/4 of the circumference', () => {
    const { container } = render(<ProgressRing percent={25} />);
    const arc = container.querySelectorAll('circle')[1];
    const circumference = Number(arc.getAttribute('stroke-dasharray'));
    expect(readArcDashOffset(container)).toBeCloseTo(circumference * 0.75, 5);
  });

  it('renders an arc at 50% with dash offset close to half of the circumference', () => {
    const { container } = render(<ProgressRing percent={50} />);
    const arc = container.querySelectorAll('circle')[1];
    const circumference = Number(arc.getAttribute('stroke-dasharray'));
    expect(readArcDashOffset(container)).toBeCloseTo(circumference * 0.5, 5);
  });

  it('renders an arc at 75% with dash offset close to a quarter of the circumference', () => {
    const { container } = render(<ProgressRing percent={75} />);
    const arc = container.querySelectorAll('circle')[1];
    const circumference = Number(arc.getAttribute('stroke-dasharray'));
    expect(readArcDashOffset(container)).toBeCloseTo(circumference * 0.25, 5);
  });
});

describe('ProgressRing — done-glow gating', () => {
  it('renders the done-glow ring only when percent is exactly 100', () => {
    const { container } = render(<ProgressRing percent={100} />);
    expect(container.querySelectorAll('circle')).toHaveLength(CIRCLES_WITH_GLOW);
  });

  it('does not render the done-glow ring at 99', () => {
    const { container } = render(<ProgressRing percent={99} />);
    expect(container.querySelectorAll('circle')).toHaveLength(CIRCLES_WITHOUT_GLOW);
  });

  it('does not render the done-glow ring at 0', () => {
    const { container } = render(<ProgressRing percent={0} />);
    expect(container.querySelectorAll('circle')).toHaveLength(CIRCLES_WITHOUT_GLOW);
  });
});

describe('ProgressRing — null/undefined renders nothing', () => {
  it('returns null when percent is null', () => {
    const { container } = render(<ProgressRing percent={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when percent is undefined', () => {
    const { container } = render(<ProgressRing percent={undefined} />);
    expect(container.firstChild).toBeNull();
  });
});

describe('ProgressRing — bounds clamping for defensive inputs', () => {
  it('clamps negative percent to 0 (renders full-circumference offset)', () => {
    const { container } = render(<ProgressRing percent={-20} />);
    const arc = container.querySelectorAll('circle')[1];
    const circumference = Number(arc.getAttribute('stroke-dasharray'));
    expect(readArcDashOffset(container)).toBeCloseTo(circumference, 5);
  });

  it('clamps percent over 100 to 100 (renders done-glow and zero offset)', () => {
    const { container } = render(<ProgressRing percent={150} />);
    expect(container.querySelectorAll('circle')).toHaveLength(CIRCLES_WITH_GLOW);
    expect(readArcDashOffset(container)).toBeCloseTo(0, 5);
  });
});
