import { getImageById, getPublishedProjects } from './db';
import { getImageUrl } from './images';
import type { Project } from './types';

/**
 * Public-render-ready project shape.
 *
 * Built from a `Project` row plus pre-resolved signed Storage URLs for the
 * primary and after images. Pages call `loadPublicProjects` from inside a
 * `safeLoad` block; the result is passed straight to client-side card
 * components (`ProjectRow`, `ProjectCard`) without any further DB or
 * Storage access.
 *
 * Introduced in T42 Session B.
 */
export interface PublicProject {
  id: string;
  title: string;
  slug: string;
  description: string;
  thumbKind: string | null;
  progressPercent: number | null;
  githubUrl: string | null;
  liveUrl: string | null;
  postUrl: string | null;
  imageUrl: string | null;
  imageAfterUrl: string | null;
}

/**
 * Fetch all published projects and pre-resolve their image URLs for the
 * public render surface.
 *
 * Image resolution failures are isolated per-row: a failed URL becomes
 * `null` and is logged, but the row still renders (without the image).
 * The function as a whole throws only on the underlying `getPublishedProjects`
 * failure — that error is caught at the page-level `safeLoad` boundary.
 *
 * @returns Array of render-ready projects in DB order (newest first).
 * @throws  ServiceError when the underlying project query fails.
 */
export async function loadPublicProjects(): Promise<PublicProject[]> {
  const rows = await getPublishedProjects();
  return Promise.all(rows.map(toPublicProject));
}

/**
 * Convert a raw `Project` row to a `PublicProject` with image URLs resolved.
 *
 * @param row The DB row.
 */
async function toPublicProject(row: Project): Promise<PublicProject> {
  const [imageUrl, imageAfterUrl] = await Promise.all([
    resolveImageUrl(row.image_id, row.id, 'image_id'),
    resolveImageUrl(row.image_after_id, row.id, 'image_after_id'),
  ]);
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    thumbKind: row.thumb_kind,
    progressPercent: row.progress_percent,
    githubUrl: row.github_url,
    liveUrl: row.live_url,
    postUrl: row.post_url,
    imageUrl,
    imageAfterUrl,
  };
}

/**
 * Resolve an image id to a signed URL. Returns `null` (and logs) on any
 * lookup or signing failure so a single missing image cannot fail the
 * whole project list render.
 *
 * @param imageId      The image record id, or null.
 * @param projectId    The owning project id, used only for log context.
 * @param columnName   The column being resolved, used only for log context.
 */
async function resolveImageUrl(
  imageId: string | null,
  projectId: string,
  columnName: 'image_id' | 'image_after_id',
): Promise<string | null> {
  if (!imageId) return null;
  try {
    const record = await getImageById(imageId);
    if (!record) return null;
    return await getImageUrl(record.bucket_path);
  } catch (error) {
    console.error('[public-projects] image url resolution failed', {
      operation: 'resolveImageUrl',
      projectId,
      columnName,
      imageId,
      errorMessage: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return null;
  }
}
