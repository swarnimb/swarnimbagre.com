import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from './supabase';
import { ServiceError } from './errors';
import { logQueryError } from './admin-mutation-log';
import type { ProjectMedia } from './types';

/**
 * Column projection for `project_media` admin queries. Snake-case mirror of
 * the migration 010 row shape; kept verbatim so `as ProjectMedia[]` is a
 * structural identity, not a coercion.
 */
const PROJECT_MEDIA_COLUMNS =
  'id, project_id, image_id, image_after_id, caption, order_index, created_at';

/**
 * Fetch every media row attached to a project, ordered by `order_index` ASC.
 *
 * Admin read surface — uses the authenticated server client so the
 * `project_media_admin_all` policy (migration 010) grants SELECT. Service
 * role would bypass RLS entirely; we deliberately stick to the authenticated
 * path so the same code can also be exercised by the admin UI without
 * privilege escalation.
 *
 * Mirrors the public-side `getProjectMediaByProject` shape (same projection,
 * same ordering). The only differences are the log tag (`[admin-queries]`
 * via {@link logQueryError}, per architecture.md §6.6.8) and the absence of
 * a `status='published'` filter — admins see drafts too.
 *
 * @param projectId Owning project UUID. Must be a non-empty string.
 * @param client    Optional injected client (for tests). Defaults to a
 *                  request-scoped server client.
 * @returns Array of media rows in `order_index` ASC order. Empty array if
 *          the project has no media.
 * @throws  ServiceError on invalid input or any database error.
 */
export async function getProjectMediaByProjectAdmin(
  projectId: string,
  client?: SupabaseClient,
): Promise<ProjectMedia[]> {
  const operation = 'getProjectMediaByProjectAdmin';
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
    logQueryError(operation, error);
    throw new ServiceError(`${operation} failed`, { cause: error, operation });
  }
  return (data ?? []) as ProjectMedia[];
}
