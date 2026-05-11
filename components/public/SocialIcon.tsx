'use client'

import type { JSX } from 'react';

type SocialIconKind = "email" | "x" | "linkedin" | "reddit" | "substack" | "youtube";

interface SocialIconProps {
  kind: SocialIconKind;
  href?: string;
  size?: number;
}

export function SocialIcon({ kind, href = "#", size = 18 }: SocialIconProps) {
  const paths: Record<SocialIconKind, JSX.Element> = {
    email: (
      <g><rect x="3" y="5.5" width="18" height="13" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.6"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></g>
    ),
    x: (
      <path d="M3 3l7.5 9.5L3.5 21H6l5.7-6.6L17 21h4l-7.9-10L20.5 3H18l-5.3 6.1L8 3H3z"/>
    ),
    linkedin: (
      <path d="M4.5 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM3 8h3v13H3V8zm5.5 0H11v1.9h.04c.36-.69 1.25-1.4 2.58-1.4 2.76 0 3.27 1.82 3.27 4.18V21h-3v-5.7c0-1.36-.02-3.1-1.89-3.1-1.9 0-2.19 1.48-2.19 3v5.8h-3V8z"/>
    ),
    reddit: (
      <g><circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" strokeWidth="1.6"/><circle cx="9" cy="13" r="1.1" fill="currentColor"/><circle cx="15" cy="13" r="1.1" fill="currentColor"/><path d="M8.5 16.2c1 0.9 2.2 1.3 3.5 1.3s2.5-0.4 3.5-1.3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><circle cx="12" cy="6.5" r="1" fill="currentColor"/></g>
    ),
    substack: (
      <g><rect x="4" y="4" width="16" height="2.4" fill="currentColor"/><rect x="4" y="8.4" width="16" height="2.4" fill="currentColor"/><path d="M4 12.8h16V21l-8-4-8 4v-8.2z" fill="currentColor"/></g>
    ),
    youtube: (
      <g><path d="M22 12c0-2.6-.2-4.4-.6-5.3-.4-.9-1.2-1.5-2.2-1.7C17.5 4.7 12 4.7 12 4.7s-5.5 0-7.2.3c-1 .2-1.8.8-2.2 1.7C2.2 7.6 2 9.4 2 12s.2 4.4.6 5.3c.4.9 1.2 1.5 2.2 1.7 1.7.3 7.2.3 7.2.3s5.5 0 7.2-.3c1-.2 1.8-.8 2.2-1.7.4-.9.6-2.7.6-5.3z" fill="currentColor"/><path d="M10 9v6l5-3-5-3z" fill="var(--bg)"/></g>
    ),
  };
  return (
    <a
      href={href}
      onClick={(e) => e.preventDefault()}
      title={kind}
      aria-label={kind}
      style={{
        color: "var(--fg-muted)",
        backgroundImage: "none",
        padding: 4,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "color var(--dur) var(--ease)",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")}
      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--fg-muted)")}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        {paths[kind]}
      </svg>
    </a>
  );
}
