'use client'

import type { ReactNode } from 'react'

interface MorePointerProps {
  to: string;
  onNav: (target: string) => void;
  children: ReactNode;
}

export function MorePointer({ to, onNav, children }: MorePointerProps) {
  return (
    <a
      href="#"
      className="link"
      onClick={(e) => { e.preventDefault(); onNav(to); }}
      style={{
        font: "var(--meta-sm)",
        color: "var(--fg-muted)",
        textTransform: "uppercase",
        letterSpacing: "0.14em",
      }}
    >
      {children} →
    </a>
  );
}
