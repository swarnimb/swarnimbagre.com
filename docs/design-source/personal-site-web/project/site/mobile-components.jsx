// Mobile components — adapted from desktop with:
// - Hamburger nav (full-screen drawer)
// - Single-column layouts
// - Tap targets ≥ 44px
// - Bumped relative type scale
// - No hover-only states (everything works on tap)
//
// Reuses desktop globals from components.jsx where compatible:
// SocialIcon, TypoIcon, StatusPill, statusTint, ProjectMedia.

/* MobilePage — narrow column. Padding tuned for 390px viewport.
   Vertical column so footer can be pushed to bottom with flex spacer. */
function MobilePage({ children }) {
  return (
    <main style={{
      minHeight: "100%",
      padding: "0 20px 40px",
      display: "flex",
      flexDirection: "column",
      background: "var(--bg)",
      // Push past the iOS notch / dynamic island
      paddingTop: 60,
    }}>
      {children}
    </main>
  );
}

/* MobileNav — wordmark + hamburger. Drawer slides in from right.
   44×44 hamburger hit target. Drawer items 56px tall. */
function MobileNav({ current, onNav }) {
  const [open, setOpen] = React.useState(false);
  // Lock body scroll while drawer open (within the iOS frame).
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const items = [
    { id: "home",     label: "home"     },
    { id: "projects", label: "projects" },
    { id: "writing",  label: "writing"  },
    { id: "other",    label: "everything else" },
  ];

  return (
    <>
      <nav style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 0 16px",
        borderBottom: "1px solid var(--hairline)",
      }}>
        <a href="#" onClick={(e) => { e.preventDefault(); onNav("home"); }}
           style={{
             font: "300 italic 22px/1 var(--font-serif)",
             color: "var(--fg-strong)",
             letterSpacing: "-0.02em",
             textDecoration: "none",
             backgroundImage: "none",
             padding: "10px 4px",
             minHeight: 44,
             display: "inline-flex",
             alignItems: "center",
             whiteSpace: "nowrap",
           }}>
          swarnim bagre
        </a>

        <button
          aria-label={open ? "close menu" : "open menu"}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          style={{
            width: 44, height: 44,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            border: "1px solid var(--hairline)",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          {/* Custom hamburger / close — drawn lines, no library icons. */}
          <span style={{
            position: "relative", width: 18, height: 14, display: "block",
          }}>
            <span style={lineStyle(0,  open ? 6 : 0,  open ? 45 : 0)}/>
            <span style={lineStyle(6,  6,  0, open ? 0 : 1)}/>
            <span style={lineStyle(12, open ? 6 : 12, open ? -45 : 0)}/>
          </span>
        </button>
      </nav>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "absolute",
            inset: 0,
            background: "var(--bg)",
            zIndex: 5,
            display: "flex",
            flexDirection: "column",
            paddingTop: 60,
          }}
        >
          {/* Drawer header — wordmark + close, mirroring nav row */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 20px 16px",
            borderBottom: "1px solid var(--hairline)",
          }}>
            <span style={{
              font: "300 italic 22px/1 var(--font-serif)",
              color: "var(--fg-strong)",
              letterSpacing: "-0.02em",
              whiteSpace: "nowrap",
            }}>
              swarnim bagre
            </span>
            <button
              aria-label="close menu"
              onClick={() => setOpen(false)}
              style={{
                width: 44, height: 44,
                background: "transparent",
                border: "1px solid var(--accent)",
                borderRadius: 4,
                color: "var(--accent)",
                font: "500 16px/1 var(--font-mono)",
                cursor: "pointer",
              }}
            >
              ×
            </button>
          </div>

          {/* Drawer items */}
          <ul style={{
            listStyle: "none",
            padding: "8px 20px",
            margin: 0,
            display: "flex",
            flexDirection: "column",
          }}
            onClick={(e) => e.stopPropagation()}
          >
            {items.map((it) => {
              const active = current === it.id;
              return (
                <li key={it.id}>
                  <a
                    href="#"
                    onClick={(e) => { e.preventDefault(); onNav(it.id); setOpen(false); }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      minHeight: 60,
                      padding: "16px 4px",
                      borderBottom: "1px solid var(--hairline)",
                      font: `400 italic ${active ? 32 : 28}px/1.1 var(--font-serif)`,
                      color: active ? "var(--accent)" : "var(--fg-strong)",
                      letterSpacing: "-0.012em",
                      textDecoration: "none",
                      backgroundImage: "none",
                      fontVariationSettings: '"SOFT" 100, "WONK" 1',
                    }}
                  >
                    {it.label}
                    <span style={{
                      font: "var(--meta-sm)",
                      color: active ? "var(--accent)" : "var(--fg-faint)",
                      letterSpacing: "0.16em",
                    }}>
                      {active ? "—" : "→"}
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>

          {/* Drawer footer — small detail */}
          <div style={{
            marginTop: "auto",
            padding: "20px",
            font: "var(--meta-sm)",
            color: "var(--fg-faint)",
            letterSpacing: "0.14em",
            fontFamily: "var(--font-mono)",
          }}>
            ※ tap anywhere outside to close
          </div>
        </div>
      )}
    </>
  );
}

function lineStyle(top, dispTop, rot, opacity = 1) {
  return {
    position: "absolute",
    left: 0, top: dispTop,
    width: 18, height: 1.5,
    background: "var(--fg-strong)",
    transformOrigin: "center",
    transform: `rotate(${rot}deg)`,
    opacity,
    transition: "transform 200ms var(--ease), top 200ms var(--ease), opacity 160ms var(--ease)",
  };
}

/* MobileFooter — small mono line, sits at bottom of viewport. */
function MobileFooter({ line }) {
  return (
    <footer style={{
      marginTop: 40,
      paddingTop: 16,
      borderTop: "1px solid var(--hairline)",
      font: "var(--meta-sm)",
      color: "var(--fg-muted)",
      letterSpacing: 0,
      fontFamily: "var(--font-mono)",
      lineHeight: 1.5,
    }}>
      {line}
    </footer>
  );
}

/* MobilePageTitle — italic serif heading + subhead, scaled for 390px. */
function MobilePageTitle({ title, sub }) {
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

/* MobileProjectCard — full-width single-column card.
   Same structure as desktop ProjectCard but stacked + bigger taps. */
function MobileProjectCard({ title, status, blurb, links = [], demo, onClick }) {
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

/* MobileProjectRow — used on Home. Compact version of the desktop ProjectRow.
   Title + status pill on one row, blurb below. No grid columns. */
function MobileProjectRow({ index, title, status, blurb, onClick }) {
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

Object.assign(window, {
  MobilePage, MobileNav, MobileFooter, MobilePageTitle,
  MobileProjectCard, MobileProjectRow,
});
