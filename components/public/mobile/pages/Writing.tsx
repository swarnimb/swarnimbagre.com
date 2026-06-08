'use client'

// WritingMobile — same magazine list, single-column with date stacked
// above the title (no two-col grid).

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { resolveNavPath } from '@/lib/nav-targets';
import { MobilePage } from '@/components/public/mobile/MobilePage';
import { MobileNav } from '@/components/public/mobile/MobileNav';
import { MobileFooter } from '@/components/public/mobile/MobileFooter';
import { MobilePageTitle } from '@/components/public/mobile/MobilePageTitle';

const DEFAULT_POSTS = [
  { date: "APR 2026", title: "Things I learned by quitting my todo app, three times",
    desc:  "A short essay about systems, in which the system is mostly me." },
  { date: "FEB 2026", title: "On being mediocre, on purpose",
    desc:  "Why I pick hobbies I'm bad at, and why everyone telling me to pick one is wrong." },
  { date: "DEC 2025", title: "I taught an LLM to argue with my disc golf scorecard",
    desc:  "Build log. Mostly a long list of edge cases for what counts as a 'fair' birdie." },
  { date: "OCT 2025", title: "Personal finance, but only the next 90 minutes",
    desc:  "Why most budgeting tools fail at the only question I actually ask." },
  { date: "JUL 2025", title: "Agents, frameworks, and the fine art of half-reading docs",
    desc:  "A field report from someone who built one anyway." },
  { date: "MAY 2025", title: "Volleyball: a beginner's grief manual",
    desc:  "I started at 28. Here is everything that hurts now." },
  { date: "FEB 2025", title: "Tennis, but mostly an essay about giving up",
    desc:  "And then unquitting the next morning, because that's the whole bit." },
];

export interface WritingItem {
  date: string;
  title: string;
  desc: string;
  /** When present, the row's title link navigates to this URL. */
  href?: string;
}

interface WritingProps {
  items?: WritingItem[];
}

export function Writing({ items = DEFAULT_POSTS }: WritingProps = {}) {
  const router = useRouter();
  const onNav = useCallback((target: string) => {
    router.push(resolveNavPath(target));
  }, [router]);

  return (
    <MobilePage>
      <MobileNav current="writing" onNav={onNav} resolveHref={resolveNavPath} />

      <MobilePageTitle
        title="writing"
        sub="Mostly essays I wrote to figure out what I think. Occasionally a build log. Never a thread."
      />

      <ul style={{ listStyle: "none", padding: 0, margin: "16px 0 0" }}>
        {items.map((p, i) => (
          <li
            key={i}
            style={{
              padding: "20px 0",
              borderBottom: "1px solid var(--hairline)",
            }}
          >
            <div style={{
              font: "var(--meta-sm)",
              color: "var(--fg-faint)",
              letterSpacing: "0.16em",
              marginBottom: 10,
            }}>
              {p.date}
            </div>
            <h2 style={{
              font: "400 22px/1.25 var(--font-serif)",
              color: "var(--fg-strong)",
              letterSpacing: "-0.012em",
              margin: 0,
            }}>
              {p.href ? (
                <a href={p.href} className="link"
                   style={{ display: "inline-block", padding: "4px 0", minHeight: 32 }}>
                  {p.title}
                </a>
              ) : (
                <a href="#" className="link"
                   onClick={(e) => e.preventDefault()}
                   style={{ display: "inline-block", padding: "4px 0", minHeight: 32 }}>
                  {p.title}
                </a>
              )}
            </h2>
            <p style={{
              font: "var(--body)",
              color: "var(--fg-muted)",
              margin: "8px 0 0",
              textWrap: "pretty",
            }}>
              {p.desc}
            </p>
          </li>
        ))}
      </ul>

      <div style={{ flex: 1 }} />
      <MobileFooter line="Thinking out loud, with a publish button." />
    </MobilePage>
  );
}
