import type { ZodError } from 'zod';
import type {
  ProjectMutationFieldName,
  ProjectMutationState,
} from './admin-projects-mutations-types';

/**
 * FormData readers and the zod-error field mapper for the PROJECT mutation
 * surface.
 *
 * Split out of `lib/admin-projects-mutations.ts` at audit 24 (F-39 remediation
 * session): that module had reached 319 lines against the CQ-02 300-line cap.
 * It shipped over the cap at 309 in T46 and the F-39 guard wiring pushed it
 * further, so the seam was taken here rather than deferred again.
 *
 * This file deliberately does NOT carry the `'use server'` directive. These
 * helpers were module-private inside the Server Action module, which is what
 * kept them off the public action surface; exporting them from a directive-free
 * module preserves that property (SEC-08). They are pure functions over
 * `FormData` and `ZodError` with no Supabase client, no `next/headers` import,
 * and no session dependency.
 *
 * Nothing here validates. Every reader returns a raw or lightly-normalized
 * value that flows through to the zod schemas in
 * `lib/admin-projects-mutations-schemas.ts`, which remain the single
 * authoritative boundary (SEC-02).
 */

/**
 * Allowlist of zod-error keys we surface to the form. Anything outside this
 * set is dropped to avoid leaking shape information through Channel 1.
 *
 * Updated in T42 to cover the six new content-model fields. Kept as a Set
 * (not a switch) so adding fields touches data, not control flow.
 */
const ALLOWED_FIELD_KEYS: ReadonlySet<ProjectMutationFieldName> = new Set([
  'title',
  'description',
  'status',
  'github_url',
  'live_url',
  'subtitle',
  'tags',
  'image_after_id',
  'post_id',
]);

/** Type guard: narrow an unknown zod-path key into the allowed-fields union. */
function isAllowedFieldKey(value: unknown): value is ProjectMutationFieldName {
  return (
    typeof value === 'string' &&
    ALLOWED_FIELD_KEYS.has(value as ProjectMutationFieldName)
  );
}

/**
 * Convert a `ZodError` into the per-field state shape. Only the fields in
 * {@link ALLOWED_FIELD_KEYS} are surfaced; any other key in the error tree
 * is ignored — Channel 1 (UI text) requires we leak no shape information
 * beyond the form's declared fields.
 *
 * @param err The zod error thrown at the validation boundary.
 * @returns Per-field messages for the allowed fields only.
 */
export function projectZodErrorToFieldErrors(
  err: ZodError,
): ProjectMutationState['fieldErrors'] {
  const fieldErrors: ProjectMutationState['fieldErrors'] = {};
  for (const issue of err.issues) {
    const key = issue.path[0];
    if (isAllowedFieldKey(key)) {
      // Keep the first message per field; later issues for the same field are
      // less informative for the user (zod emits them in order).
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}

/**
 * Read a FormData field as a trimmed non-empty string, or `null` if empty
 * or missing. Used for every nullable text field — URLs, image FK ids,
 * `subtitle`. Mirrors the empty-string-to-null convention that the zod
 * schemas (`.nullable()`) expect at the boundary.
 *
 * @param formData Raw submitted form data.
 * @param key      Field name to read.
 * @returns The trimmed value, or `null` when empty or absent.
 */
export function readNullableTrimmed(
  formData: FormData,
  key: string,
): string | null {
  const raw = formData.get(key);
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * Read the comma-separated `tags` field into a trimmed string array, or
 * `null` when the field is empty or missing.
 *
 * The form submits one comma-separated text input rather than a repeated
 * field, because a handful of short tags is faster to type than it is to
 * manage as a widget. Blank segments are dropped here so a trailing comma
 * ("a, b,") does not produce an empty tag; the zod schema still rejects
 * whitespace-only entries that survive, which is the case the DB CHECK
 * cannot catch on its own.
 *
 * @param formData Raw submitted form data.
 * @returns The parsed tag list, or `null` when no tags were supplied.
 */
export function readTagsField(formData: FormData): string[] | null {
  const raw = formData.get('tags');
  if (typeof raw !== 'string') return null;
  const tags = raw
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
  return tags.length > 0 ? tags : null;
}

/**
 * Read FormData into the raw create payload. The cast is intentional:
 * unknown raw values flow through to the zod parser at the boundary, which
 * is the authoritative validator. Create does NOT carry `image_id` or
 * `image_after_id`: image upload requires the parent's UUID, which only
 * exists after the project row has been inserted. Images are attached on
 * the subsequent edit. The five non-image content-model fields (URLs,
 * progress, subtitle, tags) are included so a publish-on-create flow can land
 * a complete row in one round-trip.
 *
 * @param formData Raw submitted form data.
 * @returns The unvalidated create payload.
 */
export function readProjectCreateFormData(formData: FormData): unknown {
  return {
    title: formData.get('title'),
    description: formData.get('description'),
    status: formData.get('status'),
    github_url: readNullableTrimmed(formData, 'github_url'),
    live_url: readNullableTrimmed(formData, 'live_url'),
    subtitle: readNullableTrimmed(formData, 'subtitle'),
    tags: readTagsField(formData),
    post_id: readNullableTrimmed(formData, 'post_id'),
  };
}

/**
 * Read FormData into the raw update payload, including both image FK fields
 * (`image_id` from T26, `image_after_id` from T42). The form sends an empty
 * string when no image is attached and the UUID string when one is. The zod
 * schema accepts `z.string().uuid().nullable()`, so the empty-string case
 * is normalized to `null` HERE rather than via `.transform()` — the
 * authoritative validator stays a strict shape parser, not a coercion layer.
 *
 * @param formData Raw submitted form data.
 * @returns The unvalidated update payload.
 */
export function readProjectUpdateFormData(formData: FormData): unknown {
  return {
    title: formData.get('title'),
    description: formData.get('description'),
    status: formData.get('status'),
    image_id: readNullableTrimmed(formData, 'image_id'),
    github_url: readNullableTrimmed(formData, 'github_url'),
    live_url: readNullableTrimmed(formData, 'live_url'),
    subtitle: readNullableTrimmed(formData, 'subtitle'),
    tags: readTagsField(formData),
    image_after_id: readNullableTrimmed(formData, 'image_after_id'),
    post_id: readNullableTrimmed(formData, 'post_id'),
  };
}
