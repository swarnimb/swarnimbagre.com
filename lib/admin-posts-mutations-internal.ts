import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { createServerClient } from './supabase';
import { ServiceError } from './errors';
import type { Post, PostStatus } from './types';
import { orphanIfChanged } from './admin-images-orphan';
import { deriveSlugOrThrow } from './admin-slug';
import { logSupabaseError } from './admin-mutation-log';

/**
 * Module note (F-14 analogue, applied to POST mutations).
 *
 * This file deliberately does NOT carry the `'use server'` directive. Every
 * export of a `'use server'` module becomes a publicly-addressable Server
 * Action with a stable hashed ID in the client bundle; co-locating these
 * throwing helpers next to the non-throwing wrappers in
 * `lib/admin-posts-mutations.ts` would expose them as additional RPC
 * endpoints and defeat the Channel 4 (Server Action surface) discipline
 * documented in `docs/auth-flow.md` §2a point 4. The split mirrors
 * `lib/auth-internal.ts` vs `lib/auth.ts`: thrown errors are confined to
 * this module, and the wrapper in `lib/admin-posts-mutations.ts` is the
 * only Server Action surface.
 *
 * Pure types + consts shared with the client form live in a separate
 * `lib/admin-posts-mutations-types.ts` because this module transitively
 * imports `next/headers` via `createServerClient` from `./supabase`, which
 * is not allowed in a Client Component's module graph.
 *
 * This is the per-resource throwing-helpers module per `architecture.md`
 * §6.6.6 (per-resource pattern). Sibling files: `-types.ts` (client-safe
 * envelope) and `-mutations.ts` (`'use server'` wrappers).
 *
 * Differences from the project helpers:
 *   - `content` (raw Markdown) replaces `description`. CONSTRAINT-06: stored
 *     verbatim — no HTML conversion, no sanitization at write time. Rendering
 *     and sanitization happen at read time via the T12 client renderer.
 *   - The status enum is `post_status` (same `'draft' | 'published'` values
 *     but a distinct Postgres type — migration 001 keeps them separate so
 *     the two domains can diverge later without a coupled migration).
 *   - The slug-lock guard reads from `public.posts` and the trigger that
 *     enforces immutability post-publish lives at `posts_prevent_slug_change`
 *     (migration 006). Same defense-in-depth pattern: app omits `slug` from
 *     the update payload when the existing row is published; DB trigger is
 *     the layer-two guard.
 */

/**
 * Maximum title length. Mirrors the `text` column's CHECK in migration 001
 * (`posts.title length <= 200`).
 */
const TITLE_MAX_LENGTH = 200;

/** Operation tag for post create-side logs and ServiceError instances. */
const CREATE_POST_OPERATION = 'createPost';
/** Operation tag for post update-side logs and ServiceError instances. */
const UPDATE_POST_OPERATION = 'updatePost';
/** Operation tag for post delete-side logs and ServiceError instances. */
const DELETE_POST_OPERATION = 'deletePost';

/** Status literal used to gate the slug-lock rule on post edit. */
const POST_PUBLISHED: PostStatus = 'published';

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
}).strict();

/** Inferred input shape for {@link createPostInternal}. */
export type PostCreateInput = z.infer<typeof postCreateSchema>;

/**
 * Zod schema for the update-post boundary. Same shape as create plus an
 * optional `image_id` (T26 image-upload wiring) — both text fields are
 * required because the form re-submits the full row, not a patch. The
 * wrapper computes whether `slug` should be re-derived from the new title
 * (when the existing row is a `draft`) or omitted (when `published`).
 *
 * `image_id` is a UUID-or-null: the FormData read in
 * `admin-posts-mutations.ts` coerces an empty string to `null` BEFORE the
 * schema runs, so the parser only ever sees the post-coercion shape. A
 * non-null value must be a valid UUID — anything else is rejected at the
 * boundary (SEC-02).
 */
export const postUpdateSchema = z.object({
  title: z.string().trim().min(1, 'title is required').max(TITLE_MAX_LENGTH),
  content: z.string().min(1, 'content is required'),
  status: z.enum(['draft', 'published']),
  image_id: z.string().uuid('image_id must be a uuid').nullable(),
}).strict();

/** Inferred input shape for {@link updatePostInternal}. */
export type PostUpdateInput = z.infer<typeof postUpdateSchema>;

/**
 * Pre-fetch `status` (slug-lock gate, CONSTRAINT-12) and `image_id`
 * (orphan-on-swap source, T26) for {@link updatePostInternal}. Extracted
 * to keep the orchestrator under CQ-01's 50-line cap.
 *
 * @throws ServiceError on any Supabase error.
 */
async function fetchExistingPost(
  client: SupabaseClient,
  id: string,
): Promise<{ status: PostStatus; image_id: string | null }> {
  const { data, error } = await client
    .from('posts')
    .select('status, image_id')
    .eq('id', id)
    .single();
  if (error) {
    logSupabaseError(UPDATE_POST_OPERATION, error);
    throw new ServiceError(`${UPDATE_POST_OPERATION} failed`, {
      operation: UPDATE_POST_OPERATION,
      cause: error,
    });
  }
  return data as { status: PostStatus; image_id: string | null };
}

/**
 * Insert a new post row.
 *
 * Boundary-validates the input with {@link postCreateSchema} (SEC-02),
 * derives the slug from `title` via {@link deriveSlugOrThrow}, and inserts via the
 * Supabase query builder (SEC-03). Slug uniqueness is enforced at the DB
 * (UNIQUE constraint on `posts.slug`) — a collision surfaces as a Postgres
 * `23505` and is wrapped in a {@link ServiceError} here, then swallowed to a
 * uniform state-error shape by the `'use server'` wrapper.
 *
 * CONSTRAINT-06: `content` is stored verbatim. The DB sees the exact string
 * the form submitted; no Markdown -> HTML conversion happens on the write
 * path. The T12 client renderer performs that transformation on read.
 *
 * Throws freely — the public Server Action in `lib/admin-posts-mutations.ts`
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
  const slug = deriveSlugOrThrow(parsed.title, CREATE_POST_OPERATION);
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
    logSupabaseError(CREATE_POST_OPERATION, error);
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
  const existingRow = await fetchExistingPost(supabase, id);
  const isPublished = existingRow.status === POST_PUBLISHED;

  const payload: Record<string, unknown> = {
    title: parsed.title,
    content: parsed.content,
    status: parsed.status,
    image_id: parsed.image_id,
  };
  if (!isPublished) {
    payload.slug = deriveSlugOrThrow(parsed.title, UPDATE_POST_OPERATION);
  }

  const { data, error } = await supabase
    .from('posts')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error) {
    logSupabaseError(UPDATE_POST_OPERATION, error);
    throw new ServiceError(`${UPDATE_POST_OPERATION} failed`, {
      operation: UPDATE_POST_OPERATION,
      cause: error,
    });
  }
  // T26: detach previous image on swap. See `orphanIfChanged` for rationale.
  await orphanIfChanged(
    supabase, UPDATE_POST_OPERATION, id,
    existingRow.image_id, parsed.image_id,
  );
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
 * Action in `lib/admin-posts-mutations.ts` catches and converts to the
 * uniform state envelope so the wire shape is indistinguishable across
 * outcomes (`docs/auth-flow.md` §2a Channel 2).
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
    logSupabaseError(DELETE_POST_OPERATION, error);
    throw new ServiceError(`${DELETE_POST_OPERATION} failed`, {
      operation: DELETE_POST_OPERATION,
      cause: error,
    });
  }
}
