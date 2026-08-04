'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Shared header for Projects / Writing / Other.
 *
 * Home does not use this: its header is a bare wordmark, and navigation
 * happens through the pill buttons in the reply bubble instead.
 *
 * The mobile menu is rendered in the DOM at all times and toggled with a
 * class, matching the export. `.mmenu` is display:none until the 640px
 * breakpoint, so the desktop tree never shows it.
 */

const NAV_ITEMS = [
  { label: 'Projects', href: '/projects' },
  { label: 'Writing', href: '/writing' },
  { label: 'Other', href: '/other' },
] as const;

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  // Sub-routes count as their section: /writing/some-post keeps Writing lit.
  const isCurrent = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
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
      </header>

      <nav className={`mmenu${menuOpen ? ' open' : ''}`}>
        {NAV_ITEMS.map((item) => (
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
    </>
  );
}
