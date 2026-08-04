import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ProjectCard } from '@/components/public/ProjectCard';
import type { PublicProject } from '@/lib/public-projects';

/**
 * T46 acceptance: the redesigned `/projects` card.
 *
 * The card was rebuilt against the redesign: a media frame over a body of
 * title, subtitle, description, tags and actions. Its whole prop surface is
 * now `{ project, writeupHref }`, so these tests build a `PublicProject` and
 * assert what the body renders for each shape the schema allows, including
 * the almost-empty row, which the design draws deliberately.
 *
 * The frame itself needs media rows to render anything interactive, so it
 * stays out of these cases; `toSlides` is covered in `tests/ProjectFrame.test.ts`.
 */

afterEach(() => {
  cleanup();
});

/** Placeholder the card falls back to when a row has no title. */
const EMPTY_TITLE = 'Untitled project';

/** Placeholder the card falls back to when a row has no subtitle. */
const EMPTY_SUBTITLE = 'A new build, details on the way.';

/** Build a render-ready project with sensible defaults for tests. */
function makeProject(overrides: Partial<PublicProject> = {}): PublicProject {
  return {
    id: 'p1',
    title: 'putt-or-not',
    slug: 'putt-or-not',
    description: 'Disc golf stats tracker.',
    subtitle: 'Counts putts so you do not have to.',
    tags: null,
    thumbKind: null,
    progressPercent: null,
    githubUrl: null,
    liveUrl: null,
    postUrl: null,
    postId: null,
    imageUrl: null,
    imageAfterUrl: null,
    media: [],
    ...overrides,
  };
}

describe('ProjectCard: body text', () => {
  it('renders the title, subtitle and description', () => {
    render(<ProjectCard project={makeProject()} writeupHref={null} />);
    expect(screen.getByText('putt-or-not')).toBeInTheDocument();
    expect(screen.getByText('Counts putts so you do not have to.')).toBeInTheDocument();
    expect(screen.getByText('Disc golf stats tracker.')).toBeInTheDocument();
  });

  it('falls back to placeholder title and subtitle when both are absent', () => {
    render(
      <ProjectCard
        project={makeProject({ title: '', subtitle: null })}
        writeupHref={null}
      />,
    );
    expect(screen.getByText(EMPTY_TITLE)).toBeInTheDocument();
    expect(screen.getByText(EMPTY_SUBTITLE)).toBeInTheDocument();
  });
});

describe('ProjectCard: tag pills', () => {
  it('renders one pill per tag when tags are present', () => {
    const { container } = render(
      <ProjectCard
        project={makeProject({ tags: ['next', 'supabase'] })}
        writeupHref={null}
      />,
    );
    expect(container.querySelectorAll('.sb-tag')).toHaveLength(2);
    expect(screen.getByText('next')).toBeInTheDocument();
    expect(screen.getByText('supabase')).toBeInTheDocument();
  });

  it('renders no tag row when tags are absent', () => {
    const { container } = render(
      <ProjectCard project={makeProject({ tags: null })} writeupHref={null} />,
    );
    expect(container.querySelector('.sb-tags')).toBeNull();
  });
});

describe('ProjectCard: actions by URL presence', () => {
  it('renders Demo, GitHub and Writeup when all three targets are present', () => {
    render(
      <ProjectCard
        project={makeProject({
          liveUrl: 'https://putt.example',
          githubUrl: 'https://github.com/sb/putt',
        })}
        writeupHref="/writing/putt"
      />,
    );
    expect(screen.getByRole('link', { name: 'Demo' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'GitHub' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Writeup' })).toBeInTheDocument();
  });

  it('renders only GitHub when only githubUrl is present', () => {
    render(
      <ProjectCard
        project={makeProject({ githubUrl: 'https://github.com/sb/drumlog' })}
        writeupHref={null}
      />,
    );
    expect(screen.getByRole('link', { name: 'GitHub' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Demo' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Writeup' })).toBeNull();
  });

  it('renders the placeholder line and no links when no target is present', () => {
    const { container } = render(
      <ProjectCard project={makeProject()} writeupHref={null} />,
    );
    expect(screen.getByText('links coming soon')).toBeInTheDocument();
    expect(container.querySelectorAll('.sb-action')).toHaveLength(0);
  });
});
