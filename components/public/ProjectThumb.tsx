'use client'

import type { JSX } from 'react';

type ProjectThumbKind = "disc" | "coin" | "nodes" | "bars" | "racquet" | "card" | "contacts" | "site" | "prompt" | "dots" | string;

interface ProjectThumbProps {
  kind?: ProjectThumbKind;
  size?: number;
}

/* ProjectThumb — tiny, non-intrusive 56px square. Each "kind" is a hand-tuned
   abstract motif (no clipart). Uses currentColor so it sits in the editorial
   palette and never competes with type. */
export function ProjectThumb({ kind = "dots", size = 56 }: ProjectThumbProps) {
  const stroke = "var(--fg-muted)";
  const faint  = "var(--hairline-2)";
  const accent = "var(--accent)";

  const motifs: Record<string, JSX.Element> = {
    // putt-or-not — basket + flight path
    disc: (
      <>
        <path d="M6 38 Q 22 8, 44 30" fill="none" stroke={stroke} strokeWidth="1.2" strokeLinecap="round"/>
        <circle cx="44" cy="30" r="2.2" fill={accent}/>
        <line x1="44" y1="30" x2="44" y2="46" stroke={stroke} strokeWidth="1.2"/>
        <ellipse cx="44" cy="46" rx="6" ry="1.6" fill="none" stroke={stroke} strokeWidth="1.2"/>
      </>
    ),
    // afford.lunch — coin + crumb
    coin: (
      <>
        <circle cx="22" cy="28" r="11" fill="none" stroke={stroke} strokeWidth="1.2"/>
        <text x="22" y="32" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="11" fill={stroke}>$</text>
        <circle cx="40" cy="40" r="2" fill={accent}/>
      </>
    ),
    // agentless — three nodes, broken link
    nodes: (
      <>
        <circle cx="14" cy="20" r="3"  fill="none" stroke={stroke} strokeWidth="1.2"/>
        <circle cx="36" cy="16" r="3"  fill="none" stroke={stroke} strokeWidth="1.2"/>
        <circle cx="28" cy="40" r="3"  fill="none" stroke={stroke} strokeWidth="1.2"/>
        <line x1="17" y1="21" x2="33" y2="17" stroke={stroke} strokeWidth="1" strokeDasharray="2 2"/>
        <line x1="36" y1="19" x2="29" y2="37" stroke={stroke} strokeWidth="1"/>
        <line x1="14" y1="23" x2="26" y2="38" stroke={faint}  strokeWidth="1"/>
      </>
    ),
    // drumlog — bars, rising tempo
    bars: (
      <>
        <rect x="10" y="32" width="4" height="12" fill={stroke}/>
        <rect x="18" y="26" width="4" height="18" fill={stroke}/>
        <rect x="26" y="20" width="4" height="24" fill={stroke}/>
        <rect x="34" y="14" width="4" height="30" fill={accent}/>
      </>
    ),
    // tennis-elbow — racquet outline
    racquet: (
      <>
        <ellipse cx="20" cy="22" rx="11" ry="13" fill="none" stroke={stroke} strokeWidth="1.2" transform="rotate(-25 20 22)"/>
        <line x1="29" y1="32" x2="44" y2="46" stroke={stroke} strokeWidth="1.4" strokeLinecap="round"/>
        <line x1="12" y1="14" x2="28" y2="30" stroke={faint} strokeWidth="0.8"/>
        <line x1="22" y1="10" x2="22" y2="34" stroke={faint} strokeWidth="0.8" transform="rotate(-25 20 22)"/>
      </>
    ),
    // CardMaxxer — card outline + magstripe, accent perk dot
    card: (
      <>
        <rect x="8" y="16" width="34" height="22" rx="2.5" fill="none" stroke={stroke} strokeWidth="1.2"/>
        <line x1="10" y1="22" x2="40" y2="22" stroke={stroke} strokeWidth="2.5"/>
        <circle cx="35" cy="32" r="1.8" fill={accent}/>
      </>
    ),
    // SalesRep CRM — contact node linked to a record list, accent follow-up
    contacts: (
      <>
        <circle cx="15" cy="17" r="5" fill="none" stroke={stroke} strokeWidth="1.2"/>
        <path d="M7 31 Q15 23 23 31" fill="none" stroke={stroke} strokeWidth="1.2" strokeLinecap="round"/>
        <line x1="30" y1="16" x2="43" y2="16" stroke={stroke} strokeWidth="1.2" strokeLinecap="round"/>
        <line x1="30" y1="24" x2="43" y2="24" stroke={faint} strokeWidth="1.2" strokeLinecap="round"/>
        <line x1="30" y1="32" x2="38" y2="32" stroke={faint} strokeWidth="1.2" strokeLinecap="round"/>
        <circle cx="42" cy="32" r="2" fill={accent}/>
      </>
    ),
    // swarnimbagre.com — browser frame + accent cursor caret
    site: (
      <>
        <rect x="8" y="12" width="34" height="26" rx="2.5" fill="none" stroke={stroke} strokeWidth="1.2"/>
        <line x1="8" y1="19" x2="42" y2="19" stroke={stroke} strokeWidth="1.2"/>
        <circle cx="12.5" cy="15.5" r="1" fill={faint}/>
        <circle cx="16.5" cy="15.5" r="1" fill={faint}/>
        <line x1="14" y1="26" x2="30" y2="26" stroke={faint} strokeWidth="1.2" strokeLinecap="round"/>
        <line x1="14" y1="31" x2="24" y2="31" stroke={faint} strokeWidth="1.2" strokeLinecap="round"/>
        <line x1="28" y1="31" x2="28" y2="34" stroke={accent} strokeWidth="1.4" strokeLinecap="round"/>
      </>
    ),
    // Claude Code Magic — CLI prompt + cursor, accent spark
    prompt: (
      <>
        <path d="M13 19 L22 28 L13 37" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        <line x1="26" y1="36" x2="36" y2="36" stroke={stroke} strokeWidth="1.6" strokeLinecap="round"/>
        <path d="M37 14 L37 22 M33 18 L41 18" stroke={accent} strokeWidth="1.2" strokeLinecap="round"/>
      </>
    ),
    // generic dotted square — fallback
    dots: (
      <g fill={stroke}>
        {[0,1,2,3].map(r => [0,1,2,3].map(c => (
          <circle key={`${r}${c}`} cx={14 + c*8} cy={14 + r*8} r="1"/>
        )))}
      </g>
    ),
  };

  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        border: "1px solid var(--hairline)",
        borderRadius: 4,
        background: "var(--bg)",
        flex: "0 0 auto",
      }}
    >
      <svg width={size - 8} height={size - 8} viewBox="0 0 50 50" aria-hidden="true">
        {motifs[kind] || motifs.dots}
      </svg>
    </span>
  );
}
