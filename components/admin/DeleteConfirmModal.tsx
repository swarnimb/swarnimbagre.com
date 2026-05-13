'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

/**
 * Button label while the confirm action is in flight. CONSTRAINT-13 voice:
 * dry, no spinner emoji, no SaaS "loading…" phrasing.
 */
const PENDING_LABEL = 'Deleting';

/** Default button label when not pending. */
const CONFIRM_LABEL = 'Delete';

/** Cancel button label. */
const CANCEL_LABEL = 'Cancel';

/** Body copy. CONSTRAINT-10: explicit, no undo. */
const BODY_COPY = 'This cannot be undone.';

/**
 * Props for {@link DeleteConfirmModal}.
 *
 * The component is generic by design — it does not know about projects,
 * posts, stats, or images. The same component is reused for every admin
 * delete confirmation (T22 projects, T23 posts, T24 stats deletes, T27
 * orphan cleanup), keeping the destructive-action UX identical across the
 * panel.
 */
export interface DeleteConfirmModalProps {
  /**
   * Singular noun for the kind of thing being deleted, lowercase
   * (`"project"`, `"post"`, `"stat"`). Rendered into the dialog title via
   * `Delete {resource} "{name}"?`.
   */
  resource: string;
  /**
   * Human-readable identifier for the specific row (title, label, etc.).
   * Rendered inside quotes in the dialog title.
   */
  name: string;
  /**
   * Async handler invoked when the user confirms. Buttons are disabled while
   * the returned promise is pending. If the promise rejects, the modal stays
   * open so the user can retry — the parent component is responsible for
   * showing the error toast.
   */
  onConfirm: () => Promise<void>;
  /** Controlled open state. */
  isOpen: boolean;
  /** Controlled open-state setter. Called with `false` on Cancel, ESC, or
   *  overlay click — shadcn Dialog default. */
  onOpenChange: (open: boolean) => void;
}

/**
 * Reusable destructive-confirm modal for the admin panel.
 *
 * shadcn Dialog with a Cancel (outline) + Delete (destructive) button pair.
 * ESC key closes the modal (Radix Dialog default; not overridden here).
 *
 * - **Pending state:** while `onConfirm` is awaiting, both buttons are
 *   disabled and the Delete button text swaps to {@link PENDING_LABEL}.
 * - **Error path:** if `onConfirm` rejects, the modal stays open and the
 *   pending state clears so the user can retry. The parent is expected to
 *   surface a toast or other error feedback.
 * - **Success path:** the parent is responsible for closing the modal
 *   (typically by setting `isOpen` to `false` from the `onConfirm`
 *   resolution handler) and for any redirect/refresh.
 *
 * @param props See {@link DeleteConfirmModalProps}.
 * @returns React element rendering the destructive-confirm dialog.
 */
export default function DeleteConfirmModal({
  resource,
  name,
  onConfirm,
  isOpen,
  onOpenChange,
}: DeleteConfirmModalProps): React.ReactElement {
  const [isPending, setIsPending] = useState(false);

  async function handleConfirm(): Promise<void> {
    setIsPending(true);
    try {
      await onConfirm();
    } finally {
      // Always clear pending so a rejected onConfirm leaves the modal usable.
      // The parent decides whether to close the modal on success.
      setIsPending(false);
    }
  }

  function handleCancel(): void {
    if (isPending) return;
    onOpenChange(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Delete {resource} &ldquo;{name}&rdquo;?
          </DialogTitle>
          <DialogDescription>{BODY_COPY}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isPending}
          >
            {CANCEL_LABEL}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isPending ? PENDING_LABEL : CONFIRM_LABEL}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
