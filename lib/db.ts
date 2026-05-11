import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from './supabase';
import { ServiceError } from './errors';
import type { Project, Post, Stat, ImageRecord } from './types';

/** Column projection for project list and detail queries. */
const PROJECT_COLUMNS =
  'id, title, slug, description, status, image_id, created_at, updated_at';

/** Column projection for post list and detail queries. */
const POST_COLUMNS =
  'id, title, slug, content, status, image_id, created_at, updated_at';

/** Column projection for stat queries. */
const STAT_COLUMNS = 'id, category, label, value, unit, created_at';

/** Column projection for image queries. */
const IMAGE_COLUMNS = 'id, bucket_path, alt_text, parent_id, parent_type, created_at';

/** Status literal used to filter public reads. */
const PUBLISHED = 'published';

/**
 * Validate a slug parameter at the data-layer boundary.
 *
 * @param slug      The candidate slug to check.
 * @param operation Caller name, used in the thrown ServiceError.
 * @throws ServiceError if slug is not a non-empty string.
 */
function assertSlug(slug: unknown, operation: string): asserts slug is string {
  if (typeof slug !== 'string' || slug.length === 0) {
    throw new ServiceError('invalid slug argument', {
      operation,
      cause: new Error(`slug must be a non-empty string, got: ${typeof slug}`),
    });
  }
}

/**
 * Log a Supabase error without leaking row data or PII.
 *
 * @param operation Caller name.
 * @param error     The Supabase error object (or any thrown value).
 */
function logDbError(operation: string, error: { code?: string; message?: string } | null): void {
  console.error(`[db] ${operation} failed`, {
    operation,
    errorCode: error?.code ?? null,
    errorMessage: error?.message ?? null,
    stack: new Error().stack,
  });
}

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
  return (data ?? []) as Project[];
}

/**
 * Fetch all published posts, newest first.
 *
 * @param client Optional injected client (for tests).
 * @returns Array of posts, empty array if none.
 * @throws  ServiceError on any database error.
 */
export async function getPublishedPosts(client?: SupabaseClient): Promise<Post[]> {
  const operation = 'getPublishedPosts';
  const supabase = client ?? (await createServerClient());
  const { data, error } = await supabase
    .from('posts')
    .select(POST_COLUMNS)
    .eq('status', PUBLISHED)
    .order('created_at', { ascending: false });
  if (error) {
    logDbError(operation, error);
    throw new ServiceError(`${operation} failed`, { cause: error, operation });
  }
  return (data ?? []) as Post[];
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
 * Fetch a single published post by slug.
 *
 * @param slug   URL slug. Must be a non-empty string.
 * @param client Optional injected client (for tests).
 * @returns The matching post, or `null` if not found.
 * @throws  ServiceError on invalid input or database error.
 */
export async function getPostBySlug(
  slug: string,
  client?: SupabaseClient,
): Promise<Post | null> {
  const operation = 'getPostBySlug';
  assertSlug(slug, operation);
  const supabase = client ?? (await createServerClient());
  const { data, error } = await supabase
    .from('posts')
    .select(POST_COLUMNS)
    .eq('status', PUBLISHED)
    .eq('slug', slug)
    .maybeSingle();
  if (error) {
    logDbError(operation, error);
    throw new ServiceError(`${operation} failed`, { cause: error, operation });
  }
  return (data ?? null) as Post | null;
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
