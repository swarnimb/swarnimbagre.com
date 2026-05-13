import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from './supabase';
import { ServiceError } from './errors';
import type { ProjectStatus } from './types';

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
