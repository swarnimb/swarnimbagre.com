'use client'

import { useEffect, useState } from 'react'

interface FooterProps {
  line?: string;
}

/**
 * Bundle's odd-sentence footer. If `line` is provided, that string is used
 * verbatim and never replaced. If `line` is omitted, the SSR / first-paint
 * pass renders `FOOTER_LINES[0]` deterministically, then a post-mount
 * `useEffect` swaps in a random pick from `FOOTER_LINES`.
 *
 * Why the two-phase render: putting `Math.random()` inside the `useState`
 * initializer (the original bundle shape) executes on BOTH the server
 * render and the client mount, producing different markup most of the
 * time and tripping React 18 / 19 hydration. Deterministic-initial +
 * post-mount effect preserves the visible behaviour (random rotation on
 * each page visit) without the hydration mismatch.
 */

/** Bundle-verbatim odd-sentence pool. Keep in sync with
 *  `docs/design-source/personal-site-web/project/site/components.jsx`. */
const FOOTER_LINES = [
  "No cookies, no analytics, no idea what I'm doing.",
  "Made between disc golf rounds.",
  "Last edited at an embarrassing hour.",
  "Built mostly during things I should not have been doing.",
] as const;

/** Index used for the SSR / pre-hydration first paint so server and client
 *  agree on initial markup. Post-mount the effect picks at random. */
const SSR_DEFAULT_LINE_INDEX = 0;

export function Footer({ line }: FooterProps) {
  const [chosen, setChosen] = useState<string>(
    line ?? FOOTER_LINES[SSR_DEFAULT_LINE_INDEX],
  );
  useEffect(() => {
    if (line) return; // explicit `line` prop wins; no randomization.
    const pickIndex = Math.floor(Math.random() * FOOTER_LINES.length);
    setChosen(FOOTER_LINES[pickIndex]);
  }, [line]);
  return (
    <footer
      style={{
        marginTop: 96,
        paddingTop: 24,
        borderTop: "1px solid var(--hairline)",
        font: "var(--meta-sm)",
        color: "var(--fg-muted)",
        textTransform: "none",       // keep the sentence cased; meta-sm uppercases by default elsewhere
        letterSpacing: "0",
        fontFamily: "var(--font-mono)",
      }}
    >
      {chosen}
    </footer>
  );
}
