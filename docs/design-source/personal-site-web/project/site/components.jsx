// Shared components for Swarnim Bagre's personal site.
// Voice: dry, deadpan, earnest. No SaaS-speak.
// Layout: asymmetric. Type does the work. No shadows, no rounded card chrome.

// React hook aliases — defer to keep top-level safe if scripts race.
const useState = React.useState;
const useEffect = React.useEffect;

/* ------------------------------------------------------------------ */
/* Wordmark — name as logotype. Italic Fraunces, soft+wonk axes.      */
/* ------------------------------------------------------------------ */
function Wordmark({ onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "transparent",
        border: 0,
        padding: 0,
        cursor: "pointer",
        font: "400 italic 28px var(--font-serif)",
        color: "var(--fg-strong)",
        letterSpacing: "-0.012em",
        fontVariationSettings: '"SOFT" 100, "WONK" 1',
      }}
    >
      Swarnim Bagre
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* SocialIcon — minimal inline-SVG icons. Muted; accent on hover.     */
/* Sized small. Kinds: x | linkedin | reddit | substack | youtube     */
/* ------------------------------------------------------------------ */
function SocialIcon({ kind, href = "#", size = 18 }) {
  const paths = {
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

/* ------------------------------------------------------------------ */
/* Nav — same on mobile + desktop, just sized differently.            */
/* Order from brief: Projects · Writing · Other · Feed                */
/* ------------------------------------------------------------------ */
function Nav({ current, onNav }) {
  const items = [
    { id: "projects", label: "projects" },
    { id: "writing",  label: "writing"  },
    { id: "other",    label: "other"    },
  ];
  return (
    <nav
      style={{
        display: "flex",
        gap: "clamp(16px, 3vw, 28px)",
        alignItems: "baseline",
        padding: "22px 0 16px",
        borderBottom: "1px solid var(--hairline)",
        flexWrap: "wrap",
      }}
    >
      <Wordmark onClick={() => onNav("home")} />
      <div style={{ display: "flex", gap: "clamp(14px, 2.4vw, 24px)", marginLeft: "auto", alignItems: "baseline" }}>
        {items.map((it) => (
          <a
            key={it.id}
            href="#"
            className="nav-link"
            aria-current={current === it.id ? "page" : undefined}
            onClick={(e) => { e.preventDefault(); onNav(it.id); }}
          >
            {it.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* Footer — one odd sentence. Nothing else.                           */
/* ------------------------------------------------------------------ */
function Footer({ line }) {
  const lines = [
    "No cookies, no analytics, no idea what I'm doing.",
    "Made between disc golf rounds.",
    "Last edited at an embarrassing hour.",
    "Built mostly during things I should not have been doing.",
  ];
  // Stable choice per page mount.
  const [chosen] = useState(() => line || lines[Math.floor(Math.random() * lines.length)]);
  return (
    <footer
      style={{
        marginTop: 96,
        paddingTop: 24,
        borderTop: "1px solid var(--hairline)",
        font: "var(--meta-sm)",
        color: "var(--fg-muted)",
        textTransform: "none",       // keep the sentence cased; meta-sm uppercases by default elsewhere
        letterSpacing: "0",
        fontFamily: "var(--font-mono)",
      }}
    >
      {chosen}
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/* TypoIcon — typographic symbols as link icons.                      */
/* Muted by default, light up to accent gold on hover.                */
/* ------------------------------------------------------------------ */
function TypoIcon({ kind, href = "#", title }) {
  // kind: "github" | "live" | "post"
  // We use letterforms / glyphs as icons — no logos, no emoji, no Lucide.
  const map = {
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
      onClick={(e) => e.preventDefault()}
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

/* ------------------------------------------------------------------ */
/* ProjectRow — card defined by spacing + type, NOT by border/shadow. */
/* Layout: [year]   [title + blurb + tiny links]                      */
/* Hover: a sarcastic alternate description fades in (this is OFF —   */
/*   we already picked CurrentlyWidget as the one weird detail).      */
/* ------------------------------------------------------------------ */
/* Status tint mapping. Pulled from the warm palette only. */
function statusTint(status) {
  const s = (status || "").toLowerCase();
  if (s.startsWith("active"))    return { fg: "#A8C078", bg: "rgba(138,163,97,0.12)",  bd: "rgba(138,163,97,0.32)" };  // sage
  if (s.startsWith("dormant"))   return { fg: "#D9BB66", bg: "rgba(201,168,76,0.12)", bd: "rgba(201,168,76,0.32)" };   // gold
  if (s.startsWith("abandoned")) return { fg: "#B85C3C", bg: "rgba(184,92,60,0.12)",  bd: "rgba(184,92,60,0.30)"  };   // sienna, dim
  if (s.startsWith("shipped"))   return { fg: "#A8C078", bg: "rgba(138,163,97,0.12)",  bd: "rgba(138,163,97,0.32)" };
  return { fg: "var(--fg-muted)", bg: "transparent", bd: "var(--hairline)" };
}

function StatusPill({ status, size = "sm" }) {
  if (!status) return null;
  const c = statusTint(status);
  const fz = size === "md" ? 11 : 10.5;
  return (
    <span style={{
      font: `500 ${fz}px var(--font-mono)`,
      color: c.fg,
      background: c.bg,
      border: `1px solid ${c.bd}`,
      padding: "3px 9px",
      borderRadius: 999,
      textTransform: "uppercase",
      letterSpacing: "0.14em",
      whiteSpace: "nowrap",
      lineHeight: 1.4,
    }}>
      {status}
    </span>
  );
}

/* ProjectThumb — tiny, non-intrusive 56px square. Each "kind" is a hand-tuned
   abstract motif (no clipart). Uses currentColor so it sits in the editorial
   palette and never competes with type. */
function ProjectThumb({ kind = "dots", size = 56 }) {
  const stroke = "var(--fg-muted)";
  const faint  = "var(--hairline-2)";
  const accent = "var(--accent)";

  const motifs = {
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

function ProjectRow({ index, year, title, status, blurb, links = [], thumbKind, onClick }) {
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

/* ------------------------------------------------------------------ */
/* SectionHead — small mono label, optional count, hairline below.    */
/* Uses a typographic symbol as visual anchor (※ / ¶ / *).            */
/* ------------------------------------------------------------------ */
function SectionHead({ symbol = "※", children, count, top = 64 }) {
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

/* ------------------------------------------------------------------ */
/* MorePointer — subtle "more →" link.                                */
/* ------------------------------------------------------------------ */
function MorePointer({ to, onNav, children }) {
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

/* ------------------------------------------------------------------ */
/* Page wrapper. Asymmetric: content sits left-of-center on desktop.  */
/* ------------------------------------------------------------------ */
function Page({ children }) {
  return (
    <main
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: "0 clamp(20px, 4vw, 48px) 64px",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {children}
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* ProjectCard — premium 2-col card for the Projects index.           */
/* Layout: media (top) + body (title + status + blurb + links).       */
/* Media kinds: "demo" (canvas-based always-playing loop),            */
/*              "before-after" (slider over two CSS-painted scenes),  */
/*              "still" (a static composed scene).                    */
/* No external images: scenes are drawn with CSS + SVG.               */
/* ------------------------------------------------------------------ */
function ProjectCard({ title, status, blurb, links = [], demo, onClick }) {
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

/* ProjectMedia — animated/static scenes drawn with HTML+CSS+SVG.
   No external assets. Always playing. Variant lets cards differ. */
function ProjectMedia({ kind = "demo", variant = "rings" }) {
  if (kind === "before-after") return <BeforeAfterMedia variant={variant} />;
  if (kind === "still")        return <StillMedia variant={variant} />;
  return <DemoLoop variant={variant} />;
}

function DemoLoop({ variant }) {
  // CSS-only animated scenes. One per variant, each in the warm palette.
  // Variants: "rings" (disc-golf radar), "bars" (chart climbing), "wave" (waveform), "agent" (cursor + nodes).
  const common = {
    position: "absolute", inset: 0, width: "100%", height: "100%",
    display: "block",
  };
  if (variant === "bars") {
    return (
      <div style={{ ...common, background: "linear-gradient(180deg, #221d16 0%, #1c1712 100%)" }}>
        <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid meet" style={{ width: "100%", height: "100%" }}>
          <defs>
            <linearGradient id="bargrad" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#8C7530" stopOpacity="0.6"/>
              <stop offset="100%" stopColor="#C9A84C"/>
            </linearGradient>
          </defs>
          {/* faint grid */}
          {[40, 80, 120, 160].map((y) => (
            <line key={y} x1="20" y1={y} x2="300" y2={y} stroke="#3A3328" strokeWidth="0.5"/>
          ))}
          {/* climbing bars */}
          {Array.from({ length: 14 }).map((_, i) => {
            const h = 18 + (i * 7) % 90 + (i % 3) * 8;
            return (
              <rect key={i}
                x={28 + i * 19} y={160 - h} width="10" height={h}
                fill="url(#bargrad)" rx="1">
                <animate attributeName="height"
                  values={`${h};${h + 14};${h - 6};${h}`} dur={`${3 + i * 0.13}s`} repeatCount="indefinite"/>
                <animate attributeName="y"
                  values={`${160 - h};${160 - h - 14};${160 - h + 6};${160 - h}`} dur={`${3 + i * 0.13}s`} repeatCount="indefinite"/>
              </rect>
            );
          })}
          {/* trend line */}
          <polyline points="28,140 80,118 132,124 184,96 236,84 288,58"
            fill="none" stroke="#E8E0D0" strokeWidth="1.5" strokeLinecap="round"/>
          <text x="22" y="28" fontFamily="ui-monospace, JetBrains Mono, monospace"
                fontSize="9" fill="#7A7060" letterSpacing="2">DRUM HOURS / WK</text>
        </svg>
      </div>
    );
  }
  if (variant === "wave") {
    return (
      <div style={{ ...common, background: "radial-gradient(ellipse at 30% 30%, #2a231a, #1c1712 70%)" }}>
        <svg viewBox="0 0 320 180" style={{ width: "100%", height: "100%" }}>
          <defs>
            <linearGradient id="wgrad" x1="0" x2="1">
              <stop offset="0%" stopColor="#C9A84C" stopOpacity="0"/>
              <stop offset="50%" stopColor="#C9A84C"/>
              <stop offset="100%" stopColor="#C9A84C" stopOpacity="0"/>
            </linearGradient>
          </defs>
          {Array.from({ length: 60 }).map((_, i) => {
            const x = 16 + i * 5;
            const baseH = 4 + Math.abs(Math.sin(i * 0.4)) * 50 + (i % 5) * 4;
            return (
              <rect key={i} x={x} y={90 - baseH / 2} width="2" height={baseH}
                    fill="url(#wgrad)" rx="1">
                <animate attributeName="height"
                  values={`${baseH};${baseH * 1.4};${baseH * 0.7};${baseH}`}
                  dur={`${2 + (i % 7) * 0.2}s`} repeatCount="indefinite"/>
                <animate attributeName="y"
                  values={`${90 - baseH / 2};${90 - baseH * 0.7};${90 - baseH * 0.35};${90 - baseH / 2}`}
                  dur={`${2 + (i % 7) * 0.2}s`} repeatCount="indefinite"/>
              </rect>
            );
          })}
          <text x="22" y="28" fontFamily="ui-monospace, JetBrains Mono, monospace"
                fontSize="9" fill="#7A7060" letterSpacing="2">REC · TAKE 04</text>
        </svg>
      </div>
    );
  }
  if (variant === "agent") {
    return (
      <div style={{ ...common, background: "linear-gradient(135deg, #221d16, #1c1712 60%)" }}>
        <svg viewBox="0 0 320 180" style={{ width: "100%", height: "100%" }}>
          {/* edges */}
          <g stroke="#3A3328" strokeWidth="1" fill="none">
            <line x1="60" y1="60" x2="160" y2="40"/>
            <line x1="60" y1="60" x2="140" y2="120"/>
            <line x1="160" y1="40" x2="240" y2="80"/>
            <line x1="140" y1="120" x2="240" y2="80"/>
            <line x1="240" y1="80" x2="280" y2="140"/>
          </g>
          {/* nodes */}
          {[
            {x:60,y:60,r:6}, {x:160,y:40,r:7}, {x:140,y:120,r:5},
            {x:240,y:80,r:8}, {x:280,y:140,r:5},
          ].map((n, i) => (
            <circle key={i} cx={n.x} cy={n.y} r={n.r}
                    fill="#252018" stroke="#C9A84C" strokeWidth="1.2">
              <animate attributeName="r" values={`${n.r};${n.r + 2};${n.r}`}
                       dur={`${1.6 + i * 0.3}s`} repeatCount="indefinite"/>
            </circle>
          ))}
          {/* traveling pulse */}
          <circle r="3" fill="#C9A84C">
            <animateMotion dur="3.6s" repeatCount="indefinite"
              path="M60,60 L160,40 L240,80 L140,120 L60,60"/>
          </circle>
          <text x="22" y="28" fontFamily="ui-monospace, JetBrains Mono, monospace"
                fontSize="9" fill="#7A7060" letterSpacing="2">AGENT GRAPH</text>
        </svg>
      </div>
    );
  }
  // default: "rings" — disc golf radar
  return (
    <div style={{ ...common, background: "radial-gradient(circle at 50% 60%, #2a231a, #1c1712 70%)" }}>
      <svg viewBox="0 0 320 180" style={{ width: "100%", height: "100%" }}>
        {[20, 40, 60, 80].map((r, i) => (
          <circle key={r} cx="160" cy="110" r={r} fill="none"
                  stroke="#3A3328" strokeWidth="0.6" strokeDasharray="2 4">
            <animate attributeName="r"
              values={`${r};${r + 6};${r}`}
              dur={`${4 + i}s`} repeatCount="indefinite"/>
          </circle>
        ))}
        {/* basket bullseye */}
        <circle cx="160" cy="110" r="4" fill="#C9A84C"/>
        <circle cx="160" cy="110" r="10" fill="none" stroke="#C9A84C" strokeWidth="0.8"/>
        {/* discs in flight */}
        {[
          {cx:80, cy:60, d:"3.4s"},
          {cx:240, cy:140, d:"4.1s"},
          {cx:60, cy:140, d:"5.2s"},
        ].map((p, i) => (
          <g key={i}>
            <circle cx={p.cx} cy={p.cy} r="3.5" fill="#E8E0D0">
              <animateMotion dur={p.d} repeatCount="indefinite"
                path={`M0,0 Q${(160 - p.cx)*0.5},${(110 - p.cy)*0.3 - 30} ${160 - p.cx},${110 - p.cy}`}/>
              <animate attributeName="opacity"
                values="1;1;0;1" dur={p.d} repeatCount="indefinite"/>
            </circle>
          </g>
        ))}
        <text x="22" y="28" fontFamily="ui-monospace, JetBrains Mono, monospace"
              fontSize="9" fill="#7A7060" letterSpacing="2">ROUND 12 · HOLE 04</text>
      </svg>
    </div>
  );
}

/* Before/after — drag to compare. Two stylised scenes; no images. */
function BeforeAfterMedia({ variant }) {
  const ref = React.useRef(null);
  const [pos, setPos] = useState(50); // % from left
  const onDrag = (e) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const pct = Math.max(4, Math.min(96, (x / rect.width) * 100));
    setPos(pct);
  };
  const [drag, setDrag] = useState(false);
  React.useEffect(() => {
    if (!drag) return;
    const move = (e) => onDrag(e);
    const up   = () => setDrag(false);
    window.addEventListener("mousemove", move);
    window.addEventListener("touchmove", move);
    window.addEventListener("mouseup", up);
    window.addEventListener("touchend", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchend", up);
    };
  }, [drag]);

  // Two stylised "screenshots" composed as CSS scenes.
  const Before = (
    <div style={{
      position: "absolute", inset: 0,
      background: "linear-gradient(180deg, #2a231a, #1c1712)",
      padding: 16, display: "flex", flexDirection: "column", gap: 8,
    }}>
      <div style={{ font: "500 10px var(--font-mono)", color: "#7A7060", letterSpacing: 2 }}>BEFORE · SPREADSHEET</div>
      {[0,1,2,3,4].map((i) => (
        <div key={i} style={{
          display: "grid", gridTemplateColumns: "60px 1fr 50px", gap: 6,
          padding: "4px 6px",
          background: i % 2 ? "rgba(255,255,255,0.02)" : "transparent",
          font: "400 10px var(--font-mono)", color: "#7A7060",
          borderBottom: "1px solid #2E2820",
        }}>
          <span>{`R${i+1}`}</span>
          <span style={{ color: "#E8E0D0" }}>match {i + 11}</span>
          <span style={{ textAlign: "right" }}>{["L","L","W","L","L"][i]}</span>
        </div>
      ))}
    </div>
  );
  const After = (
    <div style={{
      position: "absolute", inset: 0,
      background: "radial-gradient(ellipse at 70% 30%, #2a231a, #1c1712 70%)",
      padding: 18, display: "flex", flexDirection: "column", gap: 12,
    }}>
      <div style={{ font: "500 10px var(--font-mono)", color: "#A8C078", letterSpacing: 2 }}>AFTER · APP</div>
      <div style={{ font: "400 italic 22px/1 var(--font-serif)", color: "#F4ECDC" }}>4 – 11</div>
      <div style={{ font: "400 11px/1.4 var(--font-sans)", color: "#7A7060" }}>this season, generously counted</div>
      <svg viewBox="0 0 200 50" style={{ width: "100%", marginTop: "auto" }}>
        <polyline points="0,40 30,32 60,36 90,22 120,28 150,14 180,18 200,8"
          fill="none" stroke="#C9A84C" strokeWidth="1.5"/>
      </svg>
    </div>
  );

  return (
    <div
      ref={ref}
      onMouseDown={(e) => { setDrag(true); onDrag(e); }}
      onTouchStart={(e) => { setDrag(true); onDrag(e); }}
      style={{
        position: "absolute", inset: 0, cursor: "ew-resize", userSelect: "none",
      }}
    >
      {Before}
      <div style={{ position: "absolute", inset: 0, clipPath: `inset(0 0 0 ${pos}%)` }}>
        {After}
      </div>
      {/* Divider */}
      <div style={{
        position: "absolute", top: 0, bottom: 0, left: `${pos}%`, width: 1,
        background: "var(--accent)", boxShadow: "0 0 0 3px rgba(201,168,76,0.15)",
        pointerEvents: "none",
      }}/>
      <div style={{
        position: "absolute", top: "50%", left: `${pos}%`, transform: "translate(-50%, -50%)",
        width: 26, height: 26, borderRadius: 999,
        background: "var(--bg)", border: "1px solid var(--accent)",
        display: "flex", alignItems: "center", justifyContent: "center",
        font: "500 10px var(--font-mono)", color: "var(--accent)",
        pointerEvents: "none",
      }}>
        ⇆
      </div>
    </div>
  );
}

/* Static composed scene — for the one card without animation. */
function StillMedia({ variant }) {
  return (
    <div style={{
      position: "absolute", inset: 0,
      background: "linear-gradient(135deg, #2a231a, #1c1712 70%)",
      padding: 20, display: "flex", flexDirection: "column", justifyContent: "space-between",
    }}>
      <div style={{ font: "500 10px var(--font-mono)", color: "#7A7060", letterSpacing: 2 }}>
        afford.lunch / today
      </div>
      <div style={{ font: "400 italic 36px/1 var(--font-serif)", color: "#F4ECDC", textAlign: "center" }}>
        yes.
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", font: "var(--meta-sm)", color: "#7A7060", letterSpacing: 1 }}>
        <span>budget — ₹720</span>
        <span style={{ color: "#A8C078" }}>spend — ₹260</span>
      </div>
    </div>
  );
}

Object.assign(window, {
  Wordmark, Nav, Footer, SocialIcon,
  TypoIcon, ProjectRow, ProjectCard, StatusPill, statusTint,
  ProjectMedia,
  SectionHead, MorePointer, Page,
});
