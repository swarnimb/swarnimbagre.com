import Link from 'next/link';
import { ProjectFrame } from './ProjectFrame';
import type { PublicProject } from '@/lib/public-projects';

/**
 * A project card on the `/projects` grid.
 *
 * T46 rebuilt this against the redesign: media frame over a body of title,
 * subtitle, description, tags and actions. Everything below the frame
 * degrades gracefully, because the schema allows a project to be almost
 * entirely empty and the design draws that state deliberately rather than
 * leaving a hole.
 *
 * The card is a server component. Only the frame needs interactivity, and it
 * carries its own 'use client' boundary.
 *
 * `writeupHref` resolves from the T45 `post_id` link. There is no project
 * detail page any more (T46 Q2), so depth lives in the linked post.
 */

const EMPTY_TITLE = 'Untitled project';
const EMPTY_SUBTITLE = 'A new build, details on the way.';

export function ProjectCard({
  project,
  writeupHref,
}: {
  project: PublicProject;
  writeupHref: string | null;
}) {
  const title = project.title?.trim() || EMPTY_TITLE;
  const isUntitled = !project.title?.trim();
  const subtitle = project.subtitle?.trim() || EMPTY_SUBTITLE;
  const tags = project.tags?.filter((tag) => tag.trim().length > 0) ?? [];

  const hasAnyAction = Boolean(
    project.liveUrl || project.githubUrl || writeupHref,
  );

  return (
    <article className="sb-card">
      <ProjectFrame media={project.media} title={title} />

      <div className="sb-body">
        <h2
          className={`sb-card-title${isUntitled ? ' sb-card-title--empty' : ''}`}
        >
          {title}
        </h2>

        <p className="sb-subtitle">{subtitle}</p>

        {project.description?.trim() && (
          <p className="sb-desc">{project.description}</p>
        )}

        {tags.length > 0 && (
          <div className="sb-tags">
            {tags.map((tag) => (
              <span className="sb-tag" key={tag}>
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="sb-actions">
          {project.liveUrl && (
            <a
              className="sb-action sb-action--primary"
              href={project.liveUrl}
              target="_blank"
              rel="noreferrer noopener"
            >
              Demo
            </a>
          )}
          {project.githubUrl && (
            <a
              className="sb-action sb-action--secondary"
              href={project.githubUrl}
              target="_blank"
              rel="noreferrer noopener"
            >
              GitHub
            </a>
          )}
          {writeupHref && (
            <Link className="sb-action sb-action--secondary" href={writeupHref}>
              Writeup
            </Link>
          )}
          {!hasAnyAction && <span className="sb-soon">links coming soon</span>}
        </div>
      </div>
    </article>
  );
}
