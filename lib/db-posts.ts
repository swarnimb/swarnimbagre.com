import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from './supabase';
import { ServiceError } from './errors';
import { PUBLISHED, assertSlug, logDbError } from './db-internal';
import type { Post } from './types';

/**
 * Public post read loaders.
 *
 * Split out of `lib/db.ts` under CQ-02 (services < 300 lines). Shared helpers
 * and constants (`PUBLISHED`, `assertSlug`, `logDbError`) live in
 * `lib/db-internal.ts` so this module and `db.ts` can both import them without
 * a circular dependency (`db.ts` re-exports these functions). Callers continue
 * to import from `@/lib/db`, which re-exports this module's loaders unchanged.
 */

/** Column projection for post list and detail queries. */
const POST_COLUMNS =
  'id, title, slug, content, status, image_id, created_at, updated_at, sort_order';

/**
 * Fetch all published posts, ordered by manual `sort_order` ASC with
 * `created_at` DESC as a deterministic tiebreaker (T44).
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
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) {
    logDbError(operation, error);
    throw new ServiceError(`${operation} failed`, { cause: error, operation });
  }
  return (data ?? []) as Post[];
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
 * Fetch a single PUBLISHED post by id — the public render boundary for a
 * project's linked writeup (T45.C, Override 3).
 *
 * SECURITY: the `status='published'` filter lives in this query, not the
 * caller. A draft post linked via `Project.post_id`, a missing id, or a null
 * id all resolve to `null` so a draft body can never leak onto the public
 * project detail page. Mirrors the published filter on `getPostBySlug`.
 *
 * Distinct from the admin `getPostById` (`lib/admin-queries-posts.ts`), which
 * deliberately has NO status filter because the admin edits drafts.
 *
 * @param id     Post UUID, or `null` when the project has no linked post.
 * @param client Optional injected client (for tests).
 * @returns The matching published post, or `null` for a draft, a missing
 *          post, or a null id.
 * @throws  ServiceError on any database error.
 */
export async function getPublishedPostById(
  id: string | null,
  client?: SupabaseClient,
): Promise<Post | null> {
  const operation = 'getPublishedPostById';
  if (!id) return null;
  const supabase = client ?? (await createServerClient());
  const { data, error } = await supabase
    .from('posts')
    .select(POST_COLUMNS)
    .eq('status', PUBLISHED)
    .eq('id', id)
    .maybeSingle();
  if (error) {
    logDbError(operation, error);
    throw new ServiceError(`${operation} failed`, { cause: error, operation });
  }
  return (data ?? null) as Post | null;
}
