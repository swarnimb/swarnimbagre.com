'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Shared header for Projects / Writing / Other.
 *
 * Home does not use this: its header is a bare wordmark, and navigation
 * happens through the pill buttons in the reply bubble instead.
 *
 * The mobile menu is rendered in the DOM at all times and toggled with a
 * class. It lives inside the header, nested with the burger, because it is
 * positioned against it — see `.menu-wrap` in public.css.
 */

const NAV_ITEMS = [
  { label: 'Projects', href: '/projects' },
  { label: 'Writing', href: '/writing' },
  { label: 'Other', href: '/other' },
] as const;

/* The dropdown is the entire nav on mobile, so it carries Home too. The
   desktop row deliberately does not: the wordmark sits immediately beside it
   and already links home. */
const MENU_ITEMS = [{ label: 'Home', href: '/' }, ...NAV_ITEMS] as const;

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const menuWrap = useRef<HTMLDivElement>(null);

  // Sub-routes count as their section: /writing/some-post keeps Writing lit.
  // '/' is exempt from the prefix arm — it prefixes every path on the site, so
  // testing it with startsWith would light Home up on every page.
  const isCurrent = (href: string) =>
    href === '/'
      ? pathname === '/'
      : pathname === href || pathname.startsWith(`${href}/`);

  // The menu floats over the page now rather than sitting in the flow, so it
  // needs the dismissals a popover is expected to have. Without them the only
  // way to close it is to reopen the burger, and until you do it covers the
  // content underneath.
  useEffect(() => {
    if (!menuOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!menuWrap.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  return (
    <header className="site-header">
      <Link href="/" className="wordmark">
        Swarnim Bagre
      </Link>

      <nav className="desktop-nav">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="nav-link"
            aria-current={isCurrent(item.href) ? 'page' : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="menu-wrap" ref={menuWrap}>
        <button
          type="button"
          className="burger"
          aria-label="Menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span />
          <span />
          <span />
        </button>

        <nav className={`mmenu${menuOpen ? ' open' : ''}`}>
          {MENU_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="mmenu-item"
              aria-current={isCurrent(item.href) ? 'page' : undefined}
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
