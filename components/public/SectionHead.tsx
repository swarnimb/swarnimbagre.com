'use client'

import type { ReactNode } from 'react'

interface SectionHeadProps {
  symbol?: string;
  children: ReactNode;
  count?: number | null;
  top?: number;
}

export function SectionHead({ symbol = "※", children, count, top = 64 }: SectionHeadProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 12,
        margin: `${top}px 0 0`,
        paddingBottom: 12,
        borderBottom: "1px solid var(--hairline)",
      }}
    >
      <span style={{ font: "var(--meta)", color: "var(--accent-soft)" }}>{symbol}</span>
      <h2 style={{
        font: "500 13px var(--font-mono)",
        color: "var(--fg-muted)",
        textTransform: "uppercase",
        letterSpacing: "0.14em",
        margin: 0,
      }}>
        {children}
      </h2>
      {count != null && (
        <span style={{ font: "var(--meta-sm)", color: "var(--fg-faint)", marginLeft: "auto" }}>
          {String(count).padStart(2, "0")}
        </span>
      )}
    </div>
  );
}
