import type { Metadata } from 'next';
import { Home } from '@/components/public/pages/Home';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Swarnim Bagre',
  description:
    'Personal site: projects, writing, and assorted hobby stats. Built by someone figuring it out in public.',
  alternates: {
    canonical: 'https://swarnimbagre.com/',
  },
};

/**
 * T46: the home page no longer reads any data. The redesign's home is a
 * static conversation plus three nav buttons - it does not list projects, so
 * the loadPublicProjects call and the desktop/mobile branch both went away.
 */
export default function HomePage() {
  return <Home />;
}
