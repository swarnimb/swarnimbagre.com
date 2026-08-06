import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from './supabase';
import { ServiceError } from './errors';
import { PUBLISHED, assertSlug, logDbError } from './db-internal';
import type { Project, Stat, Note, ImageRecord, ProjectMedia } from './types';

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
 * `progress_percent`, `thumb_kind`, `image_after_id`), then again in T46
 * (migration 013) with `subtitle` and `tags`. Public render reads these off
 * the row via `lib/public-projects.ts`. `thumb_kind` is dead as of T46: the
 * redesigned card renders photographic media only, so nothing reads it, but
 * the column is retained so historical values survive.
 *
 * `post_id` (T45, migration 011) was MISSING from this projection until the
 * first full Playwright run caught it. `Project` declares the field, so
 * TypeScript was satisfied, but PostgREST only returns the columns named
 * here — so `row.post_id` was always `undefined` at runtime,
 * `loadPublicProjects` mapped `postId: undefined`, and `buildWriteupHrefs`
 * in `app/projects/page.tsx` skipped every project on its `if (!postId)`
 * guard. The upshot was that the card's `Writeup` action could never render
 * for anyone, on any project: T45's entire feature was inert in production.
 * A projection is a runtime contract that the type system cannot check —
 * adding a column to `Project` does not add it here.
 */
const PROJECT_COLUMNS =
  'id, title, slug, description, status, image_id, created_at, updated_at, ' +
  'github_url, live_url, post_url, progress_percent, thumb_kind, image_after_id, ' +
  'sort_order, subtitle, tags, post_id';

/** Column projection for stat queries. Extended in T46 (migration 014). */
const STAT_COLUMNS =
  'id, category, label, value, unit, created_at, aside, sort_order';

/** Column projection for note queries (T46, migration 014). */
const NOTE_COLUMNS = 'id, kicker, line, sort_order, created_at, updated_at';

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
 * Fetch all published projects, ordered by manual `sort_order` ASC with
 * `created_at` DESC as a deterministic tiebreaker (T44).
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
    .order('sort_order', { ascending: true })
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
 * Fetch all stats in display order.
 *
 * Replaced `getStatsByCategory` at T46. The redesigned Other page renders a
 * fixed tile grid in a deliberate sequence, so category grouping (which
 * ordered alphabetically by an open-ended, LLM-written category string) could
 * not express the required order. Ordering is now explicit `sort_order` ASC
 * with `created_at` DESC as a deterministic tiebreaker, matching the
 * projects/posts convention from T44.
 *
 * @param client Optional injected client (for tests).
 * @returns Ordered stat array. Empty array if no rows.
 * @throws  ServiceError on any database error.
 */
export async function getOrderedStats(
  client?: SupabaseClient,
): Promise<Stat[]> {
  const operation = 'getOrderedStats';
  const supabase = client ?? (await createServerClient());
  const { data, error } = await supabase
    .from('stats')
    .select(STAT_COLUMNS)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) {
    logDbError(operation, error);
    throw new ServiceError(`${operation} failed`, { cause: error, operation });
  }
  return (data ?? []) as unknown as Stat[];
}

/**
 * Fetch all note tiles in display order (T46, migration 014).
 *
 * Same ordering contract as `getOrderedStats`: explicit `sort_order` ASC with
 * `created_at` DESC as the tiebreaker.
 *
 * @param client Optional injected client (for tests).
 * @returns Ordered note array. Empty array if no rows.
 * @throws  ServiceError on any database error.
 */
export async function getNotes(client?: SupabaseClient): Promise<Note[]> {
  const operation = 'getNotes';
  const supabase = client ?? (await createServerClient());
  const { data, error } = await supabase
    .from('notes')
    .select(NOTE_COLUMNS)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) {
    logDbError(operation, error);
    throw new ServiceError(`${operation} failed`, { cause: error, operation });
  }
  return (data ?? []) as unknown as Note[];
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
