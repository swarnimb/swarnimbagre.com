import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from './supabase';
import { ServiceError } from './errors';

/** Storage bucket holding all images. */
const IMAGES_BUCKET = 'images';

/**
 * Resolve a Supabase Storage bucket path to a public, permanent URL.
 *
 * The `images` bucket is public as of migration 017, so this is a pure string
 * build with no network call and nothing to retry. Callers that used to guard
 * against transient signing failures no longer need to.
 *
 * Throws only on an empty path, which is a programming error rather than a
 * runtime condition.
 *
 * @param bucketPath Path within the `images` bucket. Must be non-empty.
 * @param client     Optional injected client (for tests). Defaults to a
 *                   request-scoped server client.
 * @returns A public URL with no expiry.
 * @throws  ServiceError if `bucketPath` is empty or the SDK returns no URL.
 */
export async function getImageUrl(
  bucketPath: string,
  client?: SupabaseClient,
): Promise<string> {
  const operation = 'getImageUrl';
  if (typeof bucketPath !== 'string' || bucketPath.length === 0) {
    throw new ServiceError(`${operation}: bucketPath must be a non-empty string`, {
      operation,
      cause: new Error(`got: ${typeof bucketPath} (length=${typeof bucketPath === 'string' ? bucketPath.length : 'n/a'})`),
    });
  }
  const supabase = client ?? (await createServerClient());
  const { data } = supabase.storage.from(IMAGES_BUCKET).getPublicUrl(bucketPath);
  if (!data?.publicUrl) {
    throw new ServiceError(`${operation} failed`, {
      operation,
      cause: new Error('no publicUrl returned'),
    });
  }
  return data.publicUrl;
}
