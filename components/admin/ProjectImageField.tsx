'use client';

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import ImageUpload from '@/components/admin/ImageUpload';
import type { ImageRecord } from '@/lib/types';

/** Resolved image preview shape the page-side loader passes down. */
export interface ImagePreview {
  id: string;
  signedUrl: string;
  altText: string;
}

/** Props for {@link ProjectImageField}. */
export interface ProjectImageFieldProps {
  /** UUID of the parent project row. Required — the field is edit-only. */
  parentId: string;
  /** Hidden input name — `image_id` or `image_after_id`. */
  fieldName: 'image_id' | 'image_after_id';
  /** Operator-facing label. */
  label: string;
  /** Resolved preview for the existing FK value. Null when unset. */
  initialPreview: ImagePreview | null;
}

/**
 * Combined hidden-input + preview + ImageUpload for one project image FK.
 * Used twice in `ProjectForm.tsx` — once for the primary `image_id` and once
 * for the before/after slider's `image_after_id` (T42). Owns its own state;
 * the hidden input inside this component renders into the parent's
 * <form> element through standard React composition.
 */
export default function ProjectImageField({
  parentId,
  fieldName,
  label,
  initialPreview,
}: ProjectImageFieldProps): React.ReactElement {
  const [imageId, setImageId] = useState<string | null>(initialPreview?.id ?? null);
  const [uploaded, setUploaded] = useState<ImageRecord | null>(null);

  return (
    <div className="space-y-3">
      <Label>{label}</Label>
      <input type="hidden" name={fieldName} value={imageId ?? ''} />
      {imageId !== null && initialPreview !== null && uploaded === null ? (
        <img
          src={initialPreview.signedUrl}
          alt={initialPreview.altText}
          className="max-w-xs border border-border"
        />
      ) : null}
      {uploaded !== null ? (
        <p className="text-sm text-muted-foreground">
          New image saved. Preview refreshes after save.
        </p>
      ) : null}
      <ImageUpload
        parentType="projects"
        parentId={parentId}
        onUpload={(image) => {
          setImageId(image.id);
          setUploaded(image);
        }}
      />
    </div>
  );
}
