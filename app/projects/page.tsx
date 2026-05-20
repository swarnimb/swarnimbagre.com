import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Projects as ProjectsDesktop } from '@/components/public/pages/Projects';
import { Projects as ProjectsMobile } from '@/components/public/mobile/pages/Projects';
import { loadPublicProjects, type PublicProject } from '@/lib/public-projects';
import { safeLoad } from '@/lib/safe-load';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Projects — Swarnim Bagre',
  description: 'Things I made when I should have been doing something else. A few are even useful — to me, mostly.',
  alternates: {
    canonical: 'https://swarnimbagre.com/projects',
  },
};

export default async function ProjectsPage() {
  const projects = await safeLoad<PublicProject[]>(
    () => loadPublicProjects(),
    [],
    'page:projects',
  );
  const h = await headers();
  const variant = h.get('x-device-variant');
  if (variant === 'mobile') {
    return <ProjectsMobile items={projects} />;
  }
  return <ProjectsDesktop items={projects} />;
}
