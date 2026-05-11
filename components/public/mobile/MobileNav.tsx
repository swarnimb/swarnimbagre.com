'use client';

import { useState, useEffect, CSSProperties } from 'react';

/**
 * Default href resolver — returns the design-bundle placeholder `'#'`
 * for every nav id. Keeps the rendered output byte-identical to
 * `docs/design-source/.../mobile-components.jsx` when `resolveHref` is
 * omitted. See constraints.md:68 (additive-prop carve-out).
 */
const defaultResolveHref = (_id: string): string => '#';

interface MobileNavProps {
  current: string;
  /**
   * Optional click handler for client-side routing. When provided, wordmark
   * and drawer-item clicks call `preventDefault()` and invoke `onNav(id)`.
   * When omitted (e.g. on Server-Component-rendered detail pages), the
   * browser navigates natively via the `<a href>` — passing a function to
   * a Client Component from a Server Component is forbidden in Next.js 15
   * RSC and would throw at render time.
   */
  onNav?: (id: string) => void;
  /**
   * Optional href resolver function. When provided, the rendered `<a href>`
   * on the wordmark and drawer items is the real route. Use this from
   * Client Components (list pages). Server Components must use `hrefs`
   * instead — see below.
   */
  resolveHref?: (id: string) => string;
  /**
   * Optional plain-data href map. Takes precedence over `resolveHref`.
   * Use this from Server Components (e.g. detail pages) where passing a
   * function prop to a Client Component is forbidden by Next.js 15 RSC
   * and would throw at render time. Pass `NAV_PATHS` from `lib/nav-targets`.
   */
  hrefs?: Record<string, string>;
}

export function MobileNav({ current, onNav, resolveHref = defaultResolveHref, hrefs }: MobileNavProps) {
  const hrefFor = (id: string): string => hrefs?.[id] ?? resolveHref(id);
  const [open, setOpen] = useState(false);
  // Lock body scroll while drawer open (within the iOS frame).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
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
        <a href={hrefFor("home")} onClick={(e) => {
             if (onNav) {
               e.preventDefault();
               onNav("home");
             }
           }}
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
                    href={hrefFor(it.id)}
                    onClick={(e) => {
                      if (onNav) {
                        e.preventDefault();
                        onNav(it.id);
                      }
                      setOpen(false);
                    }}
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

function lineStyle(top: number, dispTop: number, rot: number, opacity: number = 1): CSSProperties {
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
