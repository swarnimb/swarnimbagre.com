/**
 * Pure types + consts for the admin IMAGES mutation surface.
 *
 * This module is the client-safe envelope for image admin mutations. It
 * carries no runtime dependencies on `next/headers`, Supabase, or zod —
 * only the shape contracts the wrappers and the form share. The throwing
 * helpers (`uploadImageInternal`) live in
 * `lib/admin-images-mutations-internal.ts` and the Server Action wrappers
 * live in `lib/admin-images-mutations.ts`; both transitively import
 * `next/headers` via the Supabase server-client factory, which would break
 * any client component that imports from them.
 *
 * `ImageUpload.tsx` is a `'use client'` component; it imports ONLY from
 * this module. The Server Action functions themselves cross the boundary
 * as Server Action references via Next.js's transform — no runtime import
 * is needed on the client side.
 *
 * `GENERIC_FORM_ERROR` is NOT re-exported here — it is the canonical
 * cross-resource string in `lib/auth-constants.ts`; consumers import it
 * from there.
 *
 * **Constants location deviation from the project / post / stat trios:**
 * the file-related constants (`IMAGES_BUCKET`, `MAX_FILE_BYTES`,
 * `ALLOWED_MIME_TYPES`, `ALT_TEXT_MAX_LENGTH`, `ALLOWED_PARENT_TYPES`)
 * live here rather than in `-internal.ts` so the client component can
 * import them for the file-input `accept` attribute and the size pre-check
 * without dragging `next/headers` into the client module graph. The
 * `-internal.ts` module re-imports them from here for the throwing layer.
 *
 * **`image?: ImageRecord` payload deviation from the other three resource
 * envelopes:** `ProjectMutationState`, `PostMutationState`, and
 * `StatMutationState` carry no payload on success because their forms
 * either redirect (`createProject` → `/admin/projects/[id]`) or refresh
 * the page (`insertStat` → `router.refresh()`). The image upload
 * component is contractually required by the T25 spec to call
 * `onUpload(image)` with the inserted row so the parent form (T26 wiring)
 * can update its `image_id` field; the cleanest way to thread the row
 * through `useActionState` is on the success envelope. This module is the
 * single source of truth for that deviation.
 */

import type { ImageRecord } from './types';

/** Storage bucket name. Mirrors the bucket configured by hand in the Supabase
 * Dashboard — see comment block at the end of
 * `supabase/migrations/005_rls_images.sql`. */
export const IMAGES_BUCKET = 'images';

// 2 MB; mirrors bucket policy in supabase/migrations/005_rls_images.sql
export const MAX_FILE_BYTES = 2 * 1024 * 1024;

/** MIME types the upload boundary accepts. Mirrors the bucket-level allowlist
 * configured in the Supabase Dashboard (see migration 005 trailing comment).
 * SVG is intentionally excluded — the rendered-HTML attack surface is wider
 * than raster formats and the use case (project / post hero images) is
 * raster-only. */
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

// app-side bound; alt_text DB column has no length cap
export const ALT_TEXT_MAX_LENGTH = 500;

/** Parent-row table names this upload surface accepts. Mirrors the
 * `images.parent_type` enum in migration 001. */
export const ALLOWED_PARENT_TYPES = ['projects', 'posts'] as const;

/**
 * Discriminated state shape returned by every admin IMAGE mutation Server
 * Action (T25). Same envelope shape as the project / post / stat equivalents
 * with the `fieldErrors` keys narrowed to the fields the upload form actually
 * owns (`file`, `altText`, `parentType`, `parentId`).
 *
 * **Payload deviation:** `image?: ImageRecord` is present on success only.
 * The other three resource envelopes carry no payload because their forms
 * redirect / refresh; the upload form must hand the inserted row to its
 * parent via `onUpload(image)`, so the row rides the success envelope.
 * Documented at length in the module JSDoc above.
 */
export interface ImageMutationState {
  /** `'idle'` is the initial state used by `useActionState`. */
  status: 'idle' | 'ok' | 'error';
  /** Field-level zod errors, keyed by schema field name. */
  fieldErrors?: Partial<
    Record<'file' | 'altText' | 'parentType' | 'parentId', string>
  >;
  /** Form-level error (Storage failure, RLS denial, etc.). Generic copy. */
  formError?: string;
  /** Inserted image row on success — the only resource envelope that carries
   * a payload. Consumers (e.g. `ImageUpload`'s `onUpload` callback) read this
   * to thread the new row up to the parent form (T26 wiring). */
  image?: ImageRecord;
}

/** Initial state shipped to `useActionState` for image mutations. */
export const IMAGE_MUTATION_INITIAL_STATE: ImageMutationState = {
  status: 'idle',
};
