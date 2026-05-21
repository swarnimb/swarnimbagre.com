'use client';

import { useActionState, useEffect, useId, useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { uploadImage } from '@/lib/admin-images-mutations';
import {
  ALLOWED_MIME_TYPES,
  ALT_TEXT_MAX_LENGTH,
  IMAGE_MUTATION_INITIAL_STATE,
  type ImageMutationState,
} from '@/lib/admin-images-mutations-types';
import { precheckImageFile } from '@/lib/admin-image-file-precheck';
import ImageUploadFileInput from '@/components/admin/ImageUploadFileInput';
import ImageUploadAltInput from '@/components/admin/ImageUploadAltInput';
import type { ImageRecord } from '@/lib/types';

/** Default file-picker label when `instanceLabel` is not supplied. */
const DEFAULT_FILE_LABEL = 'Choose image';
/** Default alt-text label when `instanceLabel` is not supplied. */
const DEFAULT_ALT_LABEL = 'Alt text';

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
  /** Optional human-readable scope label. When set, prefixes the visible
   * file + alt input labels so multiple instances on one page expose
   * distinct accessible names (T43.F: `ProjectMediaRow` mounts one or two
   * `ImageUpload` instances per media row). Omit for single-instance
   * surfaces (`PostForm`) to keep the defaults `Choose image` / `Alt text`. */
  instanceLabel?: string;
}

/**
 * Admin image upload widget. File picker + required alt-text + parentType /
 * parentId values appended to FormData via a manual dispatch handler. Submit
 * disabled until a file is selected AND alt-text is non-empty (mirrors the
 * zod `.min(1)` boundary). Client-side pre-checks size + MIME on file pick
 * (UX only — server is authoritative). Success effect dedupes via
 * `handledStateRef` so `onUpload(image)` fires once per submit; mirrors the
 * `StatsInsertForm` pattern.
 *
 * **Non-form wrapper (BLOCKING-01 fix):** renders a `<div>`, not a `<form>`,
 * because `ProjectForm` / `PostForm` compose this widget inside their own
 * `<form>` (nested `<form>` is invalid HTML and silently breaks submit).
 * `dispatch(formData)` is called inside a `useTransition` so the
 * `useActionState` envelope (state shape, `isPending`) is preserved.
 */
export default function ImageUpload({
  parentType,
  parentId,
  onUpload,
  onError,
  uploadAction = uploadImage,
  instanceLabel,
}: ImageUploadProps): React.ReactElement {
  const [state, dispatch, isPending] = useActionState<
    ImageMutationState,
    FormData
  >(uploadAction, IMAGE_MUTATION_INITIAL_STATE);
  const [, startTransition] = useTransition();

  // Per-instance stable id base — guarantees unique DOM ids when the parent
  // composes more than one `ImageUpload` (T43.F: a `ProjectMediaRow` pair
  // mounts two, and a media list mounts many). Hydration-safe via `useId()`.
  const instanceUid = useId();
  const fileInputId = `image-file-${instanceUid}`;
  const fileErrorId = `image-file-error-${instanceUid}`;
  const altInputId = `image-alt-${instanceUid}`;
  const altErrorId = `image-alt-error-${instanceUid}`;
  // Visible accessible names. When `instanceLabel` is set, prefix so
  // `getByLabel` queries (both Testing Library and Playwright) resolve to a
  // single element per instance.
  const fileLabelText = instanceLabel
    ? `${instanceLabel} ${DEFAULT_FILE_LABEL.toLowerCase()}`
    : DEFAULT_FILE_LABEL;
  const altLabelText = instanceLabel
    ? `${instanceLabel} ${DEFAULT_ALT_LABEL.toLowerCase()}`
    : DEFAULT_ALT_LABEL;

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
    setClientError(precheckImageFile(next));
  }

  const submitDisabled =
    isPending ||
    file === null ||
    altText.trim().length === 0 ||
    clientError.length > 0;

  const altTextError = state.fieldErrors?.altText ?? '';
  const fileError = state.fieldErrors?.file ?? clientError;

  /**
   * Build the FormData payload from current state and dispatch the Server
   * Action. Fields appended here mirror what the previous inner `<form>`
   * carried — `parentType`, `parentId`, `file`, `altText` — so the server
   * boundary sees an identical wire shape. Wrapped in `startTransition`
   * because `dispatch` is invoked outside a `<form action={...}>` binding;
   * React requires Action calls to occur inside a transition for `isPending`
   * to track the in-flight action.
   */
  function handleUpload(): void {
    if (submitDisabled || file === null) return;
    const formData = new FormData();
    formData.append('parentType', parentType);
    formData.append('parentId', parentId);
    formData.append('file', file);
    formData.append('altText', altText);
    startTransition(() => dispatch(formData));
  }

  return (
    <section className="space-y-4">
      {state.status === 'error' && state.formError ? (
        <p role="alert" className="text-sm text-destructive">
          {state.formError}
        </p>
      ) : null}
      <div className="space-y-4">
        <ImageUploadFileInput
          id={fileInputId}
          errorId={fileErrorId}
          labelText={fileLabelText}
          accept={ALLOWED_MIME_TYPES.join(',')}
          fileInputKey={fileInputKey}
          onChange={onFileChange}
          error={fileError}
        />
        <ImageUploadAltInput
          id={altInputId}
          errorId={altErrorId}
          labelText={altLabelText}
          value={altText}
          onChange={setAltText}
          maxLength={ALT_TEXT_MAX_LENGTH}
          error={altTextError}
        />
        <div className="flex items-center gap-2">
          <Button type="button" onClick={handleUpload} disabled={submitDisabled}>
            {isPending ? 'Uploading' : 'Upload'}
          </Button>
        </div>
      </div>
    </section>
  );
}
