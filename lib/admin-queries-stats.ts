import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from './supabase';
import { ServiceError } from './errors';
import { logQueryError } from './admin-mutation-log';
import type { Stat } from './types';

// =============================================================================
// Stats (T24) — same shape as the project / post query helpers.
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
 * to omit from list views. `aside` and `sort_order` were added in T46
 * (migration 014); both are list-visible so the operator can see the quip
 * and the display rank without opening a row.
 */
const STAT_LIST_COLUMNS =
  'id, category, label, value, unit, aside, sort_order, created_at';

/**
 * Fetch stats for the admin list view in DISPLAY order, with pagination.
 *
 * T46 changed the ordering from `created_at DESC` to `sort_order ASC` with
 * `created_at DESC` as the tiebreaker, matching `lib/db.ts::getOrderedStats`
 * exactly. The admin list previously showed a different order from the public
 * page, so an operator setting `sort_order` could not see the result of their
 * own edit without leaving admin. Admin
 * sees every row — RLS (`stats_admin_all` from migration 004) permits SELECT
 * for the `authenticated` role; the public read policy is unaffected.
 *
 * Pagination signature mirrors {@link import('./admin-queries-posts').getAllPosts}
 * / {@link import('./admin-queries-projects').getAllProjects}: 1-indexed
 * `page` and `pageSize`, returning the page slice plus the exact `total` so
 * the UI can render `Page X of Y`. The plan-file spec called for a bare
 * `(limit, offset) -> Stat[]` signature; the wider envelope is needed by the
 * {@link import('@/components/admin/StatsList').default} component (which uses
 * `total` for its pagination footer) and keeps the admin query surface
 * uniform.
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
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) {
    logQueryError(operation, error);
    throw new ServiceError(`${operation} failed`, { cause: error, operation });
  }
  return { rows: (data ?? []) as Stat[], total: count ?? 0 };
}
