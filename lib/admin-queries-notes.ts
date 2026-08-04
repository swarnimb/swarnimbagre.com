import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from './supabase';
import { ServiceError } from './errors';
import { logQueryError } from './admin-mutation-log';
import type { Note } from './types';

// =============================================================================
// Notes (T46, migration 014): same shape as the stats query helper.
//
// Differences:
//   - No pagination. The Other page renders exactly three text tiles, so the
//     table is a handful of rows by design; a page-size envelope and a
//     `Page X of Y` footer would be theatre. The signature is therefore a
//     bare `Note[]` rather than the `{ rows, total }` shape the paginated
//     admin lists return.
//   - Ordered by `sort_order ASC, created_at DESC`, the same order the
//     public page renders in, and the order the `notes_sort_order_idx` index
//     (migration 014) serves. Unlike stats, where the operator wants the row
//     they just typed at the top, a note is edited in place, so matching the
//     public order is the more useful view.
//   - No filter type, no detail fetch: notes has no status column and no
//     edit page (rows are edited inline in the list).
// =============================================================================

/**
 * Column projection for the admin notes list. The full row: notes has no
 * body column or blob to omit from list views.
 */
const NOTE_LIST_COLUMNS = 'id, kicker, line, sort_order, created_at, updated_at';

/**
 * Fetch every note for the admin list view, in display order. Admin sees all
 * rows: RLS (`notes_admin_all` from migration 014) permits SELECT for the
 * `authenticated` role; the public read policy is unaffected.
 *
 * @param client Optional injected Supabase client (for tests). Defaults to a
 *               request-scoped server client bound to the admin session's
 *               cookies.
 * @returns Every note row, ordered `sort_order ASC, created_at DESC`.
 * @throws  {@link ServiceError} on any Supabase error. The admin surface
 *          intentionally lets failures bubble: CONSTRAINT-14's `safeLoad`
 *          discipline is for public pages, not admin.
 */
export async function getAllNotes(client?: SupabaseClient): Promise<Note[]> {
  const operation = 'getAllNotes';
  const supabase = client ?? (await createServerClient());
  const { data, error } = await supabase
    .from('notes')
    .select(NOTE_LIST_COLUMNS)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) {
    logQueryError(operation, error);
    throw new ServiceError(`${operation} failed`, { cause: error, operation });
  }
  return (data ?? []) as Note[];
}
