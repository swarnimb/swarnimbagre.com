'use client'

// ProjectsMobile — single-column stack of full-width project cards.

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { resolveNavPath } from '@/lib/nav-targets';
import { MobilePage } from '@/components/public/mobile/MobilePage';
import { MobileNav } from '@/components/public/mobile/MobileNav';
import { MobileFooter } from '@/components/public/mobile/MobileFooter';
import { MobilePageTitle } from '@/components/public/mobile/MobilePageTitle';
import { MobileProjectCard } from '@/components/public/mobile/MobileProjectCard';

const DEFAULT_PROJECTS = [
  { title: "putt-or-not", status: "active",
    blurb: "Disc golf stats tracker for me and four friends. Tells us, mathematically, who is the worst.",
    demo:  { kind: "demo", variant: "rings" },
    links: [{ kind: "github", href: "#" }, { kind: "live", href: "#" }, { kind: "post", href: "#" }] },
  { title: "afford.lunch", status: "dormant",
    blurb: "A finance app that answers exactly one question — can I afford lunch — and refuses to do anything else.",
    demo:  { kind: "still" },
    links: [{ kind: "github", href: "#" }, { kind: "live", href: "#" }] },
  { title: "agentless", status: "abandoned fondly",
    blurb: "A small framework for AI agent setups. Mostly an excuse to learn what I keep half-understanding from blog posts.",
    demo:  { kind: "demo", variant: "agent" },
    links: [{ kind: "github", href: "#" }, { kind: "post", href: "#" }] },
  { title: "drumlog", status: "active",
    blurb: "Times my drum practice and roughly how loudly my neighbours have to tolerate it.",
    demo:  { kind: "demo", variant: "bars" },
    links: [{ kind: "github", href: "#" }] },
  { title: "tennis-elbow", status: "dormant",
    blurb: "Spreadsheet pretending to be an app. Tracks every match I lose and what I blame it on.",
    demo:  { kind: "before-after" },
    links: [{ kind: "live", href: "#" }, { kind: "post", href: "#" }] },
  { title: "tape.studio", status: "active",
    blurb: "Browser-only loop pedal for people who own no equipment, including me.",
    demo:  { kind: "demo", variant: "wave" },
    links: [{ kind: "github", href: "#" }, { kind: "live", href: "#" }] },
];

interface ProjectLink {
  kind: string;
  href?: string;
}
interface ProjectDemo {
  kind?: string;
  variant?: string;
}
export interface ProjectItem {
  title: string;
  status?: string;
  blurb: string;
  demo?: ProjectDemo;
  links?: ProjectLink[];
  /** When present, the card navigates to `/projects/{slug}` on click. */
  slug?: string;
}

interface ProjectsProps {
  items?: ProjectItem[];
}

export function Projects({ items = DEFAULT_PROJECTS }: ProjectsProps = {}) {
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
            key={p.slug ?? p.title}
            title={p.title}
            status={p.status}
            blurb={p.blurb}
            demo={p.demo}
            links={p.links}
            onClick={p.slug ? () => router.push(`/projects/${p.slug}`) : undefined}
          />
        ))}
      </div>

      <div style={{ flex: 1 }} />
      <MobileFooter line="Made between disc golf rounds." />
    </MobilePage>
  );
}
