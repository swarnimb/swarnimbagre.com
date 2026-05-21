import { describe, it, expect, vi, afterEach } from 'vitest';
import { loadAdminProjectMedia } from '@/lib/admin-project-media-preview';
import { ServiceError } from '@/lib/errors';
import type { ProjectMedia, ImageRecord } from '@/lib/types';

vi.mock('@/lib/admin-queries-project-media', () => ({
  getProjectMediaByProjectAdmin: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  getImageById: vi.fn(),
}));

vi.mock('@/lib/images', () => ({
  getImageUrl: vi.fn(),
}));

const { getProjectMediaByProjectAdmin } = await import('@/lib/admin-queries-project-media');
const { getImageById } = await import('@/lib/db');
const { getImageUrl } = await import('@/lib/images');

afterEach(() => {
  vi.resetAllMocks();
});

// Synthetic, zero-padded placeholder UUIDs (hex-only suffixes).
const PROJECT_ID = '00000000-0000-4000-8000-0000000000a1';
const MEDIA_1 = '00000000-0000-4000-8000-0000000000b1';
const MEDIA_2 = '00000000-0000-4000-8000-0000000000b2';
const IMG_1 = '00000000-0000-4000-8000-0000000000c1';
const IMG_2 = '00000000-0000-4000-8000-0000000000c2';
const IMG_ORPHAN = '00000000-0000-4000-8000-0000000000c9';

/** Build a `ProjectMedia` row with overrides on top of sensible defaults. */
function makeMedia(overrides: Partial<ProjectMedia> = {}): ProjectMedia {
  return {
    id: MEDIA_1,
    project_id: PROJECT_ID,
    image_id: IMG_1,
    image_after_id: null,
    caption: null,
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

describe('loadAdminProjectMedia — happy path', () => {
  it('resolves rows to admin shape with previews for a single-image row', async () => {
    vi.mocked(getProjectMediaByProjectAdmin).mockResolvedValueOnce([
      makeMedia({ caption: 'A caption' }),
    ]);
    vi.mocked(getImageById).mockResolvedValueOnce(
      makeImage(IMG_1, 'projects/a1/b1.jpg', 'main alt'),
    );
    vi.mocked(getImageUrl).mockResolvedValueOnce('https://signed.example/b1');

    const result = await loadAdminProjectMedia(PROJECT_ID);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: MEDIA_1,
      image_id: IMG_1,
      imagePreview: { signedUrl: 'https://signed.example/b1', altText: 'main alt' },
      image_after_id: null,
      imageAfterPreview: null,
      caption: 'A caption',
    });
  });

  it('resolves both previews for a before/after pair row', async () => {
    vi.mocked(getProjectMediaByProjectAdmin).mockResolvedValueOnce([
      makeMedia({ image_after_id: IMG_2 }),
    ]);
    vi.mocked(getImageById)
      .mockResolvedValueOnce(makeImage(IMG_1, 'projects/a1/before.jpg', 'before'))
      .mockResolvedValueOnce(makeImage(IMG_2, 'projects/a1/after.jpg', 'after'));
    vi.mocked(getImageUrl)
      .mockResolvedValueOnce('https://signed.example/before')
      .mockResolvedValueOnce('https://signed.example/after');

    const result = await loadAdminProjectMedia(PROJECT_ID);

    expect(result[0].imagePreview).toEqual({
      signedUrl: 'https://signed.example/before',
      altText: 'before',
    });
    expect(result[0].imageAfterPreview).toEqual({
      signedUrl: 'https://signed.example/after',
      altText: 'after',
    });
  });

  it('returns an empty array when the project has no media rows', async () => {
    vi.mocked(getProjectMediaByProjectAdmin).mockResolvedValueOnce([]);
    const result = await loadAdminProjectMedia(PROJECT_ID);
    expect(result).toEqual([]);
  });

  it('preserves row order from the underlying query', async () => {
    vi.mocked(getProjectMediaByProjectAdmin).mockResolvedValueOnce([
      makeMedia({ id: MEDIA_1, order_index: 0 }),
      makeMedia({ id: MEDIA_2, order_index: 1, image_id: IMG_2 }),
    ]);
    vi.mocked(getImageById)
      .mockResolvedValueOnce(makeImage(IMG_1, 'projects/a1/b1.jpg'))
      .mockResolvedValueOnce(makeImage(IMG_2, 'projects/a1/b2.jpg'));
    vi.mocked(getImageUrl)
      .mockResolvedValueOnce('https://signed.example/b1')
      .mockResolvedValueOnce('https://signed.example/b2');

    const result = await loadAdminProjectMedia(PROJECT_ID);

    expect(result.map((item) => item.id)).toEqual([MEDIA_1, MEDIA_2]);
  });
});

describe('loadAdminProjectMedia — error and edge cases', () => {
  it('returns a null preview when the image FK is orphaned', async () => {
    vi.mocked(getProjectMediaByProjectAdmin).mockResolvedValueOnce([
      makeMedia({ image_id: IMG_ORPHAN }),
    ]);
    vi.mocked(getImageById).mockResolvedValueOnce(null);

    const result = await loadAdminProjectMedia(PROJECT_ID);

    expect(result).toHaveLength(1);
    expect(result[0].imagePreview).toBeNull();
  });

  it('propagates a database error from the media query', async () => {
    vi.mocked(getProjectMediaByProjectAdmin).mockRejectedValueOnce(
      new ServiceError('boom', {
        operation: 'getProjectMediaByProjectAdmin',
        cause: new Error('db'),
      }),
    );
    await expect(loadAdminProjectMedia(PROJECT_ID)).rejects.toBeInstanceOf(ServiceError);
  });
});
