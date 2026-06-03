import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from './supabase';
import { ServiceError } from './errors';
import { PUBLISHED, assertSlug, logDbError } from './db-internal';
import type { Project, Stat, ImageRecord, ProjectMedia } from './types';

/**
 * Public read-query layer.
 *
 * The post read loaders (`getPublishedPosts`, `getPostBySlug`,
 * `getPublishedPostById`) were split out into `lib/db-posts.ts` under CQ-02
 * (services < 300 lines) and are re-exported below so existing callers
 * importing them from `@/lib/db` keep working unchanged. Shared helpers and
 * constants (`PUBLISHED`, `assertSlug`, `logDbError`) live in
 * `lib/db-internal.ts`, imported by both this module and `db-posts.ts` to
 * avoid a circular import.
 */

export {
  getPublishedPosts,
  getPostBySlug,
  getPublishedPostById,
} from './db-posts';

/**
 * Column projection for project list and detail queries.
 *
 * Extended in T42 Session B to include the 6 nullable content-model columns
 * added by migration 009 (`github_url`, `live_url`, `post_url`,
 * `progress_percent`, `thumb_kind`, `image_after_id`). Public render
 * (`ProjectRow`, `ProjectMedia`) reads these directly off the row.
 */
const PROJECT_COLUMNS =
  'id, title, slug, description, status, image_id, created_at, updated_at, ' +
  'github_url, live_url, post_url, progress_percent, thumb_kind, image_after_id';

/** Column projection for stat queries. */
const STAT_COLUMNS = 'id, category, label, value, unit, created_at';

/** Column projection for image queries. */
const IMAGE_COLUMNS = 'id, bucket_path, alt_text, parent_id, parent_type, created_at';

/**
 * Column projection for `project_media` queries (T43.D).
 *
 * Snake-case mirror of the migration 010 row shape. Kept identical to the
 * admin-side projection in `lib/admin-queries-project-media.ts` so a single
 * `as ProjectMedia[]` cast on either side is a structural identity.
 */
const PROJECT_MEDIA_COLUMNS =
  'id, project_id, image_id, image_after_id, caption, order_index, created_at';

/**
 * Fetch all published projects, newest first.
 *
 * @param client Optional injected client (for tests). Defaults to a
 *               request-scoped server client.
 * @returns Array of projects, empty array if none.
 * @throws  ServiceError on any database error.
 */
export async function getPublishedProjects(client?: SupabaseClient): Promise<Project[]> {
  const operation = 'getPublishedProjects';
  const supabase = client ?? (await createServerClient());
  const { data, error } = await supabase
    .from('projects')
    .select(PROJECT_COLUMNS)
    .eq('status', PUBLISHED)
    .order('created_at', { ascending: false });
  if (error) {
    logDbError(operation, error);
    throw new ServiceError(`${operation} failed`, { cause: error, operation });
  }
  // Cast via `unknown` because the SDK's inferred type for a wider SELECT
  // string (T42 added 6 columns) no longer narrows to a row shape that
  // overlaps with `Project`. The runtime contract is the SQL projection.
  return (data ?? []) as unknown as Project[];
}

/**
 * Fetch a single published project by slug.
 *
 * @param slug   URL slug. Must be a non-empty string.
 * @param client Optional injected client (for tests).
 * @returns The matching project, or `null` if not found.
 * @throws  ServiceError on invalid input or database error.
 */
export async function getProjectBySlug(
  slug: string,
  client?: SupabaseClient,
): Promise<Project | null> {
  const operation = 'getProjectBySlug';
  assertSlug(slug, operation);
  const supabase = client ?? (await createServerClient());
  const { data, error } = await supabase
    .from('projects')
    .select(PROJECT_COLUMNS)
    .eq('status', PUBLISHED)
    .eq('slug', slug)
    .maybeSingle();
  if (error) {
    logDbError(operation, error);
    throw new ServiceError(`${operation} failed`, { cause: error, operation });
  }
  return (data ?? null) as Project | null;
}

/**
 * Fetch all stats and group them by category.
 *
 * Categories are open-ended (LLM-driven), so grouping happens in JS rather
 * than via a hardcoded category list in SQL. Within each category, newest
 * stats come first.
 *
 * @param client Optional injected client (for tests).
 * @returns Map of category -> ordered stat array. Empty object if no rows.
 * @throws  ServiceError on any database error.
 */
export async function getStatsByCategory(
  client?: SupabaseClient,
): Promise<Record<string, Stat[]>> {
  const operation = 'getStatsByCategory';
  const supabase = client ?? (await createServerClient());
  const { data, error } = await supabase
    .from('stats')
    .select(STAT_COLUMNS)
    .order('category', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) {
    logDbError(operation, error);
    throw new ServiceError(`${operation} failed`, { cause: error, operation });
  }
  const grouped: Record<string, Stat[]> = {};
  for (const row of (data ?? []) as Stat[]) {
    if (!grouped[row.category]) grouped[row.category] = [];
    grouped[row.category].push(row);
  }
  return grouped;
}

/**
 * Fetch a single image record by id.
 *
 * @param id     Image UUID. Must be a non-empty string.
 * @param client Optional injected client (for tests).
 * @returns The matching image, or `null` if not found.
 * @throws  ServiceError on invalid input or database error.
 */
export async function getImageById(
  id: string,
  client?: SupabaseClient,
): Promise<ImageRecord | null> {
  const operation = 'getImageById';
  if (typeof id !== 'string' || id.length === 0) {
    throw new ServiceError('invalid id argument', {
      operation,
      cause: new Error(`id must be a non-empty string, got: ${typeof id}`),
    });
  }
  const supabase = client ?? (await createServerClient());
  const { data, error } = await supabase
    .from('images')
    .select(IMAGE_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) {
    logDbError(operation, error);
    throw new ServiceError(`${operation} failed`, { cause: error, operation });
  }
  return (data ?? null) as ImageRecord | null;
}

/**
 * Fetch every `project_media` row for a project, ordered by `order_index` ASC.
 *
 * Public read surface — `status='published'` is NOT applied: the project's
 * own publication state already gates whether this query is reached, and
 * `project_media` rows have no independent status (T43 spec). RLS still
 * gates access: anon callers see only rows whose parent project is published
 * (`project_media_public_read` policy, migration 010).
 *
 * Mirrors `getPublishedProjects` shape (projection + thenable terminal + throw
 * on error). The admin-side equivalent lives in
 * `lib/admin-queries-project-media.ts` and uses `logQueryError` instead of
 * `logDbError`.
 *
 * @param projectId Owning project UUID. Must be a non-empty string.
 * @param client    Optional injected client (for tests). Defaults to a
 *                  request-scoped server client.
 * @returns Array of media rows in `order_index` ASC order. Empty array if
 *          the project has no media (or none visible to the caller under RLS).
 * @throws  ServiceError on invalid input or any database error.
 */
export async function getProjectMediaByProject(
  projectId: string,
  client?: SupabaseClient,
): Promise<ProjectMedia[]> {
  const operation = 'getProjectMediaByProject';
  if (typeof projectId !== 'string' || projectId.length === 0) {
    throw new ServiceError('invalid projectId argument', {
      operation,
      cause: new Error(`projectId must be a non-empty string, got: ${typeof projectId}`),
    });
  }
  const supabase = client ?? (await createServerClient());
  const { data, error } = await supabase
    .from('project_media')
    .select(PROJECT_MEDIA_COLUMNS)
    .eq('project_id', projectId)
    .order('order_index', { ascending: true });
  if (error) {
    logDbError(operation, error);
    throw new ServiceError(`${operation} failed`, { cause: error, operation });
  }
  return (data ?? []) as ProjectMedia[];
}
