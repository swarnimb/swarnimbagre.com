'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Props for {@link ImageUploadAltInput}. Mirrors the alt-text-input slice
 * of `ImageUpload`'s render JSX — parent owns the `altText` state.
 *
 * Renamed from the T43.F spec's working title `ImageUploadPreview.tsx`:
 * the pre-refactor `ImageUpload` had no preview logic to extract (the
 * existing-image preview lives in the parent form, not the upload widget),
 * so the natural CQ-02 cut is FileInput + AltInput rather than
 * FileInput + Preview. Documented in the @end-session log at T43.F close.
 */
export interface ImageUploadAltInputProps {
  /** DOM id for the `<input>`. Derived from `React.useId()` in the parent
   *  so multiple instances on one page do not collide. */
  id: string;
  /** DOM id for the error paragraph — wired to `aria-describedby`. */
  errorId: string;
  /** Visible label text. */
  labelText: string;
  /** Current alt-text value. */
  value: string;
  /** Callback fired on every input change. */
  onChange: (value: string) => void;
  /** Maximum input length — mirrors `ALT_TEXT_MAX_LENGTH`. */
  maxLength: number;
  /** Error message; empty string renders no message. */
  error: string;
}

/**
 * Presentational alt-text-input block extracted from {@link ImageUpload}.
 * The empty-alt gate (`altText.trim().length === 0`) still lives in the
 * parent orchestrator — this component is render-only.
 */
export default function ImageUploadAltInput({
  id,
  errorId,
  labelText,
  value,
  onChange,
  maxLength,
  error,
}: ImageUploadAltInputProps): React.ReactElement {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{labelText}</Label>
      <Input
        id={id}
        type="text"
        name="altText"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
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
