import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from './supabase';
import { ServiceError } from './errors';
import { logQueryError } from './admin-mutation-log';
import type { Post, PostStatus } from './types';

/**
 * Filter literal accepted by {@link getAllPosts}.
 *
 * `'all'` returns both drafts and published rows; the other two narrow by
 * `posts.status`. RLS (`posts_admin_all` from migration 002) governs row
 * visibility — this filter is purely a UX convenience for the admin list
 * view, mirroring `ProjectFilter`.
 */
export type PostFilter = 'all' | PostStatus;

/**
 * Column projection for the admin posts list. Narrower than the public-site
 * projection in `lib/db.ts` (no `content`) because the list view does not
 * render the body — a wider projection would waste bandwidth on every page
 * load.
 */
const POST_LIST_COLUMNS = 'id, title, slug, status, image_id, created_at, updated_at';

/**
 * Column projection for {@link getPostById}. Includes `content` — the edit
 * form needs the raw Markdown body. Kept separate from {@link POST_LIST_COLUMNS}
 * so the list view does not pay the bandwidth cost of every body on every page
 * load.
 */
const POST_DETAIL_COLUMNS =
  'id, title, slug, content, status, image_id, created_at, updated_at';

/** PostgREST error code for "no rows returned" — treat as a 404, not an error. */
const PGRST_NO_ROWS = 'PGRST116';

/**
 * Row shape returned by {@link getAllPosts}.
 *
 * Defined locally rather than importing `Post` from `lib/types.ts` because
 * the list query intentionally omits `content` — using the full `Post`
 * interface would lie about which fields are present.
 */
export interface PostRow {
  id: string;
  title: string;
  slug: string;
  status: PostStatus;
  image_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch posts for the admin list view, newest first, with status filter and
 * pagination. Admin sees both draft and published rows — RLS permits SELECT
 * on `posts` for the `authenticated` role via the `posts_admin_all` policy
 * from migration 002.
 *
 * @param filter   `'all'` returns every status. `'published'` / `'draft'`
 *                 narrow via `.eq('status', ...)`. Defaults to `'all'`.
 * @param page     1-indexed page number. Defaults to `1`.
 * @param pageSize Rows per page. Defaults to `50`.
 * @param client   Optional injected Supabase client (for tests). Defaults
 *                 to a request-scoped server client bound to the admin
 *                 session's cookies.
 * @returns Object with `rows` (the page slice) and `total` (the exact
 *          server-side count of matching rows across all pages).
 * @throws  {@link ServiceError} on any Supabase error. The admin surface
 *          intentionally lets failures bubble — CONSTRAINT-14's `safeLoad`
 *          discipline is for public pages, not admin.
 */
export async function getAllPosts(
  filter: PostFilter = 'all',
  page = 1,
  pageSize = 50,
  client?: SupabaseClient,
): Promise<{ rows: PostRow[]; total: number }> {
  const operation = 'getAllPosts';
  const supabase = client ?? (await createServerClient());
  const from = (page - 1) * pageSize;
  const to = page * pageSize - 1;
  let query = supabase
    .from('posts')
    .select(POST_LIST_COLUMNS, { count: 'exact' });
  if (filter !== 'all') {
    query = query.eq('status', filter);
  }
  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) {
    logQueryError(operation, error);
    throw new ServiceError(`${operation} failed`, { cause: error, operation });
  }
  return { rows: (data ?? []) as PostRow[], total: count ?? 0 };
}

/**
 * Fetch a single post by id for the admin edit view.
 *
 * Returns the full post row (including `content`) so the edit form can
 * populate every field. RLS (`posts_admin_all`) permits the read regardless
 * of `status`; this function deliberately omits the public-side
 * `status='published'` filter that `lib/db.ts::getPostBySlug` applies.
 *
 * A "no rows" outcome is NOT an error — the edit page treats it as a 404
 * via Next 15's `notFound()`. The PostgREST error code `PGRST116` (returned
 * by `.single()` when zero rows match) is therefore mapped to `null`, while
 * every other error path throws a {@link ServiceError}.
 *
 * @param id     UUID of the post to fetch. Must be a non-empty string.
 * @param client Optional injected Supabase client (DI seam for tests).
 *               Defaults to a request-scoped admin server client.
 * @returns The post row, or `null` if no row matches the id.
 * @throws  {@link ServiceError} on invalid `id` or non-PGRST116 DB errors.
 */
export async function getPostById(
  id: string,
  client?: SupabaseClient,
): Promise<Post | null> {
  const operation = 'getPostById';
  if (typeof id !== 'string' || id.length === 0) {
    throw new ServiceError('invalid id argument', {
      operation,
      cause: new Error(`id must be a non-empty string, got: ${typeof id}`),
    });
  }
  const supabase = client ?? (await createServerClient());
  const { data, error } = await supabase
    .from('posts')
    .select(POST_DETAIL_COLUMNS)
    .eq('id', id)
    .single();
  if (error) {
    if ((error as { code?: string }).code === PGRST_NO_ROWS) return null;
    logQueryError(operation, error);
    throw new ServiceError(`${operation} failed`, { cause: error, operation });
  }
  return (data ?? null) as Post | null;
}

/**
 * Row shape returned by {@link listPostsForPicker} — only the columns the
 * "Linked writeup" project picker needs (id for the FK value, title for the
 * dropdown label). Deliberately narrower than {@link PostRow} so the
 * projection does not lie about which fields are present.
 */
export interface PostPickerRow {
  id: string;
  title: string;
}

/**
 * Fetch published posts for the project "Linked writeup" picker (T45.B),
 * ordered by `title` ascending. Drafts are excluded — a project can only be
 * linked to a post a reader could actually reach.
 *
 * RLS (`posts_admin_all`) permits the admin SELECT regardless of status; the
 * `status='published'` filter here is a domain rule for the picker, not a
 * visibility constraint. Failures bubble as a {@link ServiceError} — the
 * admin surface wants loud failures (CONSTRAINT-14's `safeLoad` discipline is
 * for public pages, not admin).
 *
 * @param client Optional injected Supabase client (DI seam for tests).
 *               Defaults to a request-scoped admin server client.
 * @returns Array of `{ id, title }`, published-only, title-ascending.
 * @throws  {@link ServiceError} on any Supabase error.
 */
export async function listPostsForPicker(
  client?: SupabaseClient,
): Promise<PostPickerRow[]> {
  const operation = 'listPostsForPicker';
  const supabase = client ?? (await createServerClient());
  const { data, error } = await supabase
    .from('posts')
    .select('id, title')
    .eq('status', 'published')
    .order('title', { ascending: true });
  if (error) {
    logQueryError(operation, error);
    throw new ServiceError(`${operation} failed`, { cause: error, operation });
  }
  return (data ?? []) as PostPickerRow[];
}
