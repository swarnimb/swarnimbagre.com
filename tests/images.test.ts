import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getImageUrl } from '@/lib/images';
import { ServiceError } from '@/lib/errors';

/**
 * Build a stub Supabase client whose `.storage.from(bucket).createSignedUrl(path, ttl)`
 * resolves with the given `{ data, error }` payload.
 */
function makeStorageStub(result: {
  data: { signedUrl: string } | null;
  error: { message: string } | null;
}): SupabaseClient {
  return {
    storage: {
      from: () => ({
        createSignedUrl: () => Promise.resolve(result),
      }),
    },
  } as unknown as SupabaseClient;
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn> | undefined;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy?.mockRestore();
});

describe('getImageUrl', () => {
  it('returns a valid URL for a known path', async () => {
    const stub = makeStorageStub({
      data: { signedUrl: 'https://example.supabase.co/signed/abc' },
      error: null,
    });
    const url = await getImageUrl('projects/p1/abc_photo.jpg', stub);
    expect(url).toBe('https://example.supabase.co/signed/abc');
  });

  it('throws when path is empty', async () => {
    const stub = makeStorageStub({
      data: { signedUrl: 'unused' },
      error: null,
    });
    await expect(getImageUrl('', stub)).rejects.toBeInstanceOf(ServiceError);
  });
});
