'use client';

import { ReactNode } from 'react';
import { StatusPill } from '../StatusPill';
import { ProjectMedia } from '../ProjectMedia';

interface ProjectLink {
  href?: string;
  kind: string;
}

interface ProjectDemo {
  kind?: string;
  variant?: string;
}

interface MobileProjectCardProps {
  title: ReactNode;
  status?: string;
  blurb: ReactNode;
  links?: ProjectLink[];
  demo?: ProjectDemo;
  onClick?: () => void;
}

export function MobileProjectCard({ title, status, blurb, links = [], demo, onClick }: MobileProjectCardProps) {
  return (
    <article
      onClick={onClick}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--hairline)",
        borderRadius: 8,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <div style={{
        aspectRatio: "16 / 9",
        position: "relative",
        background: "var(--bg)",
        borderBottom: "1px solid var(--hairline)",
        overflow: "hidden",
      }}>
        <ProjectMedia kind={demo?.kind} variant={demo?.variant} />
      </div>
      <div style={{ padding: "18px 18px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
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
          margin: 0,
          textWrap: "pretty",
        }}>
          {blurb}
        </p>
        {links.length > 0 && (
          <div style={{
            display: "flex",
            gap: 18,
            marginTop: 6,
            paddingTop: 14,
            borderTop: "1px solid var(--hairline)",
            flexWrap: "wrap",
            alignItems: "center",
          }}>
            {links.map((l, i) => (
              <a key={i} href={l.href || "#"}
                 onClick={(e) => e.preventDefault()}
                 style={{
                   display: "inline-flex",
                   alignItems: "center",
                   gap: 8,
                   minHeight: 44,
                   font: "var(--meta-sm)",
                   color: "var(--fg-muted)",
                   textDecoration: "none",
                   backgroundImage: "none",
                   letterSpacing: "0.05em",
                   textTransform: "lowercase",
                 }}>
                <span style={{ fontFamily: "var(--font-mono)" }}>
                  {l.kind === "github" ? "{ }" : l.kind === "live" ? "↗" : "¶"}
                </span>
                <span>
                  {l.kind === "github" ? "code" : l.kind === "live" ? "site" : "notes"}
                </span>
              </a>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
