import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from './supabase';
import { ServiceError } from './errors';
import type { Post, PostStatus, Project, ProjectStatus, Stat } from './types';

/**
 * Filter literal accepted by {@link getAllProjects}.
 *
 * `'all'` returns both drafts and published rows; the other two narrow by
 * `projects.status`. RLS (`projects_admin_all` from migration 002) governs
 * row visibility — this filter is purely a UX convenience for the admin
 * list view.
 */
export type ProjectFilter = 'all' | ProjectStatus;

/**
 * Filter literal accepted by {@link getAllPosts}.
 *
 * `'all'` returns both drafts and published rows; the other two narrow by
 * `posts.status`. RLS (`posts_admin_all` from migration 002) governs row
 * visibility — this filter is purely a UX convenience for the admin list
 * view, mirroring {@link ProjectFilter}.
 */
export type PostFilter = 'all' | PostStatus;

/**
 * Column projection for the admin projects list. Narrower than the public-
 * site projection in `lib/db.ts` (no `description`) because the list view
 * does not render the body — a wider projection would waste bandwidth on
 * every page load.
 */
const PROJECT_LIST_COLUMNS = 'id, title, slug, status, image_id, created_at, updated_at';

/**
 * Column projection for {@link getProjectById}. Includes `description` —
 * the edit form needs it. Kept separate from `PROJECT_LIST_COLUMNS` so the
 * list view does not pay the bandwidth cost of every body on every page
 * load.
 */
const PROJECT_DETAIL_COLUMNS =
  'id, title, slug, description, status, image_id, created_at, updated_at';

/** PostgREST error code for "no rows returned" — treat as a 404, not an error. */
const PGRST_NO_ROWS = 'PGRST116';

/**
 * Row shape returned by {@link getAllProjects}.
 *
 * Defined locally rather than importing `Project` from `lib/types.ts`
 * because the list query intentionally omits `description` — using the
 * full `Project` interface would lie about which fields are present.
 */
export interface ProjectRow {
  id: string;
  title: string;
  slug: string;
  status: ProjectStatus;
  image_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Log a Supabase error without leaking row data or PII. Matches the shape
 * used by `logDbError` in `lib/db.ts` so structured logs are uniform across
 * the data layer.
 *
 * @param operation Caller name.
 * @param error     The Supabase error object (or any thrown value).
 */
function logDbError(operation: string, error: { code?: string; message?: string } | null): void {
  console.error(`[admin-queries] ${operation} failed`, {
    operation,
    errorCode: error?.code ?? null,
    errorMessage: error?.message ?? null,
    stack: new Error().stack,
  });
}

/**
 * Fetch projects for the admin list view, newest first, with status filter
 * and pagination. Admin sees both draft and published rows — RLS permits
 * SELECT on `projects` for the `authenticated` role via the
 * `projects_admin_all` policy from migration 002.
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
export async function getAllProjects(
  filter: ProjectFilter = 'all',
  page = 1,
  pageSize = 50,
  client?: SupabaseClient,
): Promise<{ rows: ProjectRow[]; total: number }> {
  const operation = 'getAllProjects';
  const supabase = client ?? (await createServerClient());
  const from = (page - 1) * pageSize;
  const to = page * pageSize - 1;
  let query = supabase
    .from('projects')
    .select(PROJECT_LIST_COLUMNS, { count: 'exact' });
  if (filter !== 'all') {
    query = query.eq('status', filter);
  }
  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) {
    logDbError(operation, error);
    throw new ServiceError(`${operation} failed`, { cause: error, operation });
  }
  return { rows: (data ?? []) as ProjectRow[], total: count ?? 0 };
}

/**
 * Fetch a single project by id for the admin edit view.
 *
 * Returns the full project row (including `description`) so the edit form
 * can populate every field. RLS (`projects_admin_all`) permits the read
 * regardless of `status`; this function deliberately omits the public-side
 * `status='published'` filter that `lib/db.ts::getProjectBySlug` applies.
 *
 * A "no rows" outcome is NOT an error — the edit page treats it as a 404
 * via Next 15's `notFound()`. The PostgREST error code `PGRST116` (returned
 * by `.single()` when zero rows match) is therefore mapped to `null`, while
 * every other error path throws a {@link ServiceError}.
 *
 * @param id     UUID of the project to fetch. Must be a non-empty string.
 * @param client Optional injected Supabase client (DI seam for tests).
 *               Defaults to a request-scoped admin server client.
 * @returns The project row, or `null` if no row matches the id.
 * @throws  {@link ServiceError} on invalid `id` or non-PGRST116 DB errors.
 */
export async function getProjectById(
  id: string,
  client?: SupabaseClient,
): Promise<Project | null> {
  const operation = 'getProjectById';
  if (typeof id !== 'string' || id.length === 0) {
    throw new ServiceError('invalid id argument', {
      operation,
      cause: new Error(`id must be a non-empty string, got: ${typeof id}`),
    });
  }
  const supabase = client ?? (await createServerClient());
  const { data, error } = await supabase
    .from('projects')
    .select(PROJECT_DETAIL_COLUMNS)
    .eq('id', id)
    .single();
  if (error) {
    if ((error as { code?: string }).code === PGRST_NO_ROWS) return null;
    logDbError(operation, error);
    throw new ServiceError(`${operation} failed`, { cause: error, operation });
  }
  return (data ?? null) as Project | null;
}

// =============================================================================
// Posts (T23) — same shape as the project query helpers above.
//
// Narrower list projection (omits `content` — the body would waste bandwidth on
// every page load); detail projection includes `content` for the edit form.
// `getPostById` returns `null` on the PGRST116 "no rows" case so the edit page
// can call Next 15's `notFound()`, identical to `getProjectById`.
// =============================================================================

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
    logDbError(operation, error);
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
    logDbError(operation, error);
    throw new ServiceError(`${operation} failed`, { cause: error, operation });
  }
  return (data ?? null) as Post | null;
}

// =============================================================================
// Stats (T24) — same shape as the project / post query helpers above.
//
// Differences:
//   - No filter type — stats has no `status` column, no draft/published
//     lifecycle. The admin list shows every row regardless.
//   - No separate `StatRow` interface — stats has no body column to omit, so
//     the list query returns the full {@link Stat} from `lib/types.ts`.
//   - No `getStatById` — stats has no edit path (CONSTRAINT-10:
//     delete-then-reinsert for corrections), so the detail-fetch surface
//     isn't needed.
// =============================================================================

/**
 * Column projection for the admin stats list. Matches the public-site
 * projection in `lib/db.ts::STAT_COLUMNS` because stats has no body column
 * to omit from list views.
 */
const STAT_LIST_COLUMNS = 'id, category, label, value, unit, created_at';

/**
 * Fetch stats for the admin list view, newest first, with pagination. Admin
 * sees every row — RLS (`stats_admin_all` from migration 004) permits SELECT
 * for the `authenticated` role; the public read policy is unaffected.
 *
 * Pagination signature mirrors {@link getAllPosts} / {@link getAllProjects}:
 * 1-indexed `page` and `pageSize`, returning the page slice plus the exact
 * `total` so the UI can render `Page X of Y`. The plan-file spec called for
 * a bare `(limit, offset) -> Stat[]` signature; the wider envelope is needed
 * by the {@link import('@/components/admin/StatsList').default} component
 * (which uses `total` for its pagination footer) and keeps the admin query
 * surface uniform.
 *
 * @param page     1-indexed page number. Defaults to `1`.
 * @param pageSize Rows per page. Defaults to `50`.
 * @param client   Optional injected Supabase client (for tests). Defaults
 *                 to a request-scoped server client bound to the admin
 *                 session's cookies.
 * @returns Object with `rows` (the page slice) and `total` (the exact
 *          server-side count of rows across all pages).
 * @throws  {@link ServiceError} on any Supabase error. The admin surface
 *          intentionally lets failures bubble — CONSTRAINT-14's `safeLoad`
 *          discipline is for public pages, not admin.
 */
export async function getAllStats(
  page = 1,
  pageSize = 50,
  client?: SupabaseClient,
): Promise<{ rows: Stat[]; total: number }> {
  const operation = 'getAllStats';
  const supabase = client ?? (await createServerClient());
  const from = (page - 1) * pageSize;
  const to = page * pageSize - 1;
  const { data, error, count } = await supabase
    .from('stats')
    .select(STAT_LIST_COLUMNS, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) {
    logDbError(operation, error);
    throw new ServiceError(`${operation} failed`, { cause: error, operation });
  }
  return { rows: (data ?? []) as Stat[], total: count ?? 0 };
}
