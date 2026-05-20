'use client'

/**
 * ProgressRing — circular progress indicator for project cards.
 *
 * SVG with two concentric strokes: a faint background ring and an accent arc
 * drawn via `stroke-dasharray`. When `percent === 100`, an outer glow halo
 * renders to mark the done state. Returns `null` when `percent` is null or
 * undefined so cards with no progress data render no ring at all.
 *
 * Introduced by T42 (CONSTRAINT-05 Override 1, Session B). All styling pulls
 * from the existing CSS variables in `site/colors_and_type.css` — no new
 * tokens, no hex literals.
 */

import type { JSX } from 'react';

/** Outer ring diameter in px when caller does not pass `size`. */
const DEFAULT_SIZE = 28;

/** Stroke thickness in px for both rings. Visually balanced for sizes 20–40. */
const STROKE_WIDTH = 2;

/** Percent value that triggers the done-state glow. */
const DONE_PERCENT = 100;

/** Radius of the soft glow halo, in px beyond the outer ring edge. */
const GLOW_RADIUS = 4;

interface ProgressRingProps {
  /** 0–100 inclusive, or null/undefined to render nothing. */
  percent: number | null | undefined;
  /** Outer diameter in px. Defaults to 28. */
  size?: number;
}

/**
 * Render the progress ring SVG, or `null` when no progress is set.
 *
 * @param props.percent Integer 0–100, or null/undefined.
 * @param props.size    Outer diameter in px. Defaults to 28.
 */
export function ProgressRing({ percent, size = DEFAULT_SIZE }: ProgressRingProps): JSX.Element | null {
  if (percent === null || percent === undefined) return null;
  const clamped = Math.max(0, Math.min(DONE_PERCENT, percent));
  const center = size / 2;
  const radius = center - STROKE_WIDTH;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - clamped / DONE_PERCENT);
  const isDone = clamped === DONE_PERCENT;
  const boxSize = size + GLOW_RADIUS * 2;
  return (
    <span
      aria-label={`progress ${clamped}%`}
      role="img"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: boxSize,
        height: boxSize,
        flex: '0 0 auto',
      }}
    >
      <svg width={boxSize} height={boxSize} viewBox={`0 0 ${boxSize} ${boxSize}`} aria-hidden="true">
        {isDone && (
          <circle
            cx={boxSize / 2}
            cy={boxSize / 2}
            r={radius + GLOW_RADIUS / 2}
            fill="none"
            stroke="var(--accent-glow)"
            strokeWidth={GLOW_RADIUS}
          />
        )}
        <circle
          cx={boxSize / 2}
          cy={boxSize / 2}
          r={radius}
          fill="none"
          stroke="var(--hairline-2)"
          strokeWidth={STROKE_WIDTH}
        />
        <circle
          cx={boxSize / 2}
          cy={boxSize / 2}
          r={radius}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${boxSize / 2} ${boxSize / 2})`}
        />
      </svg>
    </span>
  );
}
