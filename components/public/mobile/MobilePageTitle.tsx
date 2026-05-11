'use client';

import { ReactNode } from 'react';

interface MobilePageTitleProps {
  title: ReactNode;
  sub?: ReactNode;
}

export function MobilePageTitle({ title, sub }: MobilePageTitleProps) {
  return (
    <header style={{ padding: "20px 0 8px" }}>
      <h1 style={{
        font: "300 italic 56px/1 var(--font-serif)",
        letterSpacing: "-0.025em",
        color: "var(--fg-strong)",
        margin: 0,
        fontVariationSettings: '"SOFT" 100, "WONK" 1',
      }}>
        {title}
      </h1>
      {sub && (
        <p style={{
          font: "var(--body)",
          color: "var(--fg-muted)",
          marginTop: 14,
          textWrap: "pretty",
        }}>
          {sub}
        </p>
      )}
    </header>
  );
}
