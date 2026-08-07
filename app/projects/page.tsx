import type { Metadata } from 'next';
import { Projects } from '@/components/public/pages/Projects';
import { loadPublicProjects, type PublicProject } from '@/lib/public-projects';
import { getPublishedPosts } from '@/lib/db';
import { safeLoad } from '@/lib/safe-load';
import type { Post } from '@/lib/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Projects · Swarnim Bagre',
  description:
    'Things I made when I should have been doing something else. A few are even useful, to me, mostly.',
  alternates: {
    canonical: 'https://swarnimbagre.com/projects',
  },
};

/**
 * Resolve each project's linked writeup to a post URL in one pass.
 *
 * Projects carry `post_id` (T45); the card needs a slug. Loading the post
 * list once and indexing it keeps this at a single query no matter how many
 * projects link to a writeup. Posts that are no longer published simply drop
 * out of the map, so the card renders without a Writeup action rather than
 * linking to a 404.
 */
function buildWriteupHrefs(
  projects: PublicProject[],
  posts: Post[],
): Record<string, string> {
  const slugById = new Map(posts.map((post) => [post.id, post.slug]));
  const hrefs: Record<string, string> = {};
  for (const project of projects) {
    if (!project.postId) continue;
    const slug = slugById.get(project.postId);
    if (slug) hrefs[project.id] = `/writing/${slug}`;
  }
  return hrefs;
}

export default async function ProjectsPage() {
  const [projects, posts] = await Promise.all([
    safeLoad<PublicProject[]>(() => loadPublicProjects(), [], 'page:projects'),
    safeLoad<Post[]>(() => getPublishedPosts(), [], 'page:projects:posts'),
  ]);

  return (
    <Projects
      projects={projects}
      writeupHrefs={buildWriteupHrefs(projects, posts)}
    />
  );
}
