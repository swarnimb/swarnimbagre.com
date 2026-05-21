'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Props for {@link ImageUploadFileInput}. Mirrors the file-input slice of
 * `ImageUpload`'s render JSX — the parent owns all state; this component
 * is presentational only.
 */
export interface ImageUploadFileInputProps {
  /** DOM id for the `<input>`. Derived from `React.useId()` in the parent
   *  so multiple instances on one page do not collide. */
  id: string;
  /** DOM id for the error paragraph — wired to `aria-describedby`. */
  errorId: string;
  /** Visible label text. Parents that mount multiple instances prefix this
   *  via `instanceLabel` so `getByLabel` resolves uniquely. */
  labelText: string;
  /** Comma-separated MIME types for the file input's `accept` attribute. */
  accept: string;
  /** Bumped by the parent after a successful upload to force-remount the
   *  uncontrolled `<input type="file">` so its DOM `value` clears. */
  fileInputKey: number;
  /** Callback fired when the user picks a file (or clears the input). */
  onChange: (file: File | null) => void;
  /** Error message; empty string renders no message. */
  error: string;
}

/**
 * Presentational file-input block extracted from {@link ImageUpload} as
 * part of the T43.F CQ-02 MAJOR split (closes the S31 carry-forward).
 */
export default function ImageUploadFileInput({
  id,
  errorId,
  labelText,
  accept,
  fileInputKey,
  onChange,
  error,
}: ImageUploadFileInputProps): React.ReactElement {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{labelText}</Label>
      <Input
        key={fileInputKey}
        id={id}
        type="file"
        name="file"
        accept={accept}
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        aria-invalid={Boolean(error)}
        aria-describedby={errorId}
        required
      />
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
