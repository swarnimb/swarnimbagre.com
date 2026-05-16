import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_BYTES,
} from '@/lib/admin-images-mutations-types';

/** Inline error copy for the client-side file pre-check. CONSTRAINT-13: dry.
 * Server boundary is authoritative — pre-check is UX-side feedback only. */
export const FILE_TOO_LARGE_MESSAGE = 'File is too large.';
export const FILE_TYPE_NOT_ALLOWED_MESSAGE = 'File type not accepted.';

/**
 * Pure client-side pre-check for a picked upload file. Mirrors the server
 * zod boundary (MIME allow-list + max size) so the operator gets immediate
 * feedback; it is NOT authoritative — the Server Action re-validates.
 *
 * @param file The newly picked file, or `null` when the picker was cleared.
 * @returns An error message string when the file fails the MIME or size
 *          check (MIME checked first), or `''` when the file is acceptable
 *          or `file` is `null` (nothing to validate yet).
 */
export function precheckImageFile(file: File | null): string {
  if (file === null) return '';
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return FILE_TYPE_NOT_ALLOWED_MESSAGE;
  }
  if (file.size > MAX_FILE_BYTES) {
    return FILE_TOO_LARGE_MESSAGE;
  }
  return '';
}
