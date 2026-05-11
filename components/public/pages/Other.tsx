'use client'

// Other — flexible page for hobbies and life-things.
// "Currently" stats wall. Must look intentional even when nearly empty.

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { resolveNavPath } from '@/lib/nav-targets';
import { Page } from '@/components/public/Page';
import { Nav } from '@/components/public/Nav';
import { Footer } from '@/components/public/Footer';
import { SectionHead } from '@/components/public/SectionHead';

// Stats wall. Label + value, minimal. Some empty on purpose to show empty state.
const DEFAULT_STATS = [
  { label: "basketball PR",       value: "32",        unit: "free throws in a row, allegedly" },
  { label: "drum hours",          value: "11.5",      unit: "logged this month" },
  { label: "disc golf handicap",  value: "+8",        unit: "trending the wrong way" },
  { label: "tennis matches",      value: "4–11",      unit: "this season, generously counted" },
  { label: "volleyball position", value: "wherever",  unit: "they need a tall person" },
  { label: "currently reading",   value: "Stoner",    unit: "by John Williams" },
  { label: "books finished, 2026",value: "07",        unit: "started: 19" },
  { label: "longest walk",        value: "22 km",     unit: "no destination, no excuse" },
];

export interface StatItem {
  label: string;
  value: string;
  unit: string | null;
}

interface OtherProps {
  stats?: StatItem[];
}

export function Other({ stats = DEFAULT_STATS }: OtherProps = {}) {
  const router = useRouter();
  const onNav = useCallback((target: string) => {
    router.push(resolveNavPath(target));
  }, [router]);

  // Some "lists" — small, intentionally lo-fi.
  const watching = [
    "Severance, second time",
    "every disc golf tournament with commentary",
    "the kettle, mostly",
  ];
  const considering = [
    "learning bass instead of drums",
    "a third pickup attempt at chess",
    "growing a beard, badly",
  ];

  return (
    <Page>
      <Nav current="other" onNav={onNav} resolveHref={resolveNavPath} />

      <header style={{ padding: "72px 0 16px", maxWidth: 720 }}>
        <h1 style={{
          font: "300 italic clamp(48px, 6vw, 72px)/1 var(--font-serif)",
          letterSpacing: "-0.025em",
          color: "var(--fg-strong)",
          margin: 0,
          fontVariationSettings: '"SOFT" 100, "WONK" 1',
        }}>
          everything else
        </h1>
        <p style={{
          font: "var(--body-lg)",
          color: "var(--fg-muted)",
          marginTop: 20,
          textWrap: "pretty",
          maxWidth: 560,
        }}>
          Hobbies, sports I am mediocre at, things I'm tracking just to feel
          slightly less unobserved.
        </p>
      </header>

      {/* Stats wall — asymmetric grid. Big numbers in serif, labels in mono. */}
      <SectionHead symbol="※" top={48}>currently</SectionHead>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          columnGap: 32,
          rowGap: 36,
          marginTop: 32,
        }}
      >
        {stats.map((s) => (
          <div key={s.label} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{
              font: "var(--meta-sm)",
              color: "var(--fg-muted)",
              letterSpacing: "0.14em",
            }}>
              {s.label}
            </span>
            <span style={{
              font: "400 38px/1 var(--font-serif)",
              color: "var(--fg-strong)",
              letterSpacing: "-0.02em",
            }}>
              {s.value}
            </span>
            <span style={{ font: "var(--body-sm)", color: "var(--fg-faint)" }}>
              {s.unit}
            </span>
          </div>
        ))}
      </div>

      {/* Two short lists — asymmetric, not a 3-col grid. */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)",
          gap: 64,
          marginTop: 80,
        }}
      >
        <div>
          <SectionHead symbol="¶" top={0}>watching, half-attentively</SectionHead>
          <ul style={{ listStyle: "none", padding: 0, margin: "20px 0 0" }}>
            {watching.map((w, i) => (
              <li key={i} style={{
                font: "400 19px/1.5 var(--font-serif)",
                color: "var(--fg)",
                padding: "10px 0",
                borderBottom: "1px solid var(--hairline)",
              }}>
                {w}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <SectionHead symbol="*" top={0}>considering, badly</SectionHead>
          <ul style={{ listStyle: "none", padding: 0, margin: "20px 0 0" }}>
            {considering.map((w, i) => (
              <li key={i} style={{
                font: "400 19px/1.5 var(--font-serif)",
                color: "var(--fg)",
                padding: "10px 0",
                borderBottom: "1px solid var(--hairline)",
              }}>
                {w}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Empty state — required to demonstrate. */}
      <SectionHead symbol="*" top={80}>collections</SectionHead>
      <div
        style={{
          marginTop: 32,
          padding: "56px 0 64px",
          borderBottom: "1px solid var(--hairline)",
          textAlign: "left",
        }}
      >
        <p style={{
          font: "400 italic 28px/1.4 var(--font-serif)",
          color: "var(--fg-muted)",
          margin: 0,
          maxWidth: 540,
          fontVariationSettings: '"SOFT" 100, "WONK" 1',
        }}>
          Nothing here yet. Probably outside losing at something.
        </p>
        <p style={{
          font: "var(--meta-sm)",
          color: "var(--fg-faint)",
          marginTop: 16,
          letterSpacing: "0.14em",
        }}>
          ※ EMPTY STATE — INTENTIONAL
        </p>
      </div>

      <div style={{ flex: 1 }} />
      <Footer line="Built mostly during things I should not have been doing." />
    </Page>
  );
}
