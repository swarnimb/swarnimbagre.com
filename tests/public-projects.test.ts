import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadPublicProjects } from '@/lib/public-projects';
import { ServiceError } from '@/lib/errors';
import type { Project, ImageRecord } from '@/lib/types';

vi.mock('@/lib/db', () => ({
  getPublishedProjects: vi.fn(),
  getImageById: vi.fn(),
}));

vi.mock('@/lib/images', () => ({
  getImageUrl: vi.fn(),
}));

vi.mock('@/lib/public-project-media', () => ({
  loadPublicProjectMedia: vi.fn(),
}));

const { getPublishedProjects, getImageById } = await import('@/lib/db');
const { getImageUrl } = await import('@/lib/images');
const { loadPublicProjectMedia } = await import('@/lib/public-project-media');

let consoleErrorSpy: ReturnType<typeof vi.spyOn> | undefined;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  // T43.D: existing tests exercise `loadPublicProjects` without media. Default
  // the new dependency to `[]` so each test only has to override when it
  // specifically wants populated media (none currently do — T43.D's media
  // coverage lives in `tests/public-project-media.test.ts`).
  vi.mocked(loadPublicProjectMedia).mockResolvedValue([]);
});

afterEach(() => {
  vi.resetAllMocks();
  consoleErrorSpy?.mockRestore();
});

/** Build a `Project` row with overrides on top of sensible defaults. */
function makeRow(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    title: 'putt-or-not',
    slug: 'putt-or-not',
    description: 'Disc golf stats tracker.',
    status: 'published',
    image_id: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    github_url: null,
    live_url: null,
    post_url: null,
    progress_percent: null,
    thumb_kind: null,
    image_after_id: null,
    post_id: null,
    sort_order: 0,
    ...overrides,
  };
}

/** Build an `ImageRecord` referenced from a project row. */
function makeImage(id: string, path: string): ImageRecord {
  return {
    id,
    bucket_path: path,
    alt_text: '',
    parent_id: 'p1',
    parent_type: 'projects',
    created_at: '2026-01-01T00:00:00.000Z',
  };
}

describe('loadPublicProjects — happy path', () => {
  it('maps DB rows to PublicProject shape with snake_case fields renamed', async () => {
    vi.mocked(getPublishedProjects).mockResolvedValueOnce([
      makeRow({
        github_url: 'https://github.com/sb/x',
        live_url: 'https://x.example',
        post_url: '/writing/x',
        progress_percent: 60,
        thumb_kind: 'disc',
      }),
    ]);

    const result = await loadPublicProjects();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'p1',
      title: 'putt-or-not',
      slug: 'putt-or-not',
      description: 'Disc golf stats tracker.',
      thumbKind: 'disc',
      progressPercent: 60,
      githubUrl: 'https://github.com/sb/x',
      liveUrl: 'https://x.example',
      postUrl: '/writing/x',
      imageUrl: null,
      imageAfterUrl: null,
    });
  });

  it('sets postId from the row post_id (Override 3, T45.D)', async () => {
    vi.mocked(getPublishedProjects).mockResolvedValueOnce([
      makeRow({ post_id: 'post-7' }),
    ]);

    const result = await loadPublicProjects();
    expect(result[0].postId).toBe('post-7');
  });

  it('sets postId to null when the row has no attached post', async () => {
    vi.mocked(getPublishedProjects).mockResolvedValueOnce([makeRow()]);

    const result = await loadPublicProjects();
    expect(result[0].postId).toBeNull();
  });

  it('resolves image_id to a signed URL when present', async () => {
    vi.mocked(getPublishedProjects).mockResolvedValueOnce([
      makeRow({ image_id: 'img-1' }),
    ]);
    vi.mocked(getImageById).mockResolvedValueOnce(makeImage('img-1', 'projects/p1/main.jpg'));
    vi.mocked(getImageUrl).mockResolvedValueOnce('https://signed.example/main');

    const result = await loadPublicProjects();
    expect(result[0].imageUrl).toBe('https://signed.example/main');
    expect(result[0].imageAfterUrl).toBeNull();
  });

  it('resolves both image_id and image_after_id when both are present', async () => {
    vi.mocked(getPublishedProjects).mockResolvedValueOnce([
      makeRow({ image_id: 'img-1', image_after_id: 'img-2' }),
    ]);
    vi.mocked(getImageById)
      .mockResolvedValueOnce(makeImage('img-1', 'projects/p1/before.jpg'))
      .mockResolvedValueOnce(makeImage('img-2', 'projects/p1/after.jpg'));
    vi.mocked(getImageUrl)
      .mockResolvedValueOnce('https://signed.example/before')
      .mockResolvedValueOnce('https://signed.example/after');

    const result = await loadPublicProjects();
    expect(result[0].imageUrl).toBe('https://signed.example/before');
    expect(result[0].imageAfterUrl).toBe('https://signed.example/after');
  });

  it('returns an empty array when there are no published projects', async () => {
    vi.mocked(getPublishedProjects).mockResolvedValueOnce([]);
    const result = await loadPublicProjects();
    expect(result).toEqual([]);
  });
});

describe('loadPublicProjects — failure isolation', () => {
  it('returns the row with imageUrl=null and logs when image resolution fails', async () => {
    vi.mocked(getPublishedProjects).mockResolvedValueOnce([
      makeRow({ image_id: 'broken' }),
    ]);
    vi.mocked(getImageById).mockRejectedValueOnce(new Error('storage down'));

    const result = await loadPublicProjects();
    expect(result[0].imageUrl).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('returns the row with imageUrl=null when the image record is missing', async () => {
    vi.mocked(getPublishedProjects).mockResolvedValueOnce([
      makeRow({ image_id: 'gone' }),
    ]);
    vi.mocked(getImageById).mockResolvedValueOnce(null);

    const result = await loadPublicProjects();
    expect(result[0].imageUrl).toBeNull();
  });

  it('propagates the underlying ServiceError when the project query itself fails', async () => {
    vi.mocked(getPublishedProjects).mockRejectedValueOnce(
      new ServiceError('boom', { operation: 'getPublishedProjects', cause: new Error('db') }),
    );
    await expect(loadPublicProjects()).rejects.toBeInstanceOf(ServiceError);
  });
});
