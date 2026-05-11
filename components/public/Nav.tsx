'use client'

import { Wordmark } from './Wordmark'

/**
 * Default href resolver — returns the design-bundle placeholder `'#'`
 * for every nav id. Keeps the rendered output byte-identical to
 * `docs/design-source/.../components.jsx` when `resolveHref` is omitted.
 * See constraints.md:68 (additive-prop carve-out under CONSTRAINT-05).
 */
const defaultResolveHref = (_id: string): string => '#';

interface NavProps {
  current: string;
  /**
   * Optional click handler for client-side routing. When provided, link
   * clicks call `preventDefault()` and invoke `onNav(id)` for SPA-style
   * transitions. When omitted (e.g. on Server-Component-rendered detail
   * pages), the browser navigates natively via the `<a href>` — passing
   * a function to a Client Component from a Server Component is forbidden
   * in Next.js 15 RSC and would throw at render time.
   */
  onNav?: (target: string) => void;
  /**
   * Optional href resolver function. When provided, the rendered `<a href>`
   * is the real route (e.g. `/projects`). Use this from Client Components
   * (list pages) where passing a function across the RSC boundary is fine.
   * Server Components must use `hrefs` instead — see below.
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

export function Nav({ current, onNav, resolveHref = defaultResolveHref, hrefs }: NavProps) {
  const items = [
    { id: "projects", label: "projects" },
    { id: "writing",  label: "writing"  },
    { id: "other",    label: "other"    },
  ];
  const hrefFor = (id: string): string => hrefs?.[id] ?? resolveHref(id);
  const handleWordmark = onNav ? () => onNav("home") : undefined;
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
      <Wordmark onClick={handleWordmark} />
      <div style={{ display: "flex", gap: "clamp(14px, 2.4vw, 24px)", marginLeft: "auto", alignItems: "baseline" }}>
        {items.map((it) => (
          <a
            key={it.id}
            href={hrefFor(it.id)}
            className="nav-link"
            aria-current={current === it.id ? "page" : undefined}
            onClick={(e) => {
              if (onNav) {
                e.preventDefault();
                onNav(it.id);
              }
            }}
          >
            {it.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
