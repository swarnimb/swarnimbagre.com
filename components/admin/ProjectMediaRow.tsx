'use client';

import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import ImageUpload from '@/components/admin/ImageUpload';
import type { ProjectMediaRowState } from '@/lib/admin-project-media-form-state';
import type { ImageRecord } from '@/lib/types';
import type { AdminMediaPreview } from '@/lib/admin-project-media-preview';

/** Sentinel `signedUrl` after a fresh upload — no URL is held in memory;
 *  page reload refetches via the loader. The slot shows a hint instead. */
const POST_UPLOAD_PREVIEW_SENTINEL = '';

/** CONSTRAINT-13 voice copy — operator-facing labels. */
const DRAG_HANDLE_GLYPH = '⠿';
const DELETE_LABEL = 'Delete';
const POST_UPLOAD_HINT = 'New image saved. Preview refreshes after save.';
const SINGLE_SLOT_LABEL = 'Image';
const PAIR_BEFORE_SLOT_LABEL = 'Before image';
const PAIR_AFTER_SLOT_LABEL = 'After image';

/** Props for {@link ProjectMediaRow}. */
export interface ProjectMediaRowProps {
  row: ProjectMediaRowState;
  /** 0-based row index — passed to drag callbacks + the drag-handle label. */
  index: number;
  /** Owning project UUID — forwarded to nested {@link ImageUpload}. */
  projectId: string;
  onChange: (next: ProjectMediaRowState) => void;
  /** Triggered on Delete click — parent owns the confirm-modal open state. */
  onDelete: () => void;
  onDragStart: (index: number) => void;
  onDragOver: (event: React.DragEvent) => void;
  onDrop: (targetIndex: number) => void;
}

/**
 * Single media-row UI. Renders one or two `ImageUpload` slots based on
 * `row.kind`, plus a drag handle + delete button.
 *
 * Drag-reorder uses HTML5 native DnD per spec (no new dep). Admin is
 * desktop-only for the single operator — touch-DnD is not a target.
 */
export default function ProjectMediaRow({
  row,
  index,
  projectId,
  onChange,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
}: ProjectMediaRowProps): React.ReactElement {
  const handleImageUpload = useCallback(
    (image: ImageRecord) => {
      onChange({
        ...row,
        image_id: image.id,
        imagePreview: { signedUrl: POST_UPLOAD_PREVIEW_SENTINEL, altText: image.alt_text },
      });
    },
    [row, onChange],
  );

  const handleImageAfterUpload = useCallback(
    (image: ImageRecord) => {
      onChange({
        ...row,
        image_after_id: image.id,
        imageAfterPreview: { signedUrl: POST_UPLOAD_PREVIEW_SENTINEL, altText: image.alt_text },
      });
    },
    [row, onChange],
  );

  return (
    <div
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={onDragOver}
      onDrop={() => onDrop(index)}
      className="flex gap-3 rounded-md border border-border bg-surface p-4"
    >
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={`Drag row ${index + 1}`}
        className="cursor-grab"
      >
        {DRAG_HANDLE_GLYPH}
      </Button>

      <div className="flex-1 space-y-4">
        <ImageSlot
          slotLabel={row.kind === 'pair' ? PAIR_BEFORE_SLOT_LABEL : SINGLE_SLOT_LABEL}
          projectId={projectId}
          preview={row.imagePreview}
          onUpload={handleImageUpload}
        />

        {row.kind === 'pair' ? (
          <ImageSlot
            slotLabel={PAIR_AFTER_SLOT_LABEL}
            projectId={projectId}
            preview={row.imageAfterPreview}
            onUpload={handleImageAfterUpload}
          />
        ) : null}
      </div>

      <Button type="button" variant="destructive" onClick={onDelete}>
        {DELETE_LABEL}
      </Button>
    </div>
  );
}

interface ImageSlotProps {
  slotLabel: string;
  projectId: string;
  preview: AdminMediaPreview;
  onUpload: (image: ImageRecord) => void;
}

/** Slot wrapper: existing-image preview (if any) above the upload widget. */
function ImageSlot({ slotLabel, projectId, preview, onUpload }: ImageSlotProps): React.ReactElement {
  return (
    <div className="space-y-2">
      {preview !== null && preview.signedUrl.length > 0 ? (
        <img src={preview.signedUrl} alt={preview.altText} className="max-w-xs border border-border" />
      ) : preview !== null ? (
        <p className="text-sm text-muted-foreground">{POST_UPLOAD_HINT}</p>
      ) : null}
      <ImageUpload
        parentType="projects"
        parentId={projectId}
        instanceLabel={slotLabel}
        onUpload={onUpload}
      />
    </div>
  );
}
