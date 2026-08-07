import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import sitemap from '@/app/sitemap';
import { ServiceError } from '@/lib/errors';
import type { Post } from '@/lib/types';

/**
 * T41 — `app/sitemap.ts`.
 *
 * `sitemap()` reads posts through `@/lib/db`, which reaches Supabase through
 * `next/headers`. The loader is mocked at the module boundary — the same idiom
 * `tests/public-projects.test.ts` uses — rather than stubbing a chained query
 * client as `tests/db.test.ts` does, because the unit under test here is the
 * URL assembly, not the query wiring.
 */

vi.mock('@/lib/db', () => ({
  getPublishedPosts: vi.fn(),
}));

const { getPublishedPosts } = await import('@/lib/db');

const SITE_ORIGIN = 'https://swarnimbagre.com';

const ROOT_URLS = [
  `${SITE_ORIGIN}/`,
  `${SITE_ORIGIN}/projects`,
  `${SITE_ORIGIN}/writing`,
  `${SITE_ORIGIN}/other`,
];

let consoleErrorSpy: ReturnType<typeof vi.spyOn> | undefined;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.resetAllMocks();
  consoleErrorSpy?.mockRestore();
});

/** Build a `Post` row with overrides on top of published defaults. */
function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'po1',
    title: 'On building in the open',
    slug: 'building-in-the-open',
    content: 'A short post body.',
    status: 'published',
    image_id: null,
    created_at: '2026-02-01T00:00:00.000Z',
    updated_at: '2026-02-02T00:00:00.000Z',
    sort_order: 0,
    ...overrides,
  };
}

describe('sitemap()', () => {
  describe('happy path', () => {
    it('emits the four public root routes and every published post', async () => {
      vi.mocked(getPublishedPosts).mockResolvedValue([
        makePost({ id: 'po1', slug: 'building-in-the-open' }),
        makePost({ id: 'po2', slug: 'a-second-post' }),
      ]);

      const entries = await sitemap();
      const urls = entries.map((entry) => entry.url);

      expect(urls).toEqual([
        ...ROOT_URLS,
        `${SITE_ORIGIN}/writing/building-in-the-open`,
        `${SITE_ORIGIN}/writing/a-second-post`,
      ]);
    });

    it('carries the post updated_at through as lastModified', async () => {
      vi.mocked(getPublishedPosts).mockResolvedValue([
        makePost({ updated_at: '2026-03-04T05:06:07.000Z' }),
      ]);

      const entries = await sitemap();
      const postEntry = entries.find((entry) =>
        entry.url.startsWith(`${SITE_ORIGIN}/writing/`),
      );

      expect(postEntry?.lastModified).toEqual(
        new Date('2026-03-04T05:06:07.000Z'),
      );
    });

    it('emits no project detail URLs — that route does not exist', async () => {
      vi.mocked(getPublishedPosts).mockResolvedValue([makePost()]);

      const urls = (await sitemap()).map((entry) => entry.url);

      expect(
        urls.filter((url) => url.startsWith(`${SITE_ORIGIN}/projects/`)),
      ).toEqual([]);
    });
  });

  describe('drafts', () => {
    it('excludes any post that is not published', async () => {
      vi.mocked(getPublishedPosts).mockResolvedValue([
        makePost({ id: 'po1', slug: 'published-post', status: 'published' }),
        makePost({ id: 'po2', slug: 'secret-draft', status: 'draft' }),
      ]);

      const urls = (await sitemap()).map((entry) => entry.url);

      expect(urls).toContain(`${SITE_ORIGIN}/writing/published-post`);
      expect(urls).not.toContain(`${SITE_ORIGIN}/writing/secret-draft`);
      expect(urls.some((url) => url.includes('secret-draft'))).toBe(false);
    });

    it('still emits the roots when every post is a draft', async () => {
      vi.mocked(getPublishedPosts).mockResolvedValue([
        makePost({ slug: 'secret-draft', status: 'draft' }),
      ]);

      const urls = (await sitemap()).map((entry) => entry.url);

      expect(urls).toEqual(ROOT_URLS);
    });
  });

  describe('error case', () => {
    it('degrades to the root routes when the post query fails', async () => {
      vi.mocked(getPublishedPosts).mockRejectedValue(
        new ServiceError('getPublishedPosts failed', {
          operation: 'getPublishedPosts',
          cause: { code: 'PGRST500', message: 'database boom' },
        }),
      );

      const urls = (await sitemap()).map((entry) => entry.url);

      expect(urls).toEqual(ROOT_URLS);
    });

    it('logs the failure loudly rather than swallowing it', async () => {
      vi.mocked(getPublishedPosts).mockRejectedValue(
        new ServiceError('getPublishedPosts failed', {
          operation: 'getPublishedPosts',
          cause: { code: 'PGRST500', message: 'database boom' },
        }),
      );

      await sitemap();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[safeLoad] route:sitemap failed',
        expect.objectContaining({
          context: 'route:sitemap',
          operation: 'getPublishedPosts',
          causeCode: 'PGRST500',
        }),
      );
    });
  });
});
