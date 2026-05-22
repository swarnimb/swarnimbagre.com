'use client'

// ProjectsMobile — single-column stack of full-width project cards.
// T42 Session C: DB-driven via PublicProject[], with the 6 content-model
// fields surfaced as real screenshots / progress ring / 3 conditional
// URL icons. DemoLoop dropped from the data path.

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { resolveNavPath } from '@/lib/nav-targets';
import { MobilePage } from '@/components/public/mobile/MobilePage';
import { MobileNav } from '@/components/public/mobile/MobileNav';
import { MobileFooter } from '@/components/public/mobile/MobileFooter';
import { MobilePageTitle } from '@/components/public/mobile/MobilePageTitle';
import { MobileProjectCard } from '@/components/public/mobile/MobileProjectCard';
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
    <MobilePage>
      <MobileNav current="projects" onNav={onNav} resolveHref={resolveNavPath} />

      <MobilePageTitle
        title="projects"
        sub="Things I made when I should have been doing something else. A few are even useful — to me, mostly."
      />

      <div style={{
        display: "flex",
        flexDirection: "column",
        gap: 20,
        marginTop: 16,
      }}>
        {items.map((p) => (
          <MobileProjectCard
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
            onClick={() => router.push(`/projects/${p.slug}`)}
          />
        ))}
      </div>

      <div style={{ flex: 1 }} />
      <MobileFooter line="Made between disc golf rounds." />
    </MobilePage>
  );
}
