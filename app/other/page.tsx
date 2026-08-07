import type { Metadata } from 'next';
import { Other } from '@/components/public/pages/Other';
import { getNotes, getOrderedStats } from '@/lib/db';
import { safeLoad } from '@/lib/safe-load';
import type { Note, Stat } from '@/lib/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Everything else · Swarnim Bagre',
  description:
    'Hobbies, sports I am mediocre at, and things I track just to feel slightly less unobserved.',
  alternates: {
    canonical: 'https://swarnimbagre.com/other',
  },
};

/**
 * T46: the page now reads two ordered lists rather than one category-grouped
 * map. Stats fill the numeric tiles, notes fill the text tiles, and each is
 * loaded behind its own safeLoad so one failing query cannot blank the other
 * half of the grid.
 */
export default async function OtherPage() {
  const [stats, notes] = await Promise.all([
    safeLoad<Stat[]>(() => getOrderedStats(), [], 'page:other:stats'),
    safeLoad<Note[]>(() => getNotes(), [], 'page:other:notes'),
  ]);

  return <Other stats={stats} notes={notes} />;
}
