import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getImageUrl } from '@/lib/images';
import { ServiceError } from '@/lib/errors';

/**
 * Build a stub Supabase client whose `.storage.from(bucket).getPublicUrl(path)`
 * returns the given `{ data }` payload.
 *
 * `getPublicUrl` is synchronous in supabase-js and has no error channel: the
 * `images` bucket is public as of migration 017, so resolving a path is pure
 * string construction with nothing to fail.
 */
function makeStorageStub(result: { data: { publicUrl: string } | null }): SupabaseClient {
  return {
    storage: {
      from: () => ({
        getPublicUrl: () => result,
      }),
    },
  } as unknown as SupabaseClient;
}

describe('getImageUrl', () => {
  it('returns a public URL for a known path', async () => {
    const stub = makeStorageStub({
      data: { publicUrl: 'https://example.supabase.co/storage/v1/object/public/images/abc' },
    });
    const url = await getImageUrl('projects/p1/abc_photo.jpg', stub);
    expect(url).toBe('https://example.supabase.co/storage/v1/object/public/images/abc');
  });

  it('returns a URL with no expiry token', async () => {
    const stub = makeStorageStub({
      data: { publicUrl: 'https://example.supabase.co/storage/v1/object/public/images/abc' },
    });
    const url = await getImageUrl('projects/p1/abc_photo.jpg', stub);
    expect(url).not.toContain('token=');
  });

  it('throws when path is empty', async () => {
    const stub = makeStorageStub({ data: { publicUrl: 'unused' } });
    await expect(getImageUrl('', stub)).rejects.toBeInstanceOf(ServiceError);
  });

  it('throws when the SDK returns no URL', async () => {
    const stub = makeStorageStub({ data: null });
    await expect(getImageUrl('projects/p1/abc.jpg', stub)).rejects.toBeInstanceOf(ServiceError);
  });
});
