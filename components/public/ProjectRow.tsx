'use client'

import { useState } from 'react'
import { ProjectThumb } from './ProjectThumb'
import { StatusPill } from './StatusPill'
import { TypoIcon } from './TypoIcon'

interface ProjectRowLink {
  kind: string;
  href?: string;
  title?: string;
}

interface ProjectRowProps {
  index?: number;
  year?: string | number;
  title: string;
  status?: string;
  blurb: string;
  links?: ProjectRowLink[];
  thumbKind?: string;
  onClick?: () => void;
}

export function ProjectRow({ index, year, title, status, blurb, links = [], thumbKind, onClick }: ProjectRowProps) {
  const [hover, setHover] = useState(false);
  return (
    <article
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "grid",
        gridTemplateColumns: "72px 1fr",
        gap: 24,
        padding: "28px 0",
        borderBottom: "1px solid var(--hairline)",
        alignItems: "center",
        transition: "border-color var(--dur) var(--ease)",
        borderBottomColor: hover ? "var(--hairline-2)" : "var(--hairline)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-start" }}>
        <ProjectThumb kind={thumbKind} size={56} />
      </div>
      <div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
          <h3
            style={{
              font: "500 24px/1.25 var(--font-serif)",
              color: "var(--fg-strong)",
              margin: 0,
              letterSpacing: "-0.012em",
              flex: "1 1 auto",
              minWidth: 0,
            }}
          >
            <a
              href="#"
              className="link"
              onClick={(e) => { e.preventDefault(); onClick && onClick(); }}
          >
            {title}
          </a>
        </h3>
        {status && (
          <span style={{ marginLeft: "auto" }}>
            <StatusPill status={status} />
          </span>
        )}
        </div>
        <p
          style={{
            font: "var(--body)",
            color: "var(--fg-muted)",
            margin: "8px 0 0",
            maxWidth: 620,
            textWrap: "pretty",
          }}
        >
          {blurb}
        </p>
        {links.length > 0 && (
          <div style={{ display: "flex", gap: 18, marginTop: 14, alignItems: "baseline", flexWrap: "wrap" }}>
            {links.map((l, i) => (
              <TypoIcon key={i} kind={l.kind} href={l.href} title={l.title} />
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
