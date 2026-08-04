import { getImageById, getPublishedProjects } from './db';
import { getImageUrl } from './images';
import { loadPublicProjectMedia } from './public-project-media';
import type { Project, PublicProjectMediaItem } from './types';

/**
 * Public-render-ready project shape.
 *
 * Built from a `Project` row plus pre-resolved signed Storage URLs for the
 * primary and after images. Pages call `loadPublicProjects` from inside a
 * `safeLoad` block; the result is passed straight to client-side card
 * components (`ProjectRow`, `ProjectCard`) without any further DB or
 * Storage access.
 *
 * Introduced in T42 Session B. Extended in T43.D (2026-05-20) with the
 * `media` field — the carousel-ready rows from `public.project_media`.
 * `imageUrl` / `imageAfterUrl` are retained as a fallback for projects that
 * have not yet been migrated to media rows.
 */
export interface PublicProject {
  id: string;
  title: string;
  slug: string;
  description: string;
  /** One-line subtitle under the card title (T46). Null falls back to a placeholder. */
  subtitle: string | null;
  /** Tag pills on the card (T46). Null or empty renders no tag row. */
  tags: string[] | null;
  /**
   * @deprecated since T46 — the redesigned card renders photographic media
   * only, so the SVG motif set (S49) is no longer drawn anywhere. The column
   * is retained rather than dropped so historical values survive if the
   * decision is revisited.
   */
  thumbKind: string | null;
  progressPercent: number | null;
  githubUrl: string | null;
  liveUrl: string | null;
  postUrl: string | null;
  /**
   * FK to an attached writing post (`post_id`), or null when the project is
   * not linked to a post. Used by the `/projects` list to decide whether a
   * card's title links to its detail page (Override 3, T45.D).
   */
  postId: string | null;
  imageUrl: string | null;
  imageAfterUrl: string | null;
  /**
   * Carousel-ready media rows ordered by `order_index` ASC. Empty array when
   * the project has zero `project_media` rows — in that case the render
   * surface falls back to `imageUrl` / `imageAfterUrl` above (T43.D).
   */
  media: PublicProjectMediaItem[];
}

/**
 * Fetch all published projects and pre-resolve their image URLs and media
 * carousel rows for the public render surface.
 *
 * Image resolution failures are isolated per-row: a failed URL becomes
 * `null` and is logged, but the row still renders (without the image).
 * Media-query failures are isolated per-project: a failed media query
 * returns `[]` for that project's `media` field (and is logged) so a single
 * project's media issue cannot fail the whole list render.
 *
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
 * Convert a raw `Project` row to a `PublicProject` with image URLs and media
 * rows resolved.
 *
 * @param row The DB row.
 */
async function toPublicProject(row: Project): Promise<PublicProject> {
  const [imageUrl, imageAfterUrl, media] = await Promise.all([
    resolveImageUrl(row.image_id, row.id, 'image_id'),
    resolveImageUrl(row.image_after_id, row.id, 'image_after_id'),
    loadProjectMediaSafe(row.id),
  ]);
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    subtitle: row.subtitle,
    tags: row.tags,
    thumbKind: row.thumb_kind,
    progressPercent: row.progress_percent,
    githubUrl: row.github_url,
    liveUrl: row.live_url,
    postUrl: row.post_url,
    postId: row.post_id,
    imageUrl,
    imageAfterUrl,
    media,
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

/**
 * Load a project's media rows with per-project failure isolation. A failed
 * media query returns `[]` (and is logged) so a single project's media issue
 * cannot fail the whole list render. Mirrors `resolveImageUrl`'s per-item
 * isolation pattern at the project granularity (T43.D).
 *
 * @param projectId The owning project id, used both as the query argument
 *                  and as log context.
 */
async function loadProjectMediaSafe(projectId: string): Promise<PublicProjectMediaItem[]> {
  try {
    return await loadPublicProjectMedia(projectId);
  } catch (error) {
    console.error('[public-projects] project media load failed', {
      operation: 'loadProjectMediaSafe',
      projectId,
      errorMessage: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return [];
  }
}
