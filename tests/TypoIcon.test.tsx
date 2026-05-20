import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { TypoIcon } from '@/components/public/TypoIcon';

afterEach(() => {
  cleanup();
});

/**
 * The `href === "#"` sentinel that flags decorative use. Kept as a local
 * constant so the test file documents the contract it is locking down.
 */
const DECORATIVE_HREF = '#';

describe('TypoIcon — click behaviour by href shape', () => {
  it('does NOT preventDefault when href is a real URL (production path)', () => {
    render(<TypoIcon kind="github" href="https://github.com/test/repo" />);
    const link = screen.getByTitle('code');
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('preventsDefault when href is the decorative "#" sentinel', () => {
    render(<TypoIcon kind="github" href={DECORATIVE_HREF} />);
    const link = screen.getByTitle('code');
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('preventsDefault when href prop is omitted (defaults to "#")', () => {
    render(<TypoIcon kind="github" />);
    const link = screen.getByTitle('code');
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('does NOT preventDefault for relative URLs (e.g. /writing/post-slug)', () => {
    render(<TypoIcon kind="post" href="/writing/t42-smoke-post" />);
    const link = screen.getByTitle('notes');
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });
});

describe('TypoIcon — glyph + label by kind', () => {
  it('renders the github glyph + "code" label for kind="github"', () => {
    render(<TypoIcon kind="github" href="https://example.com" />);
    const link = screen.getByTitle('code');
    expect(link).toHaveTextContent('{ }');
    expect(link).toHaveTextContent('code');
  });

  it('renders the live glyph + "site" label for kind="live"', () => {
    render(<TypoIcon kind="live" href="https://example.com" />);
    const link = screen.getByTitle('site');
    expect(link).toHaveTextContent('↗');
    expect(link).toHaveTextContent('site');
  });

  it('renders the post glyph + "notes" label for kind="post"', () => {
    render(<TypoIcon kind="post" href="/writing/x" />);
    const link = screen.getByTitle('notes');
    expect(link).toHaveTextContent('¶');
    expect(link).toHaveTextContent('notes');
  });

  it('renders the rss glyph + "rss" label for kind="rss"', () => {
    render(<TypoIcon kind="rss" href="/rss.xml" />);
    const link = screen.getByTitle('rss');
    expect(link).toHaveTextContent('*');
    expect(link).toHaveTextContent('rss');
  });

  it('falls back to "→" glyph + the kind string as label for an unknown kind', () => {
    render(<TypoIcon kind="unknown-kind" href="https://example.com" />);
    const link = screen.getByTitle('unknown-kind');
    expect(link).toHaveTextContent('→');
    expect(link).toHaveTextContent('unknown-kind');
  });
});

describe('TypoIcon — href + title attributes', () => {
  it('uses the supplied href as the anchor href attribute', () => {
    render(<TypoIcon kind="github" href="https://github.com/sb/x" />);
    expect(screen.getByTitle('code')).toHaveAttribute(
      'href',
      'https://github.com/sb/x',
    );
  });

  it('uses the supplied title prop over the kind label default', () => {
    render(
      <TypoIcon kind="github" href="https://example.com" title="custom title" />,
    );
    expect(screen.getByTitle('custom title')).toBeInTheDocument();
  });

  it('falls back to the kind label when no title prop is supplied', () => {
    render(<TypoIcon kind="live" href="https://example.com" />);
    expect(screen.getByTitle('site')).toBeInTheDocument();
  });
});

describe('TypoIcon — fireEvent.click parity check', () => {
  // `fireEvent.click` is the canonical RTL primitive; we already cover the
  // dispatchEvent path above. This single parity test asserts the conditional
  // also gates `fireEvent.click` (which constructs its own MouseEvent),
  // protecting against regressions if RTL changes its dispatch internals.
  it('keeps a real URL navigable under fireEvent.click', () => {
    render(<TypoIcon kind="github" href="https://github.com/test/repo" />);
    const link = screen.getByTitle('code');
    const event = fireEvent.click(link);
    // `fireEvent.click` returns true when the event was NOT prevented.
    expect(event).toBe(true);
  });
});
