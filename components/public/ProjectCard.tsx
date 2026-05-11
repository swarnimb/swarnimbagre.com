'use client'

import { useState } from 'react'
import { StatusPill, statusTint } from './StatusPill'
import { TypoIcon } from './TypoIcon'
import { ProjectMedia } from './ProjectMedia'

interface ProjectCardLink {
  kind: string;
  href?: string;
  title?: string;
}

interface ProjectCardDemo {
  kind?: string;
  variant?: string;
}

interface ProjectCardProps {
  title: string;
  status?: string;
  blurb: string;
  links?: ProjectCardLink[];
  demo?: ProjectCardDemo;
  onClick?: () => void;
}

export function ProjectCard({ title, status, blurb, links = [], demo, onClick }: ProjectCardProps) {
  const [hover, setHover] = useState(false);
  const tint = statusTint(status);
  return (
    <article
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: "var(--surface)",
        border: `1px solid ${hover ? "var(--hairline-2)" : "var(--hairline)"}`,
        borderRadius: 6,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        transition: "border-color var(--dur) var(--ease), transform var(--dur) var(--ease)",
        transform: hover ? "translateY(-2px)" : "translateY(0)",
        cursor: onClick ? "pointer" : "default",
      }}
      onClick={onClick}
    >
      {/* Media slot — fixed aspect, sits flush with card edges. */}
      <div style={{
        aspectRatio: "16 / 9",
        position: "relative",
        background: "var(--bg)",
        borderBottom: "1px solid var(--hairline)",
        overflow: "hidden",
      }}>
        <ProjectMedia kind={demo?.kind} variant={demo?.variant} />
      </div>

      {/* Body */}
      <div style={{ padding: "22px 24px 22px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h3 style={{
            font: "500 24px/1.2 var(--font-serif)",
            color: "var(--fg-strong)",
            margin: 0,
            letterSpacing: "-0.012em",
            flex: "1 1 auto",
            minWidth: 0,
          }}>
            <a href="#" className="link" onClick={(e) => { e.preventDefault(); onClick && onClick(); }}>
              {title}
            </a>
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
          margin: 0,
          textWrap: "pretty",
        }}>
          {blurb}
        </p>
        {links.length > 0 && (
          <div style={{
            display: "flex",
            gap: 18,
            marginTop: 8,
            paddingTop: 14,
            borderTop: "1px solid var(--hairline)",
            flexWrap: "wrap",
            alignItems: "baseline",
          }}>
            {links.map((l, i) => (
              <TypoIcon key={i} kind={l.kind} href={l.href} title={l.title} />
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
