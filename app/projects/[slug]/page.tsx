import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getProjectBySlug, getImageById, getPublishedPostById } from '@/lib/db';
import { formatDate } from '@/lib/format-date';
import { getImageUrl } from '@/lib/images';
import { safeLoad } from '@/lib/safe-load';
import { loadPublicProjectMedia } from '@/lib/public-project-media';
import type { Project, Post, PublicProjectMediaItem } from '@/lib/types';
import { Page } from '@/components/public/Page';
import { Nav } from '@/components/public/Nav';
import { Footer } from '@/components/public/Footer';
import { ProjectCard } from '@/components/public/ProjectCard';
import { MarkdownContent } from '@/components/public/MarkdownContent';
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
const BODY_MAX = 720;
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
  const [imageUrl, imageAfterUrl, media, linkedPost] = await Promise.all([
    safeLoad<string | null>(() => resolveProjectImage(project.image_id), null, 'page:projects/[slug]:image'),
    safeLoad<string | null>(() => resolveProjectImage(project.image_after_id), null, 'page:projects/[slug]:image-after'),
    safeLoad<PublicProjectMediaItem[]>(() => loadPublicProjectMedia(project.id), [], 'page:projects/[slug]:media'),
    safeLoad<Post | null>(() => getPublishedPostById(project.post_id), null, 'page:projects/[slug]:linked-post'),
  ]);
  const h = await headers();
  const variant = h.get('x-device-variant');
  if (variant === 'mobile') {
    return <MobileDetail project={project} imageUrl={imageUrl} imageAfterUrl={imageAfterUrl} media={media} linkedPost={linkedPost} />;
  }
  return <DesktopDetail project={project} imageUrl={imageUrl} imageAfterUrl={imageAfterUrl} media={media} linkedPost={linkedPost} />;
}

/**
 * Resolve a project image id to a signed Storage URL. Returns null when the
 * id is null/missing; throws on storage failures so the page-level safeLoad
 * can log and fall back. Mirrors `lib/public-projects.ts` resolution.
 */
async function resolveProjectImage(imageId: string | null): Promise<string | null> {
  if (!imageId) return null;
  const record = await getImageById(imageId);
  if (!record) return null;
  return getImageUrl(record.bucket_path);
}

interface DesktopDetailProps {
  project: Project;
  imageUrl: string | null;
  imageAfterUrl: string | null;
  media: PublicProjectMediaItem[];
  linkedPost: Post | null;
}

function DesktopDetail({ project, imageUrl, imageAfterUrl, media, linkedPost }: DesktopDetailProps) {
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
      <ProjectCard
        title={project.title}
        blurb={project.description}
        progressPercent={project.progress_percent}
        githubUrl={project.github_url}
        liveUrl={project.live_url}
        postUrl={project.post_url}
        imageUrl={imageUrl}
        imageAfterUrl={imageAfterUrl}
        media={media}
        view="detail"
      />
      {renderLinkedPostBody(linkedPost)}
      <div style={{ flex: 1 }} />
      <Footer />
    </Page>
  );
}

interface MobileDetailProps {
  project: Project;
  imageUrl: string | null;
  imageAfterUrl: string | null;
  media: PublicProjectMediaItem[];
  linkedPost: Post | null;
}

function MobileDetail({ project, imageUrl, imageAfterUrl, media, linkedPost }: MobileDetailProps) {
  return (
    <MobilePage>
      <MobileNav current="projects" hrefs={NAV_PATHS} />
      <MobilePageTitle title={project.title} />
      <MobileProjectCard
        title={project.title}
        blurb={project.description}
        progressPercent={project.progress_percent}
        githubUrl={project.github_url}
        liveUrl={project.live_url}
        postUrl={project.post_url}
        imageUrl={imageUrl}
        imageAfterUrl={imageAfterUrl}
        media={media}
        view="detail"
      />
      {renderLinkedPostBody(linkedPost)}
      <div style={{ flex: 1 }} />
      <MobileFooter line="Made between disc golf rounds." />
    </MobilePage>
  );
}

/**
 * Render a project's linked writeup below the card (Override 3, T45.C).
 *
 * Renders NOTHING when `post` is null — a draft, missing, or unlinked post
 * resolves to null upstream in `getPublishedPostById`, the security boundary.
 * Mirrors the `/writing/[slug]` body wrapper (720 max-width, `var(--font-serif)`,
 * `var(--fg)`, margin-top 24, `MarkdownContent`) preceded by a hairline rule
 * and a post-date meta label. The post's own `<h1>` is deliberately NOT
 * repeated — the project title already heads the page.
 */
function renderLinkedPostBody(post: Post | null) {
  if (!post) return null;
  return (
    <>
      <div style={{
        borderTop: '1px solid var(--hairline)',
        marginTop: 32,
      }} />
      <div style={{
        font: 'var(--meta-sm)',
        color: 'var(--fg-muted)',
        letterSpacing: '0.14em',
        marginTop: 24,
      }}>
        {formatDate(post.created_at)}
      </div>
      <div style={{
        maxWidth: BODY_MAX,
        marginTop: 24,
        color: 'var(--fg)',
        fontFamily: 'var(--font-serif)',
      }}>
        <MarkdownContent md={post.content} />
      </div>
    </>
  );
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

