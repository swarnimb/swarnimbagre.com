import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { createServerClient } from './supabase';
import { ServiceError } from './errors';
import type { ImageRecord } from './types';
import {
  ALLOWED_MIME_TYPES,
  ALLOWED_PARENT_TYPES,
  ALT_TEXT_MAX_LENGTH,
  IMAGES_BUCKET,
  MAX_FILE_BYTES,
} from './admin-images-mutations-types';

/**
 * Module note (F-14 analogue, applied to IMAGE mutations).
 *
 * This file deliberately does NOT carry the `'use server'` directive. Every
 * export of a `'use server'` module becomes a publicly-addressable Server
 * Action with a stable hashed ID in the client bundle; co-locating these
 * throwing helpers next to the non-throwing wrappers in
 * `lib/admin-images-mutations.ts` would expose them as additional RPC
 * endpoints and defeat the Channel 4 (Server Action surface) discipline
 * documented in `docs/auth-flow.md` §2a point 4. The split mirrors
 * `lib/auth-internal.ts` vs `lib/auth.ts`: thrown errors are confined to
 * this module, and the wrapper in `lib/admin-images-mutations.ts` is the
 * only Server Action surface.
 *
 * Pure types + consts shared with the client form live in a separate
 * `lib/admin-images-mutations-types.ts` because this module transitively
 * imports `next/headers` via `createServerClient` from `./supabase`, which
 * is not allowed in a Client Component's module graph. The file-related
 * constants (`IMAGES_BUCKET`, `MAX_FILE_BYTES`, `ALLOWED_MIME_TYPES`,
 * `ALT_TEXT_MAX_LENGTH`, `ALLOWED_PARENT_TYPES`) live in the `-types.ts`
 * sibling for the same reason — `ImageUpload.tsx` reads them at render
 * time for the file-input `accept` attribute and the size pre-check.
 *
 * This is the per-resource throwing-helpers module per `architecture.md`
 * §6.6.6 (per-resource pattern). Sibling files: `-types.ts` (client-safe
 * envelope) and `-mutations.ts` (`'use server'` wrappers).
 *
 * **Path scheme (CONSTRAINT-07):** uploaded objects land at
 * `images/{parentType}/{parentId}/{uuid}_{filename}` where `{filename}`
 * is the sanitised version of `File.name`. The leading `images/` segment
 * is the bucket-internal path prefix (the bucket itself is also called
 * `images`); the parentType/parentId tier scopes objects per parent row.
 *
 * **Compensating-delete invariant:** if `storage.upload` succeeds but the
 * subsequent `images` row insert fails, this module attempts to remove the
 * orphan storage object before re-throwing. If that compensating delete
 * itself fails, the failure is logged loudly with the bucket path; the
 * primary insert error is the one surfaced to the caller (the user-facing
 * concern is "your upload didn't save", not "we leaked a storage object").
 */

/** Operation tag for upload-side logs and ServiceError instances. */
const UPLOAD_IMAGE_OPERATION = 'uploadImage';

/** Cap on sanitised filename length (post-sanitise) before extension. Hard
 * upper bound on the path length each upload contributes to Storage. */
const FILENAME_MAX_LENGTH = 100;

/**
 * Log a Supabase error (or a structured payload) without leaking row data or
 * PII. Matches the shape of `logDbError` in `lib/db.ts` and the sibling
 * `logMutationError` helpers in the project / post / stat trios so structured
 * logs are uniform across the data layer (EH-02, EH-03, SEC-05).
 */
function logMutationError(
  operation: string,
  payload: Record<string, unknown>,
): void {
  console.error(`[admin-mutations] ${operation} failed`, {
    operation,
    ...payload,
    stack: new Error().stack,
  });
}

/**
 * Zod schema for the upload-image metadata boundary.
 *
 * Validates the three text-shaped inputs only — the file itself is validated
 * separately by {@link validateFile} so the `assertions is File` narrowing
 * stays clean. `parentType` is the `images.parent_type` enum (mirrored from
 * migration 001 via `ALLOWED_PARENT_TYPES`); `parentId` is a UUID — this is
 * the path-injection guard, since a non-UUID `parentId` like
 * `'../../etc/passwd'` would otherwise shape the bucket path. `altText` is
 * required and capped — empty alt text is a useless image record (and a
 * Channel 1 leak vector if surfaced via the alt attribute).
 */
export const uploadImageSchema = z.object({
  parentType: z.enum(ALLOWED_PARENT_TYPES),
  parentId: z.string().uuid('parentId must be a uuid'),
  altText: z
    .string()
    .trim()
    .min(1, 'alt text is required')
    .max(ALT_TEXT_MAX_LENGTH),
}).strict();

/** Inferred input shape (post-parse) for the upload metadata. */
export type UploadImageInput = z.infer<typeof uploadImageSchema>;

/**
 * Type-narrowing file validator. Throws a `ServiceError` if the input is not
 * a `File`, the MIME type is not in {@link ALLOWED_MIME_TYPES}, or the size
 * exceeds {@link MAX_FILE_BYTES}. Extracted from `uploadImageInternal` so
 * the orchestrator stays under the CQ-01 80-line cap.
 *
 * @param file Raw input from FormData. Treated as `unknown` so the call site
 *             does not need to pre-check the runtime shape.
 * @throws ServiceError when `file` is not a File, its MIME type is not
 *                     allow-listed, or its size exceeds the boundary.
 */
export function validateFile(file: unknown): asserts file is File {
  if (!(file instanceof File)) {
    throw new ServiceError('file argument is not a File', {
      operation: UPLOAD_IMAGE_OPERATION,
      cause: new Error(`expected File, got ${typeof file}`),
    });
  }
  if (
    !(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)
  ) {
    throw new ServiceError('file type not allowed', {
      operation: UPLOAD_IMAGE_OPERATION,
      cause: new Error(`MIME type ${file.type} not in allowlist`),
    });
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new ServiceError('file exceeds size limit', {
      operation: UPLOAD_IMAGE_OPERATION,
      cause: new Error(
        `size ${file.size} exceeds ${MAX_FILE_BYTES} byte boundary`,
      ),
    });
  }
}

/**
 * Sanitise a raw filename to a safe ASCII slug, preserving the extension.
 *
 * Strips path separators (`/`, `\`), control characters, and NUL; collapses
 * everything else to `[A-Za-z0-9._-]`. Caps the basename at
 * {@link FILENAME_MAX_LENGTH}. Throws if the sanitised result is empty —
 * the upload boundary then surfaces a generic-error envelope rather than
 * letting an empty-name object hit Storage.
 *
 * @param raw The original `File.name`.
 * @returns The sanitised filename.
 * @throws ServiceError when the sanitised result is empty.
 */
export function sanitizeFilename(raw: string): string {
  if (typeof raw !== 'string' || raw.length === 0) {
    throw new ServiceError('filename is empty', {
      operation: UPLOAD_IMAGE_OPERATION,
      cause: new Error('File.name was empty or non-string'),
    });
  }
  // Split off extension (if any) — sanitise base + ext separately so the dot
  // isn't collapsed away.
  const lastDot = raw.lastIndexOf('.');
  const baseRaw = lastDot > 0 ? raw.slice(0, lastDot) : raw;
  const extRaw = lastDot > 0 ? raw.slice(lastDot + 1) : '';

  // Collapse separators, control chars, NUL, and any non-safe ASCII to `_`.
  // Then trim leading/trailing separators.
  const sanitiseSegment = (s: string): string =>
    s
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x1f\x7f/\\]/g, '_')
      .replace(/[^A-Za-z0-9._-]/g, '_')
      .replace(/^[._-]+|[._-]+$/g, '');

  const baseSafe = sanitiseSegment(baseRaw).slice(0, FILENAME_MAX_LENGTH);
  const extSafe = sanitiseSegment(extRaw).slice(0, 16);

  if (baseSafe.length === 0) {
    throw new ServiceError('filename sanitised to empty', {
      operation: UPLOAD_IMAGE_OPERATION,
      cause: new Error(`sanitiseFilename(${raw}) collapsed to empty`),
    });
  }
  return extSafe.length > 0 ? `${baseSafe}.${extSafe}` : baseSafe;
}

/**
 * Upload a file to Storage and insert the matching `images` row.
 *
 * 1. Validates the file with {@link validateFile} (SEC-02 — type + size
 *    boundary).
 * 2. Boundary-validates the metadata with {@link uploadImageSchema} (SEC-02 —
 *    `parentType` allowlist, `parentId` UUID guard, `altText` non-empty +
 *    capped). The UUID check on `parentId` is also the path-injection
 *    guard — a non-UUID would shape the bucket path.
 * 3. Generates a UUID via `crypto.randomUUID()` and constructs the bucket
 *    path `images/{parentType}/{parentId}/{uuid}_{filename}` (CONSTRAINT-07).
 * 4. Uploads the file to Storage via the Supabase SDK (SEC-01 — no hardcoded
 *    URLs). On error: logs structured + throws ServiceError.
 * 5. Inserts a matching row into `public.images`. On error: attempts a
 *    compensating `storage.remove([bucketPath])` to keep Storage clean. If
 *    the compensating delete itself fails, logs loudly with both error
 *    payloads; the primary insert error is the one surfaced.
 *
 * Throws freely — the public Server Action in
 * `lib/admin-images-mutations.ts` catches and converts to the uniform state
 * envelope so the wire shape is indistinguishable across outcomes
 * (`docs/auth-flow.md` §2a Channel 2).
 *
 * @param input  Raw upload payload — `file`, `parentType`, `parentId`,
 *               `altText`. All four flow through validation before any I/O.
 * @param client Optional injected client (DI seam for tests). Defaults to a
 *               request-scoped admin server client.
 * @returns The inserted image row.
 * @throws z.ZodError   when metadata fails boundary validation.
 * @throws ServiceError when the file fails validation, Storage rejects,
 *                     or the row insert rejects (after attempted compensating
 *                     delete).
 */
export async function uploadImageInternal(
  input: {
    file: unknown;
    parentType: unknown;
    parentId: unknown;
    altText: unknown;
  },
  client?: SupabaseClient,
): Promise<ImageRecord> {
  validateFile(input.file);
  const parsed = uploadImageSchema.parse({
    parentType: input.parentType,
    parentId: input.parentId,
    altText: input.altText,
  });
  const uuid = crypto.randomUUID();
  const safeName = sanitizeFilename(input.file.name);
  const bucketPath = `images/${parsed.parentType}/${parsed.parentId}/${uuid}_${safeName}`;
  const supabase = client ?? (await createServerClient());

  const { error: uploadErr } = await supabase.storage
    .from(IMAGES_BUCKET)
    .upload(bucketPath, input.file, {
      contentType: input.file.type,
      upsert: false,
    });
  if (uploadErr) {
    logMutationError(UPLOAD_IMAGE_OPERATION, {
      bucketPath,
      errorMessage: uploadErr.message ?? null,
    });
    throw new ServiceError(`${UPLOAD_IMAGE_OPERATION} upload failed`, {
      operation: UPLOAD_IMAGE_OPERATION,
      cause: uploadErr,
    });
  }

  const { data, error: insertErr } = await supabase
    .from('images')
    .insert({
      bucket_path: bucketPath,
      alt_text: parsed.altText,
      parent_id: parsed.parentId,
      parent_type: parsed.parentType,
    })
    .select()
    .single();
  if (insertErr) {
    // Compensating delete — keep Storage clean. The primary error is the
    // insert failure; the compensating delete result does not change what
    // we surface to the caller. If the compensating delete itself fails,
    // log loudly so the orphan can be cleaned up out-of-band.
    const { error: removeErr } = await supabase.storage
      .from(IMAGES_BUCKET)
      .remove([bucketPath]);
    if (removeErr) {
      logMutationError(UPLOAD_IMAGE_OPERATION, {
        bucketPath,
        primaryErrorMessage: insertErr.message ?? null,
        compensatingDeleteErrorMessage: removeErr.message ?? null,
      });
    } else {
      logMutationError(UPLOAD_IMAGE_OPERATION, {
        bucketPath,
        errorCode: insertErr.code ?? null,
        errorMessage: insertErr.message ?? null,
      });
    }
    throw new ServiceError(`${UPLOAD_IMAGE_OPERATION} insert failed`, {
      operation: UPLOAD_IMAGE_OPERATION,
      cause: insertErr,
    });
  }
  return data as ImageRecord;
}
