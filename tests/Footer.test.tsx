import { describe, it, expect, afterEach, vi } from 'vitest';
import { act, render, cleanup } from '@testing-library/react';
import { Footer } from '@/components/public/Footer';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** Bundle-verbatim odd-sentence pool. Kept in lockstep with `Footer.tsx`. */
const FOOTER_LINES = [
  "No cookies, no analytics, no idea what I'm doing.",
  "Made between disc golf rounds.",
  "Last edited at an embarrassing hour.",
  "Built mostly during things I should not have been doing.",
] as const;

/** Index Footer must use for its deterministic SSR / first-paint render. */
const SSR_DEFAULT_LINE_INDEX = 0;

describe('Footer — `line` prop override (deterministic, hydration-safe)', () => {
  it('renders the exact `line` prop string with no random replacement', () => {
    const explicit = 'Made between disc golf rounds.';
    const randomSpy = vi.spyOn(Math, 'random');
    let container!: HTMLElement;
    act(() => {
      ({ container } = render(<Footer line={explicit} />));
    });
    const footer = container.querySelector('footer');
    expect(footer).not.toBeNull();
    expect(footer!.textContent).toBe(explicit);
    // The effect runs after mount but must early-return when `line` is set,
    // so Math.random() must never have been called by Footer itself.
    expect(randomSpy).not.toHaveBeenCalled();
  });

  it('does not swap the text even after the post-mount effect fires (error/edge: line wins)', () => {
    const explicit = 'Last edited at an embarrassing hour.';
    let container!: HTMLElement;
    act(() => {
      ({ container } = render(<Footer line={explicit} />));
    });
    // Render + effect have both flushed inside the act() above. Text must
    // still be the explicit string — not a random pool entry.
    expect(container.querySelector('footer')!.textContent).toBe(explicit);
  });
});

describe('Footer — no `line` prop (random rotation, SSR-safe)', () => {
  it('after post-mount effect, text is one of the pool entries', () => {
    let container!: HTMLElement;
    act(() => {
      ({ container } = render(<Footer />));
    });
    const text = container.querySelector('footer')!.textContent ?? '';
    // Assert membership, not inequality — the random pick could legitimately
    // re-select FOOTER_LINES[SSR_DEFAULT_LINE_INDEX] by chance.
    expect(FOOTER_LINES).toContain(text);
  });

  it('honors a stubbed Math.random so the post-mount pick is deterministic', () => {
    // Force Math.random to return 0.75; with a 4-entry pool, Math.floor
    // yields index 3 — "Built mostly during things I should not have been
    // doing." Verifies the effect actually consumes Math.random.
    vi.spyOn(Math, 'random').mockReturnValue(0.75);
    let container!: HTMLElement;
    act(() => {
      ({ container } = render(<Footer />));
    });
    expect(container.querySelector('footer')!.textContent).toBe(
      FOOTER_LINES[3],
    );
  });

  it('SSR-safe shape: a render with Math.random stubbed to a known index still resolves to a pool entry (smoke)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    let container!: HTMLElement;
    act(() => {
      ({ container } = render(<Footer />));
    });
    // With random = 0, effect resolves to index 0 — the same string as the
    // deterministic SSR initial. Asserts the effect path produces a valid
    // pool entry equal to FOOTER_LINES[SSR_DEFAULT_LINE_INDEX] in this case.
    expect(container.querySelector('footer')!.textContent).toBe(
      FOOTER_LINES[SSR_DEFAULT_LINE_INDEX],
    );
  });
});
