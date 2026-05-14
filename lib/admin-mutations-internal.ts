import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { createServerClient } from './supabase';
import { ServiceError } from './errors';
import { slugify } from './slug';
import type { Post, PostStatus, Project, ProjectStatus, Stat } from './types';

/**
 * Module note (F-14 analogue, applied to mutations).
 *
 * This file deliberately does NOT carry the `'use server'` directive. Every
 * export of a `'use server'` module becomes a publicly-addressable Server
 * Action with a stable hashed ID in the client bundle; co-locating these
 * throwing helpers next to the non-throwing wrappers in
 * `lib/admin-mutations.ts` would expose them as additional RPC endpoints and
 * defeat the Channel 4 (Server Action surface) discipline documented in
 * `docs/auth-flow.md` §2a point 4. The split mirrors `lib/auth-internal.ts`
 * vs `lib/auth.ts`: thrown errors are confined to this module, and the
 * wrapper in `lib/admin-mutations.ts` is the only Server Action surface.
 *
 * Pure types + consts shared with the client form live in a separate
 * `lib/admin-mutations-types.ts` because this module transitively imports
 * `next/headers` via `createServerClient` from `./supabase`, which is not
 * allowed in a Client Component's module graph. The barrel re-exports below
 * keep existing call sites that import the types from this module working.
 */

export {
  GENERIC_FORM_ERROR,
  PROJECT_MUTATION_INITIAL_STATE,
} from './admin-mutations-types';
export type { ProjectMutationState } from './admin-mutations-types';

/**
 * Maximum title length. Mirrors the `text` column's CHECK in migration 001
 * (`projects.title length <= 200`).
 */
const TITLE_MAX_LENGTH = 200;

/**
 * Maximum length per stat text field (category, label, value, unit). The DB
 * has no length CHECK on these columns (migration 001 enforces non-empty
 * only); 200 chars is an app-side cap that matches {@link TITLE_MAX_LENGTH}
 * for symmetry across the admin write surface and prevents pathological
 * inputs reaching Postgres.
 */
const STAT_FIELD_MAX_LENGTH = 200;

/** Operation tag for create-side logs and ServiceError instances. */
const CREATE_PROJECT_OPERATION = 'createProject';
/** Operation tag for update-side logs and ServiceError instances. */
const UPDATE_PROJECT_OPERATION = 'updateProject';
/** Operation tag for delete-side logs and ServiceError instances. */
const DELETE_PROJECT_OPERATION = 'deleteProject';

/** Operation tag for post create-side logs and ServiceError instances. */
const CREATE_POST_OPERATION = 'createPost';
/** Operation tag for post update-side logs and ServiceError instances. */
const UPDATE_POST_OPERATION = 'updatePost';
/** Operation tag for post delete-side logs and ServiceError instances. */
const DELETE_POST_OPERATION = 'deletePost';

/** Operation tag for stat insert-side logs and ServiceError instances. */
const INSERT_STAT_OPERATION = 'insertStat';
/** Operation tag for stat delete-side logs and ServiceError instances. */
const DELETE_STAT_OPERATION = 'deleteStat';

/** Status literal used to gate the slug-lock rule on project edit. */
const PUBLISHED: ProjectStatus = 'published';
/** Status literal used to gate the slug-lock rule on post edit. */
const POST_PUBLISHED: PostStatus = 'published';

/**
 * Zod schema for the create-project boundary.
 *
 * `title` and `description` are required and non-empty (CONSTRAINT-13 stays
 * out of the schema — voice rules are content-side, not validation-side).
 * `status` is the project_status enum from migration 001; defaults to
 * `'draft'` so a publish-on-create flow is opt-in.
 */
export const projectCreateSchema = z.object({
  title: z.string().trim().min(1, 'title is required').max(TITLE_MAX_LENGTH),
  description: z.string().trim().min(1, 'description is required'),
  status: z.enum(['draft', 'published']).default('draft'),
});

/** Inferred input shape for {@link createProjectInternal}. */
export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;

/**
 * Zod schema for the update-project boundary. Same shape as create — both
 * fields are required because the form re-submits the full row, not a patch.
 * The wrapper computes whether `slug` should be re-derived from the new title
 * (when the existing row is a `draft`) or omitted (when `published`).
 */
export const projectUpdateSchema = z.object({
  title: z.string().trim().min(1, 'title is required').max(TITLE_MAX_LENGTH),
  description: z.string().trim().min(1, 'description is required'),
  status: z.enum(['draft', 'published']),
});

/** Inferred input shape for {@link updateProjectInternal}. */
export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>;

/**
 * Log a Supabase error without leaking row data or PII. Matches the shape of
 * `logDbError` in `lib/db.ts` so structured logs are uniform across the data
 * layer (EH-02, EH-03, SEC-05).
 */
function logMutationError(
  operation: string,
  error: { code?: string; message?: string } | null,
): void {
  console.error(`[admin-mutations] ${operation} failed`, {
    operation,
    errorCode: error?.code ?? null,
    errorMessage: error?.message ?? null,
    stack: new Error().stack,
  });
}

/**
 * Insert a new project row.
 *
 * Boundary-validates the input with {@link projectCreateSchema} (SEC-02),
 * derives the slug from `title` via {@link slugify}, and inserts via the
 * Supabase query builder (SEC-03). Slug uniqueness is enforced at the DB
 * (UNIQUE constraint on `projects.slug`) — a collision surfaces as a Postgres
 * `23505` and is wrapped in a {@link ServiceError} here, then swallowed to a
 * uniform state-error shape by the `'use server'` wrapper.
 *
 * Throws freely — the public Server Action in `lib/admin-mutations.ts`
 * catches and converts to the uniform state envelope so the wire shape is
 * indistinguishable across outcomes (`docs/auth-flow.md` §2a Channel 2).
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
  const slug = slugify(parsed.title);
  if (slug.length === 0) {
    throw new ServiceError('slug derives to empty from title', {
      operation: CREATE_PROJECT_OPERATION,
      cause: new Error('slugify(title) returned an empty string'),
    });
  }
  const supabase = client ?? (await createServerClient());
  const payload = {
    title: parsed.title,
    description: parsed.description,
    status: parsed.status,
    slug,
  };
  const { data, error } = await supabase
    .from('projects')
    .insert(payload)
    .select()
    .single();
  if (error) {
    logMutationError(CREATE_PROJECT_OPERATION, error);
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

  const { data: existing, error: fetchError } = await supabase
    .from('projects')
    .select('status')
    .eq('id', id)
    .single();
  if (fetchError) {
    logMutationError(UPDATE_PROJECT_OPERATION, fetchError);
    throw new ServiceError(`${UPDATE_PROJECT_OPERATION} failed`, {
      operation: UPDATE_PROJECT_OPERATION,
      cause: fetchError,
    });
  }
  const isPublished = (existing as { status: ProjectStatus }).status === PUBLISHED;

  const payload: Record<string, unknown> = {
    title: parsed.title,
    description: parsed.description,
    status: parsed.status,
  };
  if (!isPublished) {
    const slug = slugify(parsed.title);
    if (slug.length === 0) {
      throw new ServiceError('slug derives to empty from title', {
        operation: UPDATE_PROJECT_OPERATION,
        cause: new Error('slugify(title) returned an empty string'),
      });
    }
    payload.slug = slug;
  }

  const { data, error } = await supabase
    .from('projects')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error) {
    logMutationError(UPDATE_PROJECT_OPERATION, error);
    throw new ServiceError(`${UPDATE_PROJECT_OPERATION} failed`, {
      operation: UPDATE_PROJECT_OPERATION,
      cause: error,
    });
  }
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
 * Action in `lib/admin-mutations.ts` catches and converts to the uniform
 * state envelope so the wire shape is indistinguishable across outcomes
 * (`docs/auth-flow.md` §2a Channel 2).
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
    logMutationError(DELETE_PROJECT_OPERATION, error);
    throw new ServiceError(`${DELETE_PROJECT_OPERATION} failed`, {
      operation: DELETE_PROJECT_OPERATION,
      cause: error,
    });
  }
}

// =============================================================================
// Posts (T23) — same six-channel uniformity discipline as projects.
//
// Differences from the project helpers:
//   - `content` (raw Markdown) replaces `description`. CONSTRAINT-06: stored
//     verbatim — no HTML conversion, no sanitization at write time. Rendering
//     and sanitization happen at read time via the T12 client renderer.
//   - The status enum is `post_status` (same `'draft' | 'published'` values
//     but a distinct Postgres type — migration 001 keeps them separate so the
//     two domains can diverge later without a coupled migration).
//   - The slug-lock guard reads from `public.posts` and the trigger that
//     enforces immutability post-publish lives at `posts_prevent_slug_change`
//     (migration 006). Same defense-in-depth pattern: app omits `slug` from
//     the update payload when the existing row is published; DB trigger is
//     the layer-two guard.
// =============================================================================

/**
 * Zod schema for the create-post boundary.
 *
 * `title` mirrors the projects cap (200 chars) — the DB CHECK is identical.
 * `content` is the raw-Markdown body; required and non-empty (matches the
 * `posts.content_not_empty` CHECK in migration 001). CONSTRAINT-06: this
 * string flows to the DB verbatim — no HTML conversion, no rendering at
 * write time. `status` is the `post_status` enum; defaults to `'draft'`.
 */
export const postCreateSchema = z.object({
  title: z.string().trim().min(1, 'title is required').max(TITLE_MAX_LENGTH),
  content: z.string().min(1, 'content is required'),
  status: z.enum(['draft', 'published']).default('draft'),
});

/** Inferred input shape for {@link createPostInternal}. */
export type PostCreateInput = z.infer<typeof postCreateSchema>;

/**
 * Zod schema for the update-post boundary. Same shape as create — both
 * fields are required because the form re-submits the full row, not a patch.
 * The wrapper computes whether `slug` should be re-derived from the new title
 * (when the existing row is a `draft`) or omitted (when `published`).
 */
export const postUpdateSchema = z.object({
  title: z.string().trim().min(1, 'title is required').max(TITLE_MAX_LENGTH),
  content: z.string().min(1, 'content is required'),
  status: z.enum(['draft', 'published']),
});

/** Inferred input shape for {@link updatePostInternal}. */
export type PostUpdateInput = z.infer<typeof postUpdateSchema>;

/**
 * Insert a new post row.
 *
 * Boundary-validates the input with {@link postCreateSchema} (SEC-02),
 * derives the slug from `title` via {@link slugify}, and inserts via the
 * Supabase query builder (SEC-03). Slug uniqueness is enforced at the DB
 * (UNIQUE constraint on `posts.slug`) — a collision surfaces as a Postgres
 * `23505` and is wrapped in a {@link ServiceError} here, then swallowed to a
 * uniform state-error shape by the `'use server'` wrapper.
 *
 * CONSTRAINT-06: `content` is stored verbatim. The DB sees the exact string
 * the form submitted; no Markdown -> HTML conversion happens on the write
 * path. The T12 client renderer performs that transformation on read.
 *
 * Throws freely — the public Server Action in `lib/admin-mutations.ts`
 * catches and converts to the uniform state envelope so the wire shape is
 * indistinguishable across outcomes (`docs/auth-flow.md` §2a Channel 2).
 *
 * @param input  Raw create payload. Validated before any DB call.
 * @param client Optional injected client (DI seam for tests). Defaults to a
 *               request-scoped admin server client.
 * @returns The inserted post row.
 * @throws z.ZodError   when `input` fails boundary validation.
 * @throws ServiceError when the slug derives to empty, or Supabase rejects.
 */
export async function createPostInternal(
  input: unknown,
  client?: SupabaseClient,
): Promise<Post> {
  const parsed = postCreateSchema.parse(input);
  const slug = slugify(parsed.title);
  if (slug.length === 0) {
    throw new ServiceError('slug derives to empty from title', {
      operation: CREATE_POST_OPERATION,
      cause: new Error('slugify(title) returned an empty string'),
    });
  }
  const supabase = client ?? (await createServerClient());
  const payload = {
    title: parsed.title,
    content: parsed.content,
    status: parsed.status,
    slug,
  };
  const { data, error } = await supabase
    .from('posts')
    .insert(payload)
    .select()
    .single();
  if (error) {
    logMutationError(CREATE_POST_OPERATION, error);
    throw new ServiceError(`${CREATE_POST_OPERATION} failed`, {
      operation: CREATE_POST_OPERATION,
      cause: error,
    });
  }
  return data as Post;
}

/**
 * Update an existing post row.
 *
 * 1. Boundary-validates the input with {@link postUpdateSchema} (SEC-02).
 * 2. Pre-fetches the row's current `status` to know whether the slug-lock
 *    rule applies. CONSTRAINT-12: the slug becomes immutable when the row is
 *    `published`. App-side omit is layer one; the migration 006 trigger
 *    `posts_prevent_slug_change` is the DB-side guard (layer two).
 * 3. Builds the update payload — `slug` is included only when the existing
 *    row is `draft`. The wrapper's try/catch swallows any trigger violation
 *    to a uniform error shape, so even if the app-side omit logic ever
 *    regresses, the wire response stays indistinguishable.
 *
 * CONSTRAINT-06: `content` flows through verbatim on every update.
 *
 * @param id     UUID of the post to update.
 * @param input  Raw update payload. Validated before any DB call.
 * @param client Optional injected client (DI seam for tests).
 * @returns The updated post row.
 * @throws z.ZodError   when `input` fails boundary validation.
 * @throws ServiceError when `id` is empty, the row is not found, or Supabase
 *                     rejects (including the slug-lock trigger raising).
 */
export async function updatePostInternal(
  id: string,
  input: unknown,
  client?: SupabaseClient,
): Promise<Post> {
  if (typeof id !== 'string' || id.length === 0) {
    throw new ServiceError('invalid id argument', {
      operation: UPDATE_POST_OPERATION,
      cause: new Error(`id must be a non-empty string, got: ${typeof id}`),
    });
  }
  const parsed = postUpdateSchema.parse(input);
  const supabase = client ?? (await createServerClient());

  const { data: existing, error: fetchError } = await supabase
    .from('posts')
    .select('status')
    .eq('id', id)
    .single();
  if (fetchError) {
    logMutationError(UPDATE_POST_OPERATION, fetchError);
    throw new ServiceError(`${UPDATE_POST_OPERATION} failed`, {
      operation: UPDATE_POST_OPERATION,
      cause: fetchError,
    });
  }
  const isPublished =
    (existing as { status: PostStatus }).status === POST_PUBLISHED;

  const payload: Record<string, unknown> = {
    title: parsed.title,
    content: parsed.content,
    status: parsed.status,
  };
  if (!isPublished) {
    const slug = slugify(parsed.title);
    if (slug.length === 0) {
      throw new ServiceError('slug derives to empty from title', {
        operation: UPDATE_POST_OPERATION,
        cause: new Error('slugify(title) returned an empty string'),
      });
    }
    payload.slug = slug;
  }

  const { data, error } = await supabase
    .from('posts')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error) {
    logMutationError(UPDATE_POST_OPERATION, error);
    throw new ServiceError(`${UPDATE_POST_OPERATION} failed`, {
      operation: UPDATE_POST_OPERATION,
      cause: error,
    });
  }
  return data as Post;
}

/**
 * Hard-delete a post row by id.
 *
 * CONSTRAINT-10: hard-delete only — no soft-delete column, no tombstone, no
 * undo. Recovery from accidental delete is via Supabase backups; the confirm
 * modal at the UI boundary (mirrors the T22 pattern) is the only undo path.
 *
 * Validates `id` is a non-empty string before any DB call (SEC-02). Deletes
 * via the Supabase query builder (SEC-03). Throws freely — the public Server
 * Action in `lib/admin-mutations.ts` catches and converts to the uniform
 * state envelope so the wire shape is indistinguishable across outcomes
 * (`docs/auth-flow.md` §2a Channel 2).
 *
 * Note: Supabase `.delete()` does not error when the row does not exist —
 * the operation is idempotent at the SQL level. A missing row therefore
 * resolves successfully; callers wanting "not found" semantics should pre-
 * fetch via `getPostById` (the UI modal opens against a row already on
 * screen).
 *
 * @param id     UUID of the post to delete. Must be a non-empty string.
 * @param client Optional injected client (DI seam for tests). Defaults to a
 *               request-scoped admin server client.
 * @throws ServiceError when `id` is empty or whitespace, or Supabase rejects.
 */
export async function deletePostInternal(
  id: string,
  client?: SupabaseClient,
): Promise<void> {
  if (typeof id !== 'string' || id.trim().length === 0) {
    throw new ServiceError('invalid id argument', {
      operation: DELETE_POST_OPERATION,
      cause: new Error(`id must be a non-empty string, got: ${typeof id}`),
    });
  }
  const supabase = client ?? (await createServerClient());
  const { error } = await supabase.from('posts').delete().eq('id', id);
  if (error) {
    logMutationError(DELETE_POST_OPERATION, error);
    throw new ServiceError(`${DELETE_POST_OPERATION} failed`, {
      operation: DELETE_POST_OPERATION,
      cause: error,
    });
  }
}

// =============================================================================
// Stats (T24) — same six-channel uniformity discipline as projects and posts.
//
// Differences from the project / post helpers:
//   - No slug, no status, no edit. CONSTRAINT-10: stats are insert-or-delete
//     only; corrections are delete-then-reinsert. The form surface is
//     `insertStat`; the row management surface is `deleteStat`. There is no
//     `updateStat` helper.
//   - The data model is wider on user-supplied text (four fields:
//     `category`, `label`, `value`, `unit`) but the `unit` column is nullable
//     in migration 001. The zod schema treats whitespace-only or empty `unit`
//     submissions as absent and the insert payload writes explicit `null` for
//     those cases (rather than an empty string) so the DB shape stays clean.
//   - No DB triggers fire on stats (no slug-lock equivalent). The whole write
//     path is a single boundary-validated INSERT and a single id-validated
//     DELETE.
// =============================================================================

/**
 * Zod schema for the insert-stat boundary.
 *
 * All four fields are read as text; `category`, `label`, and `value` are
 * required non-empty (matches the DB CHECKs in migration 001 — defense in
 * depth at the app boundary). `unit` is optional — empty strings and
 * whitespace-only inputs preprocess to `undefined` so the wrapper can write
 * an explicit `null` to the column (the migration declares `unit text null`).
 * Every field is capped at {@link STAT_FIELD_MAX_LENGTH} as an app-side
 * pathological-input bound.
 */
export const statInsertSchema = z.object({
  category: z
    .string()
    .trim()
    .min(1, 'category is required')
    .max(STAT_FIELD_MAX_LENGTH),
  label: z
    .string()
    .trim()
    .min(1, 'label is required')
    .max(STAT_FIELD_MAX_LENGTH),
  value: z
    .string()
    .trim()
    .min(1, 'value is required')
    .max(STAT_FIELD_MAX_LENGTH),
  unit: z.preprocess(
    (v) => (typeof v === 'string' && v.trim().length === 0 ? undefined : v),
    z.string().trim().min(1).max(STAT_FIELD_MAX_LENGTH).optional(),
  ),
});

/** Inferred input shape for {@link insertStatInternal}. */
export type StatInsertInput = z.infer<typeof statInsertSchema>;

/**
 * Insert a new stat row.
 *
 * Boundary-validates the input with {@link statInsertSchema} (SEC-02) and
 * inserts via the Supabase query builder (SEC-03). `unit` is normalised to
 * an explicit `null` when absent so the column receives a clean NULL rather
 * than an empty string.
 *
 * No slug derivation, no pre-fetch — stats are insert-only with no
 * relational integrity beyond the per-row CHECK constraints.
 *
 * Throws freely — the public Server Action in `lib/admin-mutations.ts`
 * catches and converts to the uniform state envelope so the wire shape is
 * indistinguishable across outcomes (`docs/auth-flow.md` §2a Channel 2).
 *
 * @param input  Raw insert payload. Validated before any DB call.
 * @param client Optional injected client (DI seam for tests). Defaults to a
 *               request-scoped admin server client.
 * @returns The inserted stat row.
 * @throws z.ZodError   when `input` fails boundary validation.
 * @throws ServiceError when Supabase rejects (e.g., RLS denial).
 */
export async function insertStatInternal(
  input: unknown,
  client?: SupabaseClient,
): Promise<Stat> {
  const parsed = statInsertSchema.parse(input);
  const supabase = client ?? (await createServerClient());
  const payload = {
    category: parsed.category,
    label: parsed.label,
    value: parsed.value,
    unit: parsed.unit ?? null,
  };
  const { data, error } = await supabase
    .from('stats')
    .insert(payload)
    .select()
    .single();
  if (error) {
    logMutationError(INSERT_STAT_OPERATION, error);
    throw new ServiceError(`${INSERT_STAT_OPERATION} failed`, {
      operation: INSERT_STAT_OPERATION,
      cause: error,
    });
  }
  return data as Stat;
}

/**
 * Hard-delete a stat row by id.
 *
 * CONSTRAINT-10: hard-delete only — no soft-delete column, no tombstone, no
 * undo. Recovery from accidental delete is via Supabase backups; the confirm
 * modal at the UI boundary (mirrors the T22 / T23 pattern) is the only undo
 * path.
 *
 * Validates `id` is a non-empty string before any DB call (SEC-02). Deletes
 * via the Supabase query builder (SEC-03). Throws freely — the public Server
 * Action in `lib/admin-mutations.ts` catches and converts to the uniform
 * state envelope so the wire shape is indistinguishable across outcomes
 * (`docs/auth-flow.md` §2a Channel 2).
 *
 * Note: Supabase `.delete()` does not error when the row does not exist —
 * the operation is idempotent at the SQL level. A missing row therefore
 * resolves successfully; the admin UI modal opens against a row already on
 * screen so the "not found" case is unreachable in practice.
 *
 * @param id     UUID of the stat to delete. Must be a non-empty string.
 * @param client Optional injected client (DI seam for tests). Defaults to a
 *               request-scoped admin server client.
 * @throws ServiceError when `id` is empty or whitespace, or Supabase rejects.
 */
export async function deleteStatInternal(
  id: string,
  client?: SupabaseClient,
): Promise<void> {
  if (typeof id !== 'string' || id.trim().length === 0) {
    throw new ServiceError('invalid id argument', {
      operation: DELETE_STAT_OPERATION,
      cause: new Error(`id must be a non-empty string, got: ${typeof id}`),
    });
  }
  const supabase = client ?? (await createServerClient());
  const { error } = await supabase.from('stats').delete().eq('id', id);
  if (error) {
    logMutationError(DELETE_STAT_OPERATION, error);
    throw new ServiceError(`${DELETE_STAT_OPERATION} failed`, {
      operation: DELETE_STAT_OPERATION,
      cause: error,
    });
  }
}
