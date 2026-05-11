import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getProjectBySlug } from '@/lib/db';
import { safeLoad } from '@/lib/safe-load';
import type { Project } from '@/lib/types';
import { Page } from '@/components/public/Page';
import { Nav } from '@/components/public/Nav';
import { Footer } from '@/components/public/Footer';
import { ProjectCard } from '@/components/public/ProjectCard';
import { MobilePage } from '@/components/public/mobile/MobilePage';
import { MobileNav } from '@/components/public/mobile/MobileNav';
import { MobileFooter } from '@/components/public/mobile/MobileFooter';
import { MobilePageTitle } from '@/components/public/mobile/MobilePageTitle';
import { MobileProjectCard } from '@/components/public/mobile/MobileProjectCard';
import { NAV_PATHS } from '@/lib/nav-targets';

const SITE_ORIGIN = 'https://swarnimbagre.com';
const DESCRIPTION_MAX = 160;
const DETAIL_HEADER_PADDING = '72px 0 24px';
const DETAIL_HEADER_MAX = 720;
const PROJECTS_INDEX_PATH = '/projects';

interface DetailParams {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: DetailParams): Promise<Metadata> {
  const { slug } = await params;
  const project = await safeLoad<Project | null>(() => getProjectBySlug(slug), null, 'metadata:projects/[slug]');
  if (!project) {
    return { title: 'Project not found — Swarnim Bagre' };
  }
  const description = truncate(project.description, DESCRIPTION_MAX);
  return {
    title: `${project.title} — Swarnim Bagre`,
    description,
    alternates: { canonical: `${SITE_ORIGIN}/projects/${project.slug}` },
  };
}

export default async function ProjectDetailPage({ params }: DetailParams) {
  const { slug } = await params;
  const project = await safeLoad<Project | null>(() => getProjectBySlug(slug), null, 'page:projects/[slug]');
  if (!project) notFound();
  const h = await headers();
  const variant = h.get('x-device-variant');
  return variant === 'mobile' ? <MobileDetail project={project} /> : <DesktopDetail project={project} />;
}

function DesktopDetail({ project }: { project: Project }) {
  return (
    <Page>
      <Nav current="projects" hrefs={NAV_PATHS} />
      <header style={{ padding: DETAIL_HEADER_PADDING, maxWidth: DETAIL_HEADER_MAX }}>
        <a href={PROJECTS_INDEX_PATH} className="link" style={{
          font: 'var(--meta-sm)',
          color: 'var(--fg-muted)',
          letterSpacing: '0.14em',
        }}>
          ← projects
        </a>
      </header>
      <ProjectCard title={project.title} status={project.status} blurb={project.description} />
      <div style={{ flex: 1 }} />
      <Footer />
    </Page>
  );
}

function MobileDetail({ project }: { project: Project }) {
  return (
    <MobilePage>
      <MobileNav current="projects" hrefs={NAV_PATHS} />
      <MobilePageTitle title={project.title} />
      <MobileProjectCard title={project.title} status={project.status} blurb={project.description} />
      <div style={{ flex: 1 }} />
      <MobileFooter line="Made between disc golf rounds." />
    </MobilePage>
  );
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

