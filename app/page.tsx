import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Home as HomeDesktop } from '@/components/public/pages/Home';
import { Home as HomeMobile } from '@/components/public/mobile/pages/Home';
import { loadPublicProjects, type PublicProject } from '@/lib/public-projects';
import { safeLoad } from '@/lib/safe-load';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Swarnim Bagre',
  description: 'Personal site — projects, writing, and assorted hobby stats. Built by someone figuring it out in public.',
  alternates: {
    canonical: 'https://swarnimbagre.com/',
  },
};

export default async function HomePage() {
  const projects = await safeLoad<PublicProject[]>(
    () => loadPublicProjects(),
    [],
    'page:home',
  );
  const h = await headers();
  const variant = h.get('x-device-variant');
  return variant === 'mobile' ? <HomeMobile /> : <HomeDesktop projects={projects} />;
}
