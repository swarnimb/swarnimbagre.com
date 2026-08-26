import { getImageById, getProjectMediaByProject } from './db';
import { getImageUrl } from './images';
import type { ProjectMedia, PublicProjectMediaItem } from './types';

/**
 * Fetch every media row for a project and pre-resolve their signed Storage
 * URLs into the render-ready `PublicProjectMediaItem` shape.
 *
 * Per-item failure isolation: a single bad image lookup nulls only that
 * item's URL(s) — the surrounding item still renders with the resolvable
 * fields, and the remaining items in the carousel are untouched. Pattern
 * mirrors `resolveImageUrl` in `lib/public-projects.ts`.
 *
 * Boundary discipline (CONSTRAINT-14): this function does NOT wrap its
 * query in `safeLoad`. `safeLoad` is page-level Server-Component-only.
 * Calling pages should put `loadPublicProjectMedia` (or its caller
 * `loadPublicProjects`) inside a `safeLoad` block so the page can degrade
 * to an empty carousel when the whole media query fails.
 *
 * @param projectId The owning project id.
 * @returns         Ordered (by `order_index` ASC) array of render-ready
 *                  media items. Empty array if the project has no media
 *                  rows — the function does NOT throw on empty.
 * @throws          ServiceError when the underlying `getProjectMediaByProject`
 *                  query fails. Caller is expected to let this propagate to
 *                  the page-level `safeLoad` boundary.
 */
export async function loadPublicProjectMedia(
  projectId: string,
): Promise<PublicProjectMediaItem[]> {
  const rows = await getProjectMediaByProject(projectId);
  return Promise.all(rows.map(toPublicMediaItem));
}

/**
 * Convert a raw `ProjectMedia` row into a `PublicProjectMediaItem` with both
 * the primary image and the optional after-image resolved in parallel.
 *
 * @param row The DB row.
 */
async function toPublicMediaItem(row: ProjectMedia): Promise<PublicProjectMediaItem> {
  const [primary, after] = await Promise.all([
    resolveMediaImage(row.image_id),
    resolveMediaImage(row.image_after_id),
  ]);
  return {
    id: row.id,
    imageUrl: primary.url,
    imageAlt: primary.alt ?? '',
    imageAfterUrl: after.url,
    imageAfterAlt: after.alt,
    orderIndex: row.order_index,
  };
}

/**
 * Resolve a single image id (within a `project_media` row) to a public URL
 * and its alt text. Returns `{ url: null, alt: null }` when the column is
 * unset or the image record is missing. URL construction itself cannot fail
 * at runtime now that the bucket is public (migration 017), so genuine
 * failures propagate instead of being swallowed.
 *
 * @param imageId    The image record id, or null when the column is unset.
 */
async function resolveMediaImage(
  imageId: string | null,
): Promise<{ url: string | null; alt: string | null }> {
  if (!imageId) return { url: null, alt: null };
  const record = await getImageById(imageId);
  if (!record) return { url: null, alt: null };
  return { url: await getImageUrl(record.bucket_path), alt: record.alt_text };
}
