'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import DeleteConfirmModal from '@/components/admin/DeleteConfirmModal';
import { deleteNote } from '@/lib/admin-notes-mutations';
import { GENERIC_FORM_ERROR } from '@/lib/auth-constants';

/** Toast on success. CONSTRAINT-13: dry, no SaaS phrasing, no emoji. */
const DELETE_SUCCESS_MESSAGE = 'Deleted.';

/** Singular resource label used in the confirm dialog title. */
const RESOURCE_LABEL = 'note';

/**
 * Props for {@link DeleteNoteButton}.
 */
export interface DeleteNoteButtonProps {
  /** UUID of the note to delete. */
  id: string;
  /** Kicker of the note row, rendered inside quotes in the dialog title. */
  name: string;
  /**
   * Optional injected delete action: tests override this to avoid Server
   * Action wiring under jsdom.
   */
  deleteAction?: typeof deleteNote;
  /** Optional className for the trigger Button. */
  className?: string;
  /** Trigger button size. Defaults to `'sm'` because the only caller is a list row. */
  size?: 'default' | 'sm';
}

/**
 * Trigger button + delete-confirm modal pair, wired to the `deleteNote`
 * Server Action. Mirrors {@link import('./DeleteStatButton').default} exactly;
 * only the action, the resource label, and the prop types differ.
 *
 * Manages local modal open-state and calls the action on confirm. On a
 * successful resolution (state `'ok'`), shows a sonner toast and calls
 * `router.refresh()` so the row disappears from the list without a
 * navigation. On an error envelope, shows an error toast and keeps the
 * modal open so the user can retry.
 *
 * @param props See {@link DeleteNoteButtonProps}.
 * @returns React element rendering the destructive trigger + its modal.
 */
export default function DeleteNoteButton({
  id,
  name,
  deleteAction = deleteNote,
  className,
  size = 'sm',
}: DeleteNoteButtonProps): React.ReactElement {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  async function handleConfirm(): Promise<void> {
    const result = await deleteAction(id);
    if (result.status === 'ok') {
      toast.success(DELETE_SUCCESS_MESSAGE);
      setIsOpen(false);
      router.refresh();
      return;
    }
    // Error envelope: keep modal open, surface the generic form error.
    toast.error(result.formError ?? GENERIC_FORM_ERROR);
  }

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        size={size}
        className={className}
        onClick={() => setIsOpen(true)}
      >
        Delete
      </Button>
      <DeleteConfirmModal
        resource={RESOURCE_LABEL}
        name={name}
        onConfirm={handleConfirm}
        isOpen={isOpen}
        onOpenChange={setIsOpen}
      />
    </>
  );
}
