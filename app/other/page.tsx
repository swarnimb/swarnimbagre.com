import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Other as OtherDesktop } from '@/components/public/pages/Other';
import { Other as OtherMobile } from '@/components/public/mobile/pages/Other';
import { getStatsByCategory } from '@/lib/db';
import { safeLoad } from '@/lib/safe-load';
import type { Stat } from '@/lib/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Everything else — Swarnim Bagre',
  description: 'Hobbies, sports I am mediocre at, and things I track just to feel slightly less unobserved.',
  alternates: {
    canonical: 'https://swarnimbagre.com/other',
  },
};

interface FlatStat {
  label: string;
  value: string;
  unit: string | null;
}

function flattenByCategory(grouped: Record<string, Stat[]>): FlatStat[] {
  const flat: FlatStat[] = [];
  // Category keys come pre-sorted (asc) from the data layer; within each
  // category rows are already newest-first.
  for (const category of Object.keys(grouped)) {
    for (const s of grouped[category]) {
      flat.push({ label: s.label, value: s.value, unit: s.unit });
    }
  }
  return flat;
}

export default async function OtherPage() {
  const grouped = await safeLoad<Record<string, Stat[]>>(
    () => getStatsByCategory(),
    {},
    'page:other',
  );
  const stats = flattenByCategory(grouped);
  const h = await headers();
  const variant = h.get('x-device-variant');
  return variant === 'mobile' ? <OtherMobile stats={stats} /> : <OtherDesktop stats={stats} />;
}
