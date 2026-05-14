'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { uploadImage } from '@/lib/admin-images-mutations';
import {
  ALLOWED_MIME_TYPES,
  ALT_TEXT_MAX_LENGTH,
  IMAGE_MUTATION_INITIAL_STATE,
  MAX_FILE_BYTES,
  type ImageMutationState,
} from '@/lib/admin-images-mutations-types';
import type { ImageRecord } from '@/lib/types';

/** Inline error copy for the client-side file pre-check. CONSTRAINT-13: dry.
 * Server boundary is authoritative — pre-check is UX-side feedback only. */
const FILE_TOO_LARGE_MESSAGE = 'File is too large.';
const FILE_TYPE_NOT_ALLOWED_MESSAGE = 'File type not accepted.';

/**
 * Props for {@link ImageUpload}.
 */
export interface ImageUploadProps {
  /** Parent row table — `'projects'` or `'posts'`. Mirrors
   * `images.parent_type`. */
  parentType: 'projects' | 'posts';
  /** UUID of the parent row. The server boundary re-validates this is a
   * UUID; the prop typing alone does not enforce that at runtime. */
  parentId: string;
  /** Fired exactly once per successful upload with the inserted image row.
   * Parent forms (T26 wiring) use this to update their `image_id`. */
  onUpload: (image: ImageRecord) => void;
  /** Optional error sink — fired with the form-level error string when the
   * server returns `status: 'error'` with a `formError`, OR when a field
   * error reaches a hidden field (parentType / parentId, which the form
   * controls — these should not happen but are surfaced for diagnosis). */
  onError?: (message: string) => void;
  /** Optional injected action — tests override this to avoid Server Action
   * wiring. Defaults to the production `uploadImage`. */
  uploadAction?: typeof uploadImage;
}

/**
 * Admin image upload form. File picker + required alt-text + hidden
 * parentType/parentId. Submit disabled until a file is selected AND alt-text
 * is non-empty (mirrors the zod `.min(1)` boundary). Client-side pre-checks
 * size + MIME on file pick (UX only — server is authoritative). Success
 * effect dedupes via `handledStateRef` so `onUpload(image)` fires once per
 * submit; mirrors the `StatsInsertForm` pattern.
 */
export default function ImageUpload({
  parentType,
  parentId,
  onUpload,
  onError,
  uploadAction = uploadImage,
}: ImageUploadProps): React.ReactElement {
  const [state, formAction, isPending] = useActionState<
    ImageMutationState,
    FormData
  >(uploadAction, IMAGE_MUTATION_INITIAL_STATE);

  // File state — controlled via `useState`. The `<input type="file">` itself
  // is uncontrolled (React deliberately disallows controlling its `value`
  // for security reasons), so we bump `fileInputKey` to remount the input
  // after a successful upload so it reads as empty in the DOM too.
  const [file, setFile] = useState<File | null>(null);
  const [altText, setAltText] = useState('');
  const [clientError, setClientError] = useState<string>('');
  const [fileInputKey, setFileInputKey] = useState(0);

  const handledStateRef = useRef<ImageMutationState | null>(null);

  useEffect(() => {
    if (handledStateRef.current === state) return;
    if (state.status === 'ok' && state.image) {
      handledStateRef.current = state;
      onUpload(state.image);
      setFile(null);
      setAltText('');
      setClientError('');
      setFileInputKey((k) => k + 1);
      return;
    }
    if (state.status === 'error') {
      handledStateRef.current = state;
      // Hidden-field errors should not happen (parentType / parentId are
      // prop-driven), but if they do, surface to onError so the parent can
      // decide what to do.
      const hiddenErr =
        state.fieldErrors?.parentType ?? state.fieldErrors?.parentId;
      if (hiddenErr) onError?.(hiddenErr);
      else if (state.formError) onError?.(state.formError);
    }
  }, [state, onUpload, onError]);

  function onFileChange(next: File | null): void {
    setFile(next);
    setClientError('');
    if (next === null) return;
    if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(next.type)) {
      setClientError(FILE_TYPE_NOT_ALLOWED_MESSAGE);
      return;
    }
    if (next.size > MAX_FILE_BYTES) {
      setClientError(FILE_TOO_LARGE_MESSAGE);
    }
  }

  const submitDisabled =
    isPending ||
    file === null ||
    altText.trim().length === 0 ||
    clientError.length > 0;

  const altTextError = state.fieldErrors?.altText ?? '';
  const fileError = state.fieldErrors?.file ?? clientError;

  return (
    <section className="space-y-4">
      {state.status === 'error' && state.formError ? (
        <p role="alert" className="text-sm text-destructive">
          {state.formError}
        </p>
      ) : null}
      <form action={formAction} className="space-y-4" noValidate>
        <input type="hidden" name="parentType" value={parentType} />
        <input type="hidden" name="parentId" value={parentId} />
        <div className="space-y-2">
          <Label htmlFor="image-file">Choose image</Label>
          <Input
            key={fileInputKey}
            id="image-file"
            type="file"
            name="file"
            accept={ALLOWED_MIME_TYPES.join(',')}
            onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
            aria-invalid={Boolean(fileError)}
            aria-describedby="image-file-error"
            required
          />
          {fileError ? (
            <p
              id="image-file-error"
              role="alert"
              className="text-sm text-destructive"
            >
              {fileError}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="image-alt">Alt text</Label>
          <Input
            id="image-alt"
            type="text"
            name="altText"
            value={altText}
            onChange={(e) => setAltText(e.target.value)}
            maxLength={ALT_TEXT_MAX_LENGTH}
            aria-invalid={Boolean(altTextError)}
            aria-describedby="image-alt-error"
            required
          />
          {altTextError ? (
            <p
              id="image-alt-error"
              role="alert"
              className="text-sm text-destructive"
            >
              {altTextError}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button type="submit" disabled={submitDisabled}>
            {isPending ? 'Uploading' : 'Upload'}
          </Button>
        </div>
      </form>
    </section>
  );
}
