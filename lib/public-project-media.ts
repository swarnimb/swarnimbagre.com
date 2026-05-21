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
    resolveMediaImage(row.image_id, row.project_id, row.id, 'image_id'),
    resolveMediaImage(row.image_after_id, row.project_id, row.id, 'image_after_id'),
  ]);
  return {
    id: row.id,
    imageUrl: primary.url,
    imageAlt: primary.alt ?? '',
    imageAfterUrl: after.url,
    imageAfterAlt: after.alt,
    caption: row.caption,
    orderIndex: row.order_index,
  };
}

/**
 * Resolve a single image id (within a `project_media` row) to a signed URL
 * and its alt text. Returns `{ url: null, alt: null }` on any lookup or
 * signing failure so a single bad image cannot fail the surrounding item or
 * any other item in the carousel.
 *
 * @param imageId    The image record id, or null when the column is unset.
 * @param projectId  The owning project id — used only as log context.
 * @param mediaId    The owning media row id — used only as log context.
 * @param columnName Which column is being resolved — used only as log context.
 */
async function resolveMediaImage(
  imageId: string | null,
  projectId: string,
  mediaId: string,
  columnName: 'image_id' | 'image_after_id',
): Promise<{ url: string | null; alt: string | null }> {
  if (!imageId) return { url: null, alt: null };
  try {
    const record = await getImageById(imageId);
    if (!record) return { url: null, alt: null };
    const url = await getImageUrl(record.bucket_path);
    return { url, alt: record.alt_text };
  } catch (error) {
    console.error('[public-project-media] image url resolution failed', {
      operation: 'resolveMediaImage',
      projectId,
      mediaId,
      columnName,
      imageId,
      errorMessage: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return { url: null, alt: null };
  }
}
