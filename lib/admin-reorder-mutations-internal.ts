import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from './supabase';
import { ServiceError } from './errors';
import { reorderSaveSchema, type ReorderSaveInput } from './admin-reorder-mutations-schemas';
import { logSupabaseError } from './admin-mutation-log';

// Re-export the schema + inferred type so callers that need the typed
// payload can import from this module (mirrors the project_media analog).
export { reorderSaveSchema, type ReorderSaveInput };

/**
 * Module note (F-14 analogue, applied to REORDER mutations).
 *
 * This file deliberately does NOT carry the `'use server'` directive. Every
 * export of a `'use server'` module becomes a publicly-addressable Server
 * Action with a stable hashed ID in the client bundle; co-locating this
 * throwing helper next to the non-throwing wrappers in
 * `lib/admin-reorder-mutations.ts` would expose it as an additional RPC
 * endpoint and defeat the Channel 4 (Server Action surface) discipline
 * documented in `docs/auth-flow.md` §2a point 4.
 *
 * Pure types + consts shared with the client reorder UI live in a separate
 * `lib/admin-reorder-mutations-types.ts` because this module transitively
 * imports `next/headers` via `createServerClient` from `./supabase`, which
 * is not allowed in a Client Component's module graph.
 *
 * Per `architecture.md` §6.6.6 (per-resource four-file pattern). Sibling
 * files: `-types.ts` (client-safe envelope), `-schemas.ts` (zod boundary),
 * and `-mutations.ts` (`'use server'` wrapper).
 */

/** Reorderable resource families this surface supports. */
export type ReorderResource = 'projects' | 'posts';

/**
 * Map each resource to its migration-012a RPC name. The RPC derives
 * `sort_order` from array position via `with ordinality`; SECURITY INVOKER,
 * EXECUTE granted only to `authenticated`.
 */
const RPC_BY_RESOURCE: Record<ReorderResource, string> = {
  projects: 'save_project_order',
  posts: 'save_post_order',
};

/**
 * Map each resource to its operation tag for save-side logs and ServiceError
 * instances, matching the public Server Action export name.
 */
const OPERATION_BY_RESOURCE: Record<ReorderResource, string> = {
  projects: 'saveProjectOrder',
  posts: 'savePostOrder',
};

/**
 * Atomic persist of an admin drag-reorder for one resource family.
 *
 * Boundary-validates `raw` with {@link reorderSaveSchema} (SEC-02), resolves
 * `resource` to its migration-012a RPC (`save_project_order` /
 * `save_post_order`), and dispatches the ordered `{ id }` array as `p_rows`.
 * The RPC writes each row's 0-based array position back into `sort_order` in
 * a single transaction, so a partial reorder is impossible — either every
 * row's order updates or none do.
 *
 * The RPC uses SECURITY INVOKER so the caller's RLS context applies; the
 * admin policy gates the UPDATE exactly as for direct table writes. EXECUTE
 * is revoked from `anon`, so unauthenticated callers fail at the EXECUTE
 * check before reaching the function body.
 *
 * Throws freely — the public Server Actions in
 * `lib/admin-reorder-mutations.ts` catch and convert to the uniform state
 * envelope so the wire shape is indistinguishable across outcomes
 * (`docs/auth-flow.md` §2a Channel 2).
 *
 * @param resource Which resource family to reorder (`'projects'`/`'posts'`).
 * @param raw      Raw payload. Validated before any DB call.
 * @param client   Optional injected client (DI seam for tests). Defaults to a
 *                 request-scoped admin server client.
 * @throws z.ZodError   when `raw` fails boundary validation.
 * @throws ServiceError when the RPC rejects (RLS, trigger raise) or Supabase
 *                      returns a non-Postgres error.
 */
export async function saveOrderInternal(
  resource: ReorderResource,
  raw: unknown,
  client?: SupabaseClient,
): Promise<void> {
  const operation = OPERATION_BY_RESOURCE[resource];
  const parsed: ReorderSaveInput = reorderSaveSchema.parse(raw);
  const supabase = client ?? (await createServerClient());
  const { error } = await supabase.rpc(RPC_BY_RESOURCE[resource], {
    p_rows: parsed.rows,
  });
  if (error) {
    logSupabaseError(operation, error);
    throw new ServiceError(`${operation} failed`, { operation, cause: error });
  }
}
