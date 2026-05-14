'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import DeleteConfirmModal from '@/components/admin/DeleteConfirmModal';
import { deletePost } from '@/lib/admin-posts-mutations';
import { GENERIC_FORM_ERROR } from '@/lib/auth-constants';

/** Toast on success. CONSTRAINT-13: dry, no SaaS phrasing, no emoji. */
const DELETE_SUCCESS_MESSAGE = 'Deleted.';

/** Singular resource label used in the confirm dialog title. */
const RESOURCE_LABEL = 'post';

/** After-delete destination when invoked from the edit page. */
const POSTS_LIST_PATH = '/admin/posts';

/**
 * Props for {@link DeletePostButton}.
 */
export interface DeletePostButtonProps {
  /** UUID of the post to delete. */
  id: string;
  /** Title of the post — rendered into the confirm dialog. */
  name: string;
  /**
   * Behavior after a successful delete. `'redirect'` (default — used by the
   * edit page) pushes to `/admin/posts`. `'refresh'` (used by the list page)
   * calls `router.refresh()` — the row disappears from the list without a
   * navigation.
   */
  afterDelete?: 'redirect' | 'refresh';
  /**
   * Optional injected delete action — tests override this to avoid Server
   * Action wiring under jsdom.
   */
  deleteAction?: typeof deletePost;
  /**
   * Optional className for the trigger Button — lets the list-row caller
   * apply `size="sm"` styling without prop-drilling all Button props.
   */
  className?: string;
  /** Trigger button size. Defaults to `'default'` (edit page); list rows pass `'sm'`. */
  size?: 'default' | 'sm';
}

/**
 * Trigger button + delete-confirm modal pair, wired to the `deletePost`
 * Server Action.
 *
 * Manages local modal open-state and calls the action on confirm. On a
 * successful resolution (state `'ok'`), shows a sonner toast and either
 * redirects to the list (`afterDelete: 'redirect'`) or refreshes the current
 * route (`afterDelete: 'refresh'`). On an error envelope, shows an error
 * toast and keeps the modal open so the user can retry — the modal's pending
 * state clears via {@link DeleteConfirmModal}'s `finally`.
 *
 * Mirrors `DeleteProjectButton` byte-for-byte in structure; the only
 * differences are the action reference, the resource label, and the
 * after-delete redirect path.
 *
 * @param props See {@link DeletePostButtonProps}.
 * @returns React element rendering the destructive trigger + its modal.
 */
export default function DeletePostButton({
  id,
  name,
  afterDelete = 'redirect',
  deleteAction = deletePost,
  className,
  size = 'default',
}: DeletePostButtonProps): React.ReactElement {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  async function handleConfirm(): Promise<void> {
    const result = await deleteAction(id);
    if (result.status === 'ok') {
      toast.success(DELETE_SUCCESS_MESSAGE);
      setIsOpen(false);
      if (afterDelete === 'redirect') {
        router.push(POSTS_LIST_PATH);
      } else {
        router.refresh();
      }
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
