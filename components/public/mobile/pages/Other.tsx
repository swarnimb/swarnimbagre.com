'use client'

// OtherMobile — currently/stats wall in single column,
// followed by the two short lists stacked, then empty state.

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { resolveNavPath } from '@/lib/nav-targets';
import { MobilePage } from '@/components/public/mobile/MobilePage';
import { MobileNav } from '@/components/public/mobile/MobileNav';
import { MobileFooter } from '@/components/public/mobile/MobileFooter';
import { MobilePageTitle } from '@/components/public/mobile/MobilePageTitle';
import { SectionHead } from '@/components/public/SectionHead';

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
    <MobilePage>
      <MobileNav current="other" onNav={onNav} resolveHref={resolveNavPath} />

      <MobilePageTitle
        title={<>everything<br/>else</>}
        sub="Hobbies, sports I am mediocre at, things I'm tracking just to feel slightly less unobserved."
      />

      <SectionHead symbol="※" top={32}>currently</SectionHead>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        columnGap: 18,
        rowGap: 24,
        marginTop: 20,
      }}>
        {stats.map((s) => (
          <div key={s.label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{
              font: "var(--meta-sm)",
              color: "var(--fg-muted)",
              letterSpacing: "0.12em",
            }}>
              {s.label}
            </span>
            <span style={{
              font: "400 28px/1 var(--font-serif)",
              color: "var(--fg-strong)",
              letterSpacing: "-0.02em",
              wordBreak: "break-word",
            }}>
              {s.value}
            </span>
            <span style={{
              font: "var(--body-sm)",
              color: "var(--fg-faint)",
              textWrap: "pretty",
            }}>
              {s.unit}
            </span>
          </div>
        ))}
      </div>

      {/* Watching + considering, stacked */}
      <SectionHead symbol="¶" top={56}>watching, half-attentively</SectionHead>
      <ul style={{ listStyle: "none", padding: 0, margin: "16px 0 0" }}>
        {watching.map((w, i) => (
          <li key={i} style={{
            font: "400 17px/1.5 var(--font-serif)",
            color: "var(--fg)",
            padding: "12px 0",
            borderBottom: "1px solid var(--hairline)",
          }}>
            {w}
          </li>
        ))}
      </ul>

      <SectionHead symbol="*" top={48}>considering, badly</SectionHead>
      <ul style={{ listStyle: "none", padding: 0, margin: "16px 0 0" }}>
        {considering.map((w, i) => (
          <li key={i} style={{
            font: "400 17px/1.5 var(--font-serif)",
            color: "var(--fg)",
            padding: "12px 0",
            borderBottom: "1px solid var(--hairline)",
          }}>
            {w}
          </li>
        ))}
      </ul>

      <SectionHead symbol="*" top={56}>collections</SectionHead>
      <div style={{
        marginTop: 20,
        padding: "32px 0 40px",
        borderBottom: "1px solid var(--hairline)",
      }}>
        <p style={{
          font: "400 italic 22px/1.4 var(--font-serif)",
          color: "var(--fg-muted)",
          margin: 0,
          fontVariationSettings: '"SOFT" 100, "WONK" 1',
          textWrap: "pretty",
        }}>
          Nothing here yet. Probably outside losing at something.
        </p>
        <p style={{
          font: "var(--meta-sm)",
          color: "var(--fg-faint)",
          marginTop: 14,
          letterSpacing: "0.14em",
        }}>
          ※ EMPTY STATE — INTENTIONAL
        </p>
      </div>

      <div style={{ flex: 1 }} />
      <MobileFooter line="Numbers I track just to prove I spent time on this." />
    </MobilePage>
  );
}
