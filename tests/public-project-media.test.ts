import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadPublicProjectMedia } from '@/lib/public-project-media';
import { ServiceError } from '@/lib/errors';
import type { ProjectMedia, ImageRecord } from '@/lib/types';

vi.mock('@/lib/db', () => ({
  getProjectMediaByProject: vi.fn(),
  getImageById: vi.fn(),
}));

vi.mock('@/lib/images', () => ({
  getImageUrl: vi.fn(),
}));

const { getProjectMediaByProject, getImageById } = await import('@/lib/db');
const { getImageUrl } = await import('@/lib/images');

let consoleErrorSpy: ReturnType<typeof vi.spyOn> | undefined;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.resetAllMocks();
  consoleErrorSpy?.mockRestore();
});

/** Build a `ProjectMedia` row with overrides on top of sensible defaults. */
function makeMedia(overrides: Partial<ProjectMedia> = {}): ProjectMedia {
  return {
    id: 'm1',
    project_id: 'p1',
    image_id: 'img-1',
    image_after_id: null,
    order_index: 0,
    created_at: '2026-05-20T00:00:00.000Z',
    ...overrides,
  };
}

/** Build an `ImageRecord` referenced from a media row. */
function makeImage(id: string, path: string, alt = 'sample alt text'): ImageRecord {
  return {
    id,
    bucket_path: path,
    alt_text: alt,
    parent_id: null,
    parent_type: null,
    created_at: '2026-05-20T00:00:00.000Z',
  };
}

describe('loadPublicProjectMedia — happy path', () => {
  it('returns an empty array when the project has no media rows', async () => {
    vi.mocked(getProjectMediaByProject).mockResolvedValueOnce([]);
    const result = await loadPublicProjectMedia('p1');
    expect(result).toEqual([]);
  });

  it('resolves image_id to a signed URL and carries alt text on a single-image row', async () => {
    vi.mocked(getProjectMediaByProject).mockResolvedValueOnce([makeMedia()]);
    vi.mocked(getImageById).mockResolvedValueOnce(
      makeImage('img-1', 'projects/p1/m1.jpg', 'main alt'),
    );
    vi.mocked(getImageUrl).mockResolvedValueOnce('https://signed.example/m1');

    const result = await loadPublicProjectMedia('p1');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'm1',
      imageUrl: 'https://signed.example/m1',
      imageAlt: 'main alt',
      imageAfterUrl: null,
      imageAfterAlt: null,
      orderIndex: 0,
    });
  });

  it('resolves both image_id and image_after_id when the row is a before/after pair', async () => {
    vi.mocked(getProjectMediaByProject).mockResolvedValueOnce([
      makeMedia({ image_after_id: 'img-2' }),
    ]);
    vi.mocked(getImageById)
      .mockResolvedValueOnce(makeImage('img-1', 'projects/p1/before.jpg', 'before'))
      .mockResolvedValueOnce(makeImage('img-2', 'projects/p1/after.jpg', 'after'));
    vi.mocked(getImageUrl)
      .mockResolvedValueOnce('https://signed.example/before')
      .mockResolvedValueOnce('https://signed.example/after');

    const result = await loadPublicProjectMedia('p1');

    expect(result[0].imageUrl).toBe('https://signed.example/before');
    expect(result[0].imageAfterUrl).toBe('https://signed.example/after');
    expect(result[0].imageAlt).toBe('before');
    expect(result[0].imageAfterAlt).toBe('after');
  });

  it('preserves DB ordering across multiple rows', async () => {
    vi.mocked(getProjectMediaByProject).mockResolvedValueOnce([
      makeMedia({ id: 'm1', order_index: 0 }),
      makeMedia({ id: 'm2', order_index: 1, image_id: 'img-2' }),
    ]);
    vi.mocked(getImageById)
      .mockResolvedValueOnce(makeImage('img-1', 'projects/p1/m1.jpg'))
      .mockResolvedValueOnce(makeImage('img-2', 'projects/p1/m2.jpg'));
    vi.mocked(getImageUrl)
      .mockResolvedValueOnce('https://signed.example/m1')
      .mockResolvedValueOnce('https://signed.example/m2');

    const result = await loadPublicProjectMedia('p1');

    expect(result.map((item) => item.id)).toEqual(['m1', 'm2']);
  });
});

describe('loadPublicProjectMedia — failure isolation', () => {
  it('nulls only the failing item URL when one image lookup throws', async () => {
    vi.mocked(getProjectMediaByProject).mockResolvedValueOnce([
      makeMedia({ id: 'm1', image_id: 'good' }),
      makeMedia({ id: 'm2', image_id: 'broken' }),
    ]);
    vi.mocked(getImageById)
      .mockResolvedValueOnce(makeImage('good', 'projects/p1/m1.jpg', 'main'))
      .mockRejectedValueOnce(new Error('storage down'));
    vi.mocked(getImageUrl).mockResolvedValueOnce('https://signed.example/m1');

    const result = await loadPublicProjectMedia('p1');

    expect(result).toHaveLength(2);
    expect(result[0].imageUrl).toBe('https://signed.example/m1');
    expect(result[1].imageUrl).toBeNull();
    expect(result[1].imageAlt).toBe('');
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('nulls only image_after_url when the after-image lookup fails but the primary succeeds', async () => {
    vi.mocked(getProjectMediaByProject).mockResolvedValueOnce([
      makeMedia({ image_after_id: 'broken-after' }),
    ]);
    vi.mocked(getImageById)
      .mockResolvedValueOnce(makeImage('img-1', 'projects/p1/before.jpg', 'before'))
      .mockRejectedValueOnce(new Error('storage down'));
    vi.mocked(getImageUrl).mockResolvedValueOnce('https://signed.example/before');

    const result = await loadPublicProjectMedia('p1');

    expect(result[0].imageUrl).toBe('https://signed.example/before');
    expect(result[0].imageAfterUrl).toBeNull();
    expect(result[0].imageAfterAlt).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('nulls the URL (does not throw) when the image record is missing', async () => {
    vi.mocked(getProjectMediaByProject).mockResolvedValueOnce([
      makeMedia({ image_id: 'gone' }),
    ]);
    vi.mocked(getImageById).mockResolvedValueOnce(null);

    const result = await loadPublicProjectMedia('p1');

    expect(result[0].imageUrl).toBeNull();
    expect(result[0].imageAlt).toBe('');
  });

  it('propagates the underlying ServiceError when the project_media query itself fails', async () => {
    vi.mocked(getProjectMediaByProject).mockRejectedValueOnce(
      new ServiceError('boom', {
        operation: 'getProjectMediaByProject',
        cause: new Error('db'),
      }),
    );
    await expect(loadPublicProjectMedia('p1')).rejects.toBeInstanceOf(ServiceError);
  });
});
