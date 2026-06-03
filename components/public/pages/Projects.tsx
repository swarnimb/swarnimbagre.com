'use client'

// Projects — premium 2-column card grid.
// T42 Session B: DB-driven, with the 6 content-model fields surfaced as
// real screenshots / progress ring / 3 conditional URL icons.

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { resolveNavPath } from '@/lib/nav-targets';
import { Page } from '@/components/public/Page';
import { Nav } from '@/components/public/Nav';
import { Footer } from '@/components/public/Footer';
import { ProjectCard } from '@/components/public/ProjectCard';
import type { PublicProject } from '@/lib/public-projects';

interface ProjectsProps {
  items?: PublicProject[];
}

export function Projects({ items = [] }: ProjectsProps = {}) {
  const router = useRouter();
  const onNav = useCallback((target: string) => {
    router.push(resolveNavPath(target));
  }, [router]);

  return (
    <Page>
      <Nav current="projects" onNav={onNav} resolveHref={resolveNavPath} />

      <header style={{ padding: "72px 0 24px", maxWidth: 720 }}>
        <h1 style={{
          font: "300 italic clamp(48px, 6vw, 72px)/1 var(--font-serif)",
          letterSpacing: "-0.025em",
          color: "var(--fg-strong)",
          margin: 0,
          fontVariationSettings: '"SOFT" 100, "WONK" 1',
        }}>
          projects
        </h1>
        <p style={{
          font: "var(--body-lg)",
          color: "var(--fg-muted)",
          marginTop: 20,
          textWrap: "pretty",
          maxWidth: 540,
        }}>
          Things I made when I should have been doing something else.
          A few are even useful — to me, mostly.
        </p>
      </header>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: 24,
        marginTop: 24,
      }}>
        {items.map((p) => {
          // Override 3 (T45.D): the title links to the detail page only when
          // the detail page has something the card does not — an attached post
          // OR more than one media item. Otherwise the title is inert.
          const hasDetail = p.postId != null || p.media.length > 1;
          return (
            <ProjectCard
              key={p.id}
              title={p.title}
              blurb={p.description}
              progressPercent={p.progressPercent}
              githubUrl={p.githubUrl}
              liveUrl={p.liveUrl}
              postUrl={p.postUrl}
              imageUrl={p.imageUrl}
              imageAfterUrl={p.imageAfterUrl}
              media={p.media}
              onClick={hasDetail ? () => router.push(`/projects/${p.slug}`) : undefined}
            />
          );
        })}
      </div>

      <div style={{ flex: 1 }} />
      <Footer line="Made between disc golf rounds." />
    </Page>
  );
}
