'use client';

import { ReactNode } from 'react';
import { StatusPill } from '../StatusPill';

interface MobileProjectRowProps {
  index: number;
  title: ReactNode;
  status?: string;
  blurb: ReactNode;
  onClick?: () => void;
}

export function MobileProjectRow({ index, title, status, blurb, onClick }: MobileProjectRowProps) {
  return (
    <article
      onClick={onClick}
      style={{
        padding: "16px 0",
        borderBottom: "1px solid var(--hairline)",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <div style={{
        font: "var(--meta-sm)",
        color: "var(--fg-faint)",
        letterSpacing: "0.14em",
        marginBottom: 6,
      }}>
        {String(index).padStart(2, "0")}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <h3 style={{
          font: "500 22px/1.2 var(--font-serif)",
          color: "var(--fg-strong)",
          margin: 0,
          letterSpacing: "-0.012em",
          flex: "1 1 auto",
          minWidth: 0,
        }}>
          {title}
        </h3>
        {status && (
          <span style={{ marginLeft: "auto", flex: "0 0 auto" }}>
            <StatusPill status={status} />
          </span>
        )}
      </div>
      <p style={{
        font: "var(--body)",
        color: "var(--fg-muted)",
        margin: "8px 0 0",
        textWrap: "pretty",
      }}>
        {blurb}
      </p>
    </article>
  );
}
