import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from './supabase';
import { ServiceError } from './errors';

/** Storage bucket holding all images. */
const IMAGES_BUCKET = 'images';

/** Signed URL lifetime in seconds. 1 hour balances render flexibility and leak window. */
const SIGNED_URL_TTL_SECONDS = 3600;

/**
 * Resolve a Supabase Storage bucket path to a time-limited signed URL.
 *
 * Throws on empty path and on any storage error. Callers in Server Components
 * should let the throw propagate to the page-level `safeLoad` boundary, or
 * catch locally if the component is meant to degrade silently.
 *
 * @param bucketPath Path within the `images` bucket. Must be non-empty.
 * @param client     Optional injected client (for tests). Defaults to a
 *                   request-scoped server client.
 * @returns A signed URL valid for `SIGNED_URL_TTL_SECONDS`.
 * @throws  ServiceError if `bucketPath` is empty or storage fails.
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
  const { data, error } = await supabase.storage
    .from(IMAGES_BUCKET)
    .createSignedUrl(bucketPath, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    console.error(`[storage] ${operation} failed`, {
      operation,
      bucketPath,
      errorMessage: error?.message ?? 'no signedUrl returned',
      stack: new Error().stack,
    });
    throw new ServiceError(`${operation} failed`, {
      operation,
      cause: error ?? new Error('no signedUrl returned'),
    });
  }
  return data.signedUrl;
}
