import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getPostBySlug } from '@/lib/db';
import { safeLoad } from '@/lib/safe-load';
import type { Post } from '@/lib/types';
import { Page } from '@/components/public/Page';
import { Nav } from '@/components/public/Nav';
import { Footer } from '@/components/public/Footer';
import { MobilePage } from '@/components/public/mobile/MobilePage';
import { MobileNav } from '@/components/public/mobile/MobileNav';
import { MobileFooter } from '@/components/public/mobile/MobileFooter';
import { MarkdownContent } from '@/components/public/MarkdownContent';
import { NAV_PATHS } from '@/lib/nav-targets';

const SITE_ORIGIN = 'https://swarnimbagre.com';
const DESCRIPTION_MAX = 160;
const HEADER_PADDING_DESKTOP = '72px 0 32px';
const HEADER_MAX = 720;
const BODY_MAX = 720;
const WRITING_INDEX_PATH = '/writing';

interface DetailParams {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: DetailParams): Promise<Metadata> {
  const { slug } = await params;
  const post = await safeLoad<Post | null>(() => getPostBySlug(slug), null, 'metadata:writing/[slug]');
  if (!post) {
    return { title: 'Post not found — Swarnim Bagre' };
  }
  return {
    title: `${post.title} — Swarnim Bagre`,
    description: deriveDescription(post.content),
    alternates: { canonical: `${SITE_ORIGIN}/writing/${post.slug}` },
  };
}

export default async function PostDetailPage({ params }: DetailParams) {
  const { slug } = await params;
  const post = await safeLoad<Post | null>(() => getPostBySlug(slug), null, 'page:writing/[slug]');
  if (!post) notFound();
  const h = await headers();
  const variant = h.get('x-device-variant');
  return variant === 'mobile' ? <MobileDetail post={post} /> : <DesktopDetail post={post} />;
}

function DesktopDetail({ post }: { post: Post }) {
  return (
    <Page>
      <Nav current="writing" hrefs={NAV_PATHS} />
      <header style={{ padding: HEADER_PADDING_DESKTOP, maxWidth: HEADER_MAX }}>
        <a href={WRITING_INDEX_PATH} className="link" style={{
          font: 'var(--meta-sm)',
          color: 'var(--fg-muted)',
          letterSpacing: '0.14em',
        }}>
          ← writing
        </a>
        <div style={{
          font: 'var(--meta-sm)',
          color: 'var(--fg-muted)',
          letterSpacing: '0.14em',
          marginTop: 24,
        }}>
          {formatDate(post.created_at)}
        </div>
        <h1 style={{
          font: '400 44px/1.2 var(--font-serif)',
          color: 'var(--fg-strong)',
          letterSpacing: '-0.012em',
          margin: '12px 0 0',
        }}>
          {post.title}
        </h1>
      </header>
      {renderBody(post.content)}
      <div style={{ flex: 1 }} />
      <Footer line="Last edited at an embarrassing hour." />
    </Page>
  );
}

function MobileDetail({ post }: { post: Post }) {
  return (
    <MobilePage>
      <MobileNav current="writing" hrefs={NAV_PATHS} />
      <header style={{ padding: '20px 0 8px' }}>
        <a href={WRITING_INDEX_PATH} className="link" style={{
          font: 'var(--meta-sm)',
          color: 'var(--fg-muted)',
          letterSpacing: '0.16em',
        }}>
          ← writing
        </a>
        <div style={{
          font: 'var(--meta-sm)',
          color: 'var(--fg-faint)',
          letterSpacing: '0.16em',
          marginTop: 18,
        }}>
          {formatDate(post.created_at)}
        </div>
        <h1 style={{
          font: '400 30px/1.25 var(--font-serif)',
          color: 'var(--fg-strong)',
          letterSpacing: '-0.012em',
          margin: '10px 0 0',
        }}>
          {post.title}
        </h1>
      </header>
      {renderBody(post.content)}
      <div style={{ flex: 1 }} />
      <MobileFooter line="Last edited at an embarrassing hour." />
    </MobilePage>
  );
}

function renderBody(content: string) {
  return (
    <div style={{
      maxWidth: BODY_MAX,
      marginTop: 24,
      color: 'var(--fg)',
      fontFamily: 'var(--font-serif)',
    }}>
      <MarkdownContent md={content} />
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const month = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  const year = d.getUTCFullYear();
  return `${month} ${year}`;
}

function deriveDescription(content: string): string {
  const firstPara = content.split(/\n\s*\n/)[0] ?? '';
  const clean = firstPara.replace(/\s+/g, ' ').trim();
  if (clean.length <= DESCRIPTION_MAX) return clean;
  return `${clean.slice(0, DESCRIPTION_MAX - 1).trimEnd()}…`;
}

