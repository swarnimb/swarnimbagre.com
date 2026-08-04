import { SiteHeader } from '@/components/public/SiteHeader';
import { ProjectCard } from '@/components/public/ProjectCard';
import type { PublicProject } from '@/lib/public-projects';

/**
 * `/projects` — the card grid.
 *
 * `writeupHrefs` maps project id to the linked post's URL. It is resolved on
 * the server in a single pass rather than per-card, so a grid of N projects
 * still costs one posts query.
 */

const LEDE =
  'A selection of things I built after hours. Most of them solve a problem only I had.';

export function Projects({
  projects,
  writeupHrefs,
}: {
  projects: PublicProject[];
  writeupHrefs: Record<string, string>;
}) {
  return (
    <div className="container">
      <SiteHeader />

      <div className="title-block">
        <h1 className="page-title">Projects</h1>
        <p className="page-lede">{LEDE}</p>
      </div>

      <section className="projects-grid">
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            writeupHref={writeupHrefs[project.id] ?? null}
          />
        ))}
      </section>
    </div>
  );
}
