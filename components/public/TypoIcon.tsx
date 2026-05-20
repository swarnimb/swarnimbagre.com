'use client'

type TypoIconKind = "github" | "live" | "post" | "rss" | string;

interface TypoIconProps {
  kind: TypoIconKind;
  href?: string;
  title?: string;
}

/**
 * Typographic link icon — a glyph + lowercase label rendered as an anchor.
 * Decorative when `href` is the default `"#"` (navigation suppressed);
 * functional when a real URL is passed (navigation proceeds).
 *
 * The original bundle was a static demo where `onClick={(e) => e.preventDefault()}`
 * fired unconditionally — harmless against `"#"` placeholders. Production
 * consumers pass real URLs, so the click is now gated on the decorative
 * sentinel only.
 */
export function TypoIcon({ kind, href = "#", title }: TypoIconProps) {
  // kind: "github" | "live" | "post"
  // We use letterforms / glyphs as icons — no logos, no emoji, no Lucide.
  const map: Record<string, { glyph: string; label: string }> = {
    github: { glyph: "{ }", label: "code"  },
    live:   { glyph: "↗",   label: "site"  },
    post:   { glyph: "¶",   label: "notes" },
    rss:    { glyph: "*",   label: "rss"   },
  };
  const it = map[kind] || { glyph: "→", label: kind };
  return (
    <a
      href={href}
      title={title || it.label}
      onClick={(e) => { if (href === "#") e.preventDefault(); }}
      style={{
        font: "var(--meta-sm)",
        color: "var(--fg-muted)",
        textTransform: "lowercase",
        letterSpacing: "0.05em",
        textDecoration: "none",
        backgroundImage: "none",     // override the global underline-on-hover
        padding: "2px 0",
        transition: "color var(--dur) var(--ease)",
        display: "inline-flex",
        alignItems: "baseline",
        gap: 6,
        cursor: "pointer",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")}
      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--fg-muted)")}
    >
      <span style={{ fontFamily: "var(--font-mono)" }}>{it.glyph}</span>
      <span>{it.label}</span>
    </a>
  );
}
