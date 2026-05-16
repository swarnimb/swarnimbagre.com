import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from './supabase';
import { ServiceError } from './errors';
import { logQueryError } from './admin-mutation-log';
import type { Project, ProjectStatus } from './types';

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
    logQueryError(operation, error);
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
    logQueryError(operation, error);
    throw new ServiceError(`${operation} failed`, { cause: error, operation });
  }
  return (data ?? null) as Project | null;
}
