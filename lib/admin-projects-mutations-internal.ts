import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from './supabase';
import { ServiceError } from './errors';
import type { Project, ProjectStatus } from './types';
import {
  projectCreateSchema,
  projectUpdateSchema,
  type ProjectCreateInput,
  type ProjectUpdateInput,
} from './admin-projects-mutations-schemas';
import { orphanIfChanged } from './admin-images-orphan';
import { deriveSlugOrThrow } from './admin-slug';
import { logSupabaseError } from './admin-mutation-log';

// Re-export schemas + inferred types so existing imports from this module
// stay valid after the T42 schema extraction. New code should import from
// `./admin-projects-mutations-schemas` directly.
export {
  projectCreateSchema,
  projectUpdateSchema,
  type ProjectCreateInput,
  type ProjectUpdateInput,
};

/**
 * Module note (F-14 analogue, applied to PROJECT mutations).
 *
 * This file deliberately does NOT carry the `'use server'` directive. Every
 * export of a `'use server'` module becomes a publicly-addressable Server
 * Action with a stable hashed ID in the client bundle; co-locating these
 * throwing helpers next to the non-throwing wrappers in
 * `lib/admin-projects-mutations.ts` would expose them as additional RPC
 * endpoints and defeat the Channel 4 (Server Action surface) discipline
 * documented in `docs/auth-flow.md` §2a point 4. The split mirrors
 * `lib/auth-internal.ts` vs `lib/auth.ts`: thrown errors are confined to
 * this module, and the wrapper in `lib/admin-projects-mutations.ts` is the
 * only Server Action surface.
 *
 * Pure types + consts shared with the client form live in a separate
 * `lib/admin-projects-mutations-types.ts` because this module transitively
 * imports `next/headers` via `createServerClient` from `./supabase`, which
 * is not allowed in a Client Component's module graph.
 *
 * This is the per-resource throwing-helpers module per `architecture.md`
 * §6.6.6 (per-resource pattern). Sibling files: `-types.ts` (client-safe
 * envelope) and `-mutations.ts` (`'use server'` wrappers).
 */

/** Operation tag for create-side logs and ServiceError instances. */
const CREATE_PROJECT_OPERATION = 'createProject';
/** Operation tag for update-side logs and ServiceError instances. */
const UPDATE_PROJECT_OPERATION = 'updateProject';
/** Operation tag for delete-side logs and ServiceError instances. */
const DELETE_PROJECT_OPERATION = 'deleteProject';

/** Status literal used to gate the slug-lock rule on project edit. */
const PUBLISHED: ProjectStatus = 'published';

/**
 * Pre-fetch fields needed by the update orchestrator:
 *   - `status`         → slug-lock gate (CONSTRAINT-12)
 *   - `image_id`       → orphan-on-swap source (T26)
 *   - `image_after_id` → orphan-on-swap source for the before/after FK (T42)
 *
 * Extracted to keep the orchestrator under CQ-01's 50-line cap.
 *
 * @throws ServiceError on any Supabase error.
 */
async function fetchExistingProject(
  client: SupabaseClient,
  id: string,
): Promise<{
  status: ProjectStatus;
  image_id: string | null;
  image_after_id: string | null;
}> {
  const { data, error } = await client
    .from('projects')
    .select('status, image_id, image_after_id')
    .eq('id', id)
    .single();
  if (error) {
    logSupabaseError(UPDATE_PROJECT_OPERATION, error);
    throw new ServiceError(`${UPDATE_PROJECT_OPERATION} failed`, {
      operation: UPDATE_PROJECT_OPERATION,
      cause: error,
    });
  }
  return data as {
    status: ProjectStatus;
    image_id: string | null;
    image_after_id: string | null;
  };
}

/**
 * Insert a new project row.
 *
 * Boundary-validates the input with {@link projectCreateSchema} (SEC-02),
 * derives the slug from `title` via {@link deriveSlugOrThrow}, and inserts via the
 * Supabase query builder (SEC-03). Slug uniqueness is enforced at the DB
 * (UNIQUE constraint on `projects.slug`) — a collision surfaces as a Postgres
 * `23505` and is wrapped in a {@link ServiceError} here, then swallowed to a
 * uniform state-error shape by the `'use server'` wrapper.
 *
 * Throws freely — the public Server Action in
 * `lib/admin-projects-mutations.ts` catches and converts to the uniform
 * state envelope so the wire shape is indistinguishable across outcomes
 * (`docs/auth-flow.md` §2a Channel 2).
 *
 * @param input  Raw create payload. Validated before any DB call.
 * @param client Optional injected client (DI seam for tests). Defaults to a
 *               request-scoped admin server client.
 * @returns The inserted project row.
 * @throws z.ZodError   when `input` fails boundary validation.
 * @throws ServiceError when the slug derives to empty, or Supabase rejects.
 */
export async function createProjectInternal(
  input: unknown,
  client?: SupabaseClient,
): Promise<Project> {
  const parsed = projectCreateSchema.parse(input);
  const slug = deriveSlugOrThrow(parsed.title, CREATE_PROJECT_OPERATION);
  const supabase = client ?? (await createServerClient());
  const payload = {
    title: parsed.title,
    description: parsed.description,
    status: parsed.status,
    slug,
    github_url: parsed.github_url,
    live_url: parsed.live_url,
    post_url: parsed.post_url,
    progress_percent: parsed.progress_percent,
    thumb_kind: parsed.thumb_kind,
    post_id: parsed.post_id,
  };
  const { data, error } = await supabase
    .from('projects')
    .insert(payload)
    .select()
    .single();
  if (error) {
    logSupabaseError(CREATE_PROJECT_OPERATION, error);
    throw new ServiceError(`${CREATE_PROJECT_OPERATION} failed`, {
      operation: CREATE_PROJECT_OPERATION,
      cause: error,
    });
  }
  return data as Project;
}

/**
 * Update an existing project row.
 *
 * 1. Boundary-validates the input with {@link projectUpdateSchema} (SEC-02).
 * 2. Pre-fetches the row's current `status` to know whether the slug-lock
 *    rule applies. CONSTRAINT-12: the slug becomes immutable when the row is
 *    `published`. App-side omit is layer one; the migration 008 trigger is
 *    the DB-side guard (layer two).
 * 3. Builds the update payload — `slug` is included only when the existing
 *    row is `draft`. The wrapper's try/catch swallows any trigger violation
 *    to a uniform error shape, so even if the app-side omit logic ever
 *    regresses, the wire response stays indistinguishable.
 *
 * @param id     UUID of the project to update.
 * @param input  Raw update payload. Validated before any DB call.
 * @param client Optional injected client (DI seam for tests).
 * @returns The updated project row.
 * @throws z.ZodError   when `input` fails boundary validation.
 * @throws ServiceError when `id` is empty, the row is not found, or Supabase
 *                     rejects (including the slug-lock trigger raising).
 */
/**
 * Build the update-payload object passed to Supabase. The slug is included
 * only when the existing row is `draft` (CONSTRAINT-12); migration 006's
 * BEFORE UPDATE trigger is the DB-side belt that catches the omit-bypass.
 * Extracted from {@link updateProjectInternal} to keep the orchestrator
 * under CQ-01's 50-line cap.
 */
function buildProjectUpdatePayload(
  parsed: ProjectUpdateInput,
  isPublished: boolean,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    title: parsed.title,
    description: parsed.description,
    status: parsed.status,
    image_id: parsed.image_id,
    github_url: parsed.github_url,
    live_url: parsed.live_url,
    post_url: parsed.post_url,
    progress_percent: parsed.progress_percent,
    thumb_kind: parsed.thumb_kind,
    image_after_id: parsed.image_after_id,
    post_id: parsed.post_id,
  };
  if (!isPublished) {
    payload.slug = deriveSlugOrThrow(parsed.title, UPDATE_PROJECT_OPERATION);
  }
  return payload;
}

/**
 * Detach the previous image rows for both FKs when the parent project
 * swaps them. T26 introduced this for `image_id`; T42 extends it to the
 * before/after FK `image_after_id`. Same orphan rule both times — the
 * helper just runs the pair sequentially so the orchestrator stays flat.
 */
async function orphanProjectImagesIfChanged(
  client: SupabaseClient,
  projectId: string,
  existing: { image_id: string | null; image_after_id: string | null },
  parsed: ProjectUpdateInput,
): Promise<void> {
  await orphanIfChanged(
    client, UPDATE_PROJECT_OPERATION, projectId,
    existing.image_id, parsed.image_id,
  );
  await orphanIfChanged(
    client, UPDATE_PROJECT_OPERATION, projectId,
    existing.image_after_id, parsed.image_after_id,
  );
}

export async function updateProjectInternal(
  id: string,
  input: unknown,
  client?: SupabaseClient,
): Promise<Project> {
  if (typeof id !== 'string' || id.length === 0) {
    throw new ServiceError('invalid id argument', {
      operation: UPDATE_PROJECT_OPERATION,
      cause: new Error(`id must be a non-empty string, got: ${typeof id}`),
    });
  }
  const parsed = projectUpdateSchema.parse(input);
  const supabase = client ?? (await createServerClient());
  const existingRow = await fetchExistingProject(supabase, id);
  const isPublished = existingRow.status === PUBLISHED;
  const payload = buildProjectUpdatePayload(parsed, isPublished);

  const { data, error } = await supabase
    .from('projects')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error) {
    logSupabaseError(UPDATE_PROJECT_OPERATION, error);
    throw new ServiceError(`${UPDATE_PROJECT_OPERATION} failed`, {
      operation: UPDATE_PROJECT_OPERATION,
      cause: error,
    });
  }
  await orphanProjectImagesIfChanged(supabase, id, existingRow, parsed);
  return data as Project;
}

/**
 * Hard-delete a project row by id.
 *
 * CONSTRAINT-10: hard-delete only — no soft-delete column, no tombstone, no
 * undo. Recovery from accidental delete is via Supabase backups; the confirm
 * modal at the UI boundary (T22) is the only undo path.
 *
 * Validates `id` is a non-empty string before any DB call (SEC-02). Deletes
 * via the Supabase query builder (SEC-03). Throws freely — the public Server
 * Action in `lib/admin-projects-mutations.ts` catches and converts to the
 * uniform state envelope so the wire shape is indistinguishable across
 * outcomes (`docs/auth-flow.md` §2a Channel 2).
 *
 * Note: Supabase `.delete()` does not error when the row does not exist —
 * the operation is idempotent at the SQL level. A missing row therefore
 * resolves successfully; callers wanting "not found" semantics should pre-
 * fetch via `getProjectById` (the T22 UI does this implicitly — the modal
 * is opened against a row already on screen).
 *
 * @param id     UUID of the project to delete. Must be a non-empty string.
 * @param client Optional injected client (DI seam for tests). Defaults to a
 *               request-scoped admin server client.
 * @throws ServiceError when `id` is empty or whitespace, or Supabase rejects.
 */
export async function deleteProjectInternal(
  id: string,
  client?: SupabaseClient,
): Promise<void> {
  if (typeof id !== 'string' || id.trim().length === 0) {
    throw new ServiceError('invalid id argument', {
      operation: DELETE_PROJECT_OPERATION,
      cause: new Error(`id must be a non-empty string, got: ${typeof id}`),
    });
  }
  const supabase = client ?? (await createServerClient());
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) {
    logSupabaseError(DELETE_PROJECT_OPERATION, error);
    throw new ServiceError(`${DELETE_PROJECT_OPERATION} failed`, {
      operation: DELETE_PROJECT_OPERATION,
      cause: error,
    });
  }
}
