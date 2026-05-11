import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Projects as ProjectsDesktop } from '@/components/public/pages/Projects';
import { Projects as ProjectsMobile } from '@/components/public/mobile/pages/Projects';
import { getPublishedProjects } from '@/lib/db';
import { safeLoad } from '@/lib/safe-load';
import type { Project } from '@/lib/types';

export const metadata: Metadata = {
  title: 'Projects — Swarnim Bagre',
  description: 'Things I made when I should have been doing something else. A few are even useful — to me, mostly.',
  alternates: {
    canonical: 'https://swarnimbagre.com/projects',
  },
};

// Bundle's `status` vocabulary is open-form (e.g., "abandoned fondly"); the DB
// enum is `draft | published`. Until Option 3 widens the schema, every DB-driven
// list row renders as "shipped" so the status pill has something visually valid.
const STATUS_PLACEHOLDER = 'shipped';

interface ProjectListItem {
  title: string;
  status: string;
  blurb: string;
  slug: string;
}

function toListItem(row: Project): ProjectListItem {
  return {
    title: row.title,
    status: STATUS_PLACEHOLDER,
    blurb: row.description,
    slug: row.slug,
  };
}

export default async function ProjectsPage() {
  const rows = await safeLoad<Project[]>(
    () => getPublishedProjects(),
    [],
    'page:projects',
  );
  const items = rows.map(toListItem);
  const h = await headers();
  const variant = h.get('x-device-variant');
  return variant === 'mobile' ? <ProjectsMobile items={items} /> : <ProjectsDesktop items={items} />;
}
