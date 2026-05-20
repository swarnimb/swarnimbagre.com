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

/**
 * Bridge between desktop's `PublicProject` shape (T42 Session B) and the
 * mobile component's pre-T42 `ProjectListItem` contract. Mobile is migrated
 * in Session C; until then we pass it a minimal shim built from the same DB
 * rows so it does not crash.
 */
interface MobileListItem {
  title: string;
  status: string;
  blurb: string;
  slug: string;
}

/** Mobile page still expects this until Session C lands. */
const MOBILE_STATUS_PLACEHOLDER = 'shipped';

function toMobileItem(row: PublicProject): MobileListItem {
  return {
    title: row.title,
    status: MOBILE_STATUS_PLACEHOLDER,
    blurb: row.description,
    slug: row.slug,
  };
}

export default async function ProjectsPage() {
  const projects = await safeLoad<PublicProject[]>(
    () => loadPublicProjects(),
    [],
    'page:projects',
  );
  const h = await headers();
  const variant = h.get('x-device-variant');
  if (variant === 'mobile') {
    return <ProjectsMobile items={projects.map(toMobileItem)} />;
  }
  return <ProjectsDesktop items={projects} />;
}
