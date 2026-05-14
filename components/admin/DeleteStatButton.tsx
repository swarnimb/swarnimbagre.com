'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import DeleteConfirmModal from '@/components/admin/DeleteConfirmModal';
import { deleteStat } from '@/lib/admin-mutations';
import { GENERIC_FORM_ERROR } from '@/lib/admin-mutations-types';

/** Toast on success. CONSTRAINT-13: dry, no SaaS phrasing, no emoji. */
const DELETE_SUCCESS_MESSAGE = 'Deleted.';

/** Singular resource label used in the confirm dialog title. */
const RESOURCE_LABEL = 'stat';

/**
 * Props for {@link DeleteStatButton}.
 */
export interface DeleteStatButtonProps {
  /** UUID of the stat to delete. */
  id: string;
  /** Label of the stat row — rendered inside quotes in the dialog title. */
  name: string;
  /**
   * Optional injected delete action — tests override this to avoid Server
   * Action wiring under jsdom.
   */
  deleteAction?: typeof deleteStat;
  /**
   * Optional className for the trigger Button — lets the list-row caller
   * apply size styling without prop-drilling all Button props.
   */
  className?: string;
  /** Trigger button size. Defaults to `'sm'` because the only caller is the list row. */
  size?: 'default' | 'sm';
}

/**
 * Trigger button + delete-confirm modal pair, wired to the `deleteStat`
 * Server Action.
 *
 * Manages local modal open-state and calls the action on confirm. On a
 * successful resolution (state `'ok'`), shows a sonner toast and calls
 * `router.refresh()` so the row disappears from the list without a
 * navigation. On an error envelope, shows an error toast and keeps the
 * modal open so the user can retry — the modal's pending state clears via
 * {@link DeleteConfirmModal}'s `finally`.
 *
 * Differs from {@link import('./DeletePostButton').default} in that stats
 * has no edit page; the action is therefore always "refresh" (no
 * `afterDelete` prop), keeping the surface smaller than the post equivalent.
 *
 * @param props See {@link DeleteStatButtonProps}.
 * @returns React element rendering the destructive trigger + its modal.
 */
export default function DeleteStatButton({
  id,
  name,
  deleteAction = deleteStat,
  className,
  size = 'sm',
}: DeleteStatButtonProps): React.ReactElement {
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
    // Error envelope — keep modal open, surface the generic form error.
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
