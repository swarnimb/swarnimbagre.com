import { getImageById } from '@/lib/db';
import { getImageUrl } from '@/lib/images';
import { getProjectMediaByProjectAdmin } from '@/lib/admin-queries-project-media';
import type { ProjectMedia } from '@/lib/types';

/**
 * Resolved image preview attached to a single admin media row. `null` when
 * the column was unset (legitimate for `image_after_id` on a single-row
 * media item) or when the referenced image row was orphaned out from under
 * the FK (rare; the row stays visible so the operator can fix it).
 */
export type AdminMediaPreview = { signedUrl: string; altText: string } | null;

/**
 * Shape passed to `ProjectMediaField` for an existing media row. Mirrors
 * the admin-side projection of `project_media` plus pre-resolved signed
 * URLs for each image FK. The wire payload submitted to `saveProjectMedia`
 * carries only `{ image_id, image_after_id }` per row — preview fields are
 * local-only.
 */
export interface AdminProjectMediaRow {
  /** `project_media` row id. Stable identity — the form uses it as the
   *  React key + DOM-id base for loaded rows so SSR and client hydration
   *  agree (a freshly minted UUID would differ between the two passes). */
  id: string;
  /** Owning image FK. Always present — `project_media.image_id` is NOT NULL. */
  image_id: string;
  /** Pre-resolved signed URL + alt for the primary image. Null only when
   *  the image row was orphaned (FK survived a deletion). */
  imagePreview: AdminMediaPreview;
  /** Optional before/after FK. Null for single-row media items. */
  image_after_id: string | null;
  /** Pre-resolved signed URL + alt for the after image. */
  imageAfterPreview: AdminMediaPreview;
}

/**
 * Resolve every media row attached to a project to render-ready admin rows.
 *
 * Mirrors `loadCurrentImage` in `lib/admin-image-preview.ts` and the
 * public-side `loadPublicProjectMedia` pattern: admin queries use the
 * authenticated server client (RLS-enforced via `project_media_admin_all`),
 * and DB / signing errors bubble per CONSTRAINT-14's admin-loud carve-out.
 * Orphaned image FKs degrade to `null` preview (the row stays visible so
 * the operator can swap the image) — they are not a throwable condition.
 *
 * Order matches the underlying query (`order_index` ASC).
 *
 * @param projectId Owning project UUID.
 * @returns Ordered admin rows. Empty array when the project has no media.
 * @throws  ServiceError on DB query failure (bubbled).
 */
export async function loadAdminProjectMedia(
  projectId: string,
): Promise<AdminProjectMediaRow[]> {
  const rows = await getProjectMediaByProjectAdmin(projectId);
  return Promise.all(rows.map(toAdminRow));
}

/**
 * Resolve both image FKs on one row in parallel and package into the admin
 * row shape. FKs pass through verbatim.
 */
async function toAdminRow(row: ProjectMedia): Promise<AdminProjectMediaRow> {
  const [imagePreview, imageAfterPreview] = await Promise.all([
    resolvePreview(row.image_id),
    resolvePreview(row.image_after_id),
  ]);
  return {
    id: row.id,
    image_id: row.image_id,
    image_after_id: row.image_after_id,
    imagePreview,
    imageAfterPreview,
  };
}

/**
 * Resolve one image id to its signed URL + alt. Returns null when the id
 * is null OR the image row no longer exists (orphaned FK — the row is
 * still rendered so the operator can pick a replacement). DB / signing
 * errors are NOT caught — they bubble per CONSTRAINT-14 (admin-loud).
 */
async function resolvePreview(
  imageId: string | null,
): Promise<AdminMediaPreview> {
  if (imageId === null) return null;
  const record = await getImageById(imageId);
  if (record === null) return null;
  const signedUrl = await getImageUrl(record.bucket_path);
  return { signedUrl, altText: record.alt_text };
}
