import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from './supabase';
import { ServiceError } from './errors';
import {
  projectMediaSaveSchema,
  type ProjectMediaSaveInput,
} from './admin-project-media-mutations-schemas';
import { logSupabaseError } from './admin-mutation-log';

// Re-export the schema + inferred type so callers that need the typed
// payload can import from this module (mirrors the projects analog).
export { projectMediaSaveSchema, type ProjectMediaSaveInput };

/**
 * Module note (F-14 analogue, applied to PROJECT MEDIA mutations).
 *
 * This file deliberately does NOT carry the `'use server'` directive. Every
 * export of a `'use server'` module becomes a publicly-addressable Server
 * Action with a stable hashed ID in the client bundle; co-locating these
 * throwing helpers next to the non-throwing wrapper in
 * `lib/admin-project-media-mutations.ts` would expose them as additional
 * RPC endpoints and defeat the Channel 4 (Server Action surface) discipline
 * documented in `docs/auth-flow.md` §2a point 4.
 *
 * Pure types + consts shared with the client form live in a separate
 * `lib/admin-project-media-mutations-types.ts` because this module
 * transitively imports `next/headers` via `createServerClient` from
 * `./supabase`, which is not allowed in a Client Component's module graph.
 *
 * Per `architecture.md` §6.6.6 (per-resource four-file pattern). Sibling
 * files: `-types.ts` (client-safe envelope), `-schemas.ts` (zod boundary),
 * and `-mutations.ts` (`'use server'` wrapper).
 */

/** Operation tag for save-side logs and ServiceError instances. */
const SAVE_PROJECT_MEDIA_OPERATION = 'saveProjectMedia';

/**
 * Name of the Postgres RPC introduced in migration 010a. Wraps the DELETE +
 * INSERT in a single transaction; SECURITY INVOKER, EXECUTE granted only to
 * `authenticated`.
 */
const SAVE_PROJECT_MEDIA_RPC = 'save_project_media';

/**
 * Atomic delete-then-insert of all `project_media` rows for one project.
 *
 * Boundary-validates `raw` with {@link projectMediaSaveSchema} (SEC-02).
 * Dispatches to the `save_project_media(p_project_id, p_rows)` Postgres RPC
 * created in migration 010a, which wraps both operations in a single
 * transaction — a failure on the INSERT side (RLS reject, FK violation,
 * row-cap trigger raise) rolls back the DELETE, so no torn save state is
 * possible.
 *
 * The RPC uses SECURITY INVOKER so the caller's RLS context applies; the
 * admin policy `project_media_admin_all` gates DELETE + INSERT exactly as
 * for direct table writes. EXECUTE on the RPC is revoked from `anon` so
 * unauthenticated callers fail at the EXECUTE check before reaching the
 * function body.
 *
 * Throws freely — the public Server Action in
 * `lib/admin-project-media-mutations.ts` catches and converts to the
 * uniform state envelope so the wire shape is indistinguishable across
 * outcomes (`docs/auth-flow.md` §2a Channel 2).
 *
 * @param raw    Raw payload. Validated before any DB call.
 * @param client Optional injected client (DI seam for tests). Defaults to a
 *               request-scoped admin server client.
 * @throws z.ZodError   when `raw` fails boundary validation.
 * @throws ServiceError when the RPC rejects (RLS, FK, trigger raise) or
 *                     Supabase returns a non-Postgres error.
 */
export async function saveProjectMediaInternal(
  raw: unknown,
  client?: SupabaseClient,
): Promise<void> {
  const parsed: ProjectMediaSaveInput = projectMediaSaveSchema.parse(raw);
  const supabase = client ?? (await createServerClient());
  const { error } = await supabase.rpc(SAVE_PROJECT_MEDIA_RPC, {
    p_project_id: parsed.project_id,
    p_rows: parsed.rows,
  });
  if (error) {
    logSupabaseError(SAVE_PROJECT_MEDIA_OPERATION, error);
    throw new ServiceError(`${SAVE_PROJECT_MEDIA_OPERATION} failed`, {
      operation: SAVE_PROJECT_MEDIA_OPERATION,
      cause: error,
    });
  }
}
