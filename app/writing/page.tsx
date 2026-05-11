import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Writing as WritingDesktop } from '@/components/public/pages/Writing';
import { Writing as WritingMobile } from '@/components/public/mobile/pages/Writing';
import { getPublishedPosts } from '@/lib/db';
import { safeLoad } from '@/lib/safe-load';
import type { Post } from '@/lib/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Writing — Swarnim Bagre',
  description: 'Mostly essays I wrote to figure out what I think. Occasionally a build log. Never a thread.',
  alternates: {
    canonical: 'https://swarnimbagre.com/writing',
  },
};

// Bundle date format: "APR 2026" — uppercase 3-letter month + 4-digit year.
const MONTH_NAMES = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

// Excerpt limit — matches the bundle's one-line description length (~120 chars).
const EXCERPT_MAX = 120;

interface WritingListItem {
  date: string;
  title: string;
  desc: string;
  href: string;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function deriveExcerpt(markdown: string): string {
  // Strip Markdown syntax to plain text, then truncate.
  const plain = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_~>#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length <= EXCERPT_MAX) return plain;
  return `${plain.slice(0, EXCERPT_MAX - 1).trimEnd()}…`;
}

function toListItem(row: Post): WritingListItem {
  return {
    title: row.title,
    date: formatDate(row.created_at),
    desc: deriveExcerpt(row.content),
    href: `/writing/${row.slug}`,
  };
}

export default async function WritingPage() {
  const rows = await safeLoad<Post[]>(
    () => getPublishedPosts(),
    [],
    'page:writing',
  );
  const items = rows.map(toListItem);
  const h = await headers();
  const variant = h.get('x-device-variant');
  return variant === 'mobile' ? <WritingMobile items={items} /> : <WritingDesktop items={items} />;
}
