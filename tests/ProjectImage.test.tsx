import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ProjectImage } from '@/components/public/ProjectImage';

vi.mock('@/lib/db', () => ({
  getImageById: vi.fn(),
}));

vi.mock('@/lib/images', () => ({
  getImageUrl: vi.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getImageById } = await import('@/lib/db');
const { getImageUrl } = await import('@/lib/images');

let consoleErrorSpy: ReturnType<typeof vi.spyOn> | undefined;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  consoleErrorSpy?.mockRestore();
});

describe('ProjectImage', () => {
  it('renders <img> with alt when imageId resolves', async () => {
    vi.mocked(getImageById).mockResolvedValueOnce({
      id: 'img-1',
      bucket_path: 'projects/p1/abc.jpg',
      alt_text: 'unused',
      parent_id: 'p1',
      parent_type: 'projects',
      created_at: '2026-01-01T00:00:00.000Z',
    });
    vi.mocked(getImageUrl).mockResolvedValueOnce(
      'https://example.supabase.co/signed/abc',
    );

    const element = await ProjectImage({ imageId: 'img-1', alt: 'demo alt' });
    render(element as React.ReactElement);

    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('alt', 'demo alt');
    expect(img).toHaveAttribute('src', 'https://example.supabase.co/signed/abc');
    expect(img).toHaveAttribute('loading', 'lazy');
  });

  it('renders nothing when imageId is undefined', async () => {
    const element = await ProjectImage({ imageId: undefined, alt: 'demo alt' });
    expect(element).toBeNull();
  });
});
