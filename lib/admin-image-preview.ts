import { getImageById } from '@/lib/db';
import { getImageUrl } from '@/lib/images';

/**
 * Shape passed to the admin edit forms (`ProjectForm` / `PostForm`) for the
 * existing-image preview. `null` when the parent row has no `image_id` or
 * the referenced image row was orphaned (deleted out from under the FK).
 */
export type CurrentImage = {
  id: string;
  signedUrl: string;
  altText: string;
} | null;

/**
 * Resolve a parent row's `image_id` to a signed-URL preview payload.
 *
 * CONSTRAINT-15: reads go through `getImageUrl` (signed URL, TTL 3600s) —
 * the `images` bucket is private and `getPublicUrl` would return 404.
 * Throws bubble loudly per the admin-loud carve-out from CONSTRAINT-14.
 *
 * Extracted (CQ-07) from byte-identical copies previously inlined in the
 * `/admin/projects/[id]` and `/admin/posts/[id]` page server components.
 *
 * @param imageId The parent row's `image_id`, or `null` when it has no image.
 * @returns A {@link CurrentImage}: the resolved `{ id, signedUrl, altText }`
 *          payload, or `null` when `imageId` is `null` or no image row exists
 *          for it (orphaned FK).
 * @throws Propagates any error from `getImageById` or `getImageUrl`
 *         (DB failure, storage signing failure) — deliberately not caught so
 *         it surfaces in the Next error overlay for the admin operator.
 */
export async function loadCurrentImage(
  imageId: string | null,
): Promise<CurrentImage> {
  if (imageId === null) return null;
  const record = await getImageById(imageId);
  if (record === null) return null;
  const signedUrl = await getImageUrl(record.bucket_path);
  return { id: record.id, signedUrl, altText: record.alt_text };
}
