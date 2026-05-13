import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';

/**
 * TS-01 — `AdminHome` and `AdminNav` rendering (T19 acceptance).
 *
 * Asserts the page renders the dry "Admin" heading (not the SaaS-y
 * "Dashboard" — CONSTRAINT-13), mounts the navigation, and that every
 * section link resolves to the exact href the production agent committed
 * to. The four-link contract — Projects / Posts / Stats / Images — is the
 * locked nav surface for the admin panel.
 *
 * Mocking strategy: `AdminNav` imports the `signOut` Server Action from
 * `@/lib/auth`. That module is `'use server'` and pulls in `next/headers`
 * via `@/lib/supabase`, neither of which runs cleanly inside jsdom. The
 * mock replaces the whole module surface with a no-op `signOut` so the
 * render tree never touches Supabase or the request cookie store. Mirrors
 * the `vi.mock('@/lib/supabase', ...)` pattern at the top of
 * `tests/auth.test.ts` (lines 4-6) and `tests/session.test.ts` (lines
 * 17-19) — same import-path style, same per-suite reset discipline.
 */
vi.mock('@/lib/auth', () => ({
  signOut: vi.fn(async () => {}),
}));

const AdminHome = (await import('@/app/(admin)/admin/page')).default;

afterEach(() => {
  vi.resetAllMocks();
});

describe('AdminHome — TS-01 renders the authenticated admin surface', () => {
  it('renders the heading text exactly "Admin" (CONSTRAINT-13: NOT "Dashboard")', () => {
    render(<AdminHome />);

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toBeInTheDocument();
    expect(heading.textContent).toBe('Admin');
    // CONSTRAINT-13 negative assertion — SaaS-flavored labels are banned.
    expect(heading.textContent).not.toBe('Dashboard');
    expect(heading.textContent?.toLowerCase()).not.toContain('dashboard');
  });

  it('mounts AdminNav inside the page (a <nav> element is present)', () => {
    render(<AdminHome />);

    const nav = screen.getByRole('navigation');
    expect(nav).toBeInTheDocument();
  });

  it('resolves all four section links to the locked admin hrefs', () => {
    render(<AdminHome />);

    const nav = screen.getByRole('navigation');

    // Use case-insensitive name matching so the assertion is robust against a
    // future capitalization change in the bundle without becoming permissive
    // on the path itself.
    const projects = within(nav).getByRole('link', { name: /^projects$/i });
    const posts = within(nav).getByRole('link', { name: /^posts$/i });
    const stats = within(nav).getByRole('link', { name: /^stats$/i });
    const images = within(nav).getByRole('link', { name: /^images$/i });

    expect(projects).toHaveAttribute('href', '/admin/projects');
    expect(posts).toHaveAttribute('href', '/admin/posts');
    expect(stats).toHaveAttribute('href', '/admin/stats');
    expect(images).toHaveAttribute('href', '/admin/images');
  });

  it('renders a "Sign out" button inside the nav (form posts to the signOut Server Action)', () => {
    render(<AdminHome />);

    const nav = screen.getByRole('navigation');
    const button = within(nav).getByRole('button', { name: /^sign out$/i });

    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('type', 'submit');
  });
});
