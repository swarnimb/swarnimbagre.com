import { useEffect, useRef } from 'react';

/**
 * Return focus to whatever opened the full-screen viewer, once it closes.
 *
 * The viewer cannot do this itself. Capturing `document.activeElement` on
 * mount and re-focusing it on unmount is the usual pattern and it fails here:
 * React re-creates the nodes `MarkdownContent` injects, so the captured
 * element is detached by the time the viewer closes and `focus()` on it does
 * nothing at all, silently. The opener is therefore looked up again — from the
 * live DOM, on the commit that closed the viewer — rather than held.
 *
 * @param isOpen     Whether the viewer is currently open.
 * @param findOpener Given the index remembered at open time, return the
 *                   element to focus, or nothing if it is gone.
 * @returns A function to call when opening the viewer, with the index that
 *          identifies the opener to `findOpener`.
 */
export function useRestoreFocus(
  isOpen: boolean,
  findOpener: (index: number) => HTMLElement | null | undefined,
): (index: number) => void {
  const pending = useRef<number | null>(null);
  const find = useRef(findOpener);
  find.current = findOpener;

  useEffect(() => {
    if (isOpen || pending.current === null) return;
    const index = pending.current;
    pending.current = null;
    const opener = find.current(index);
    if (!opener) return;
    // Prose images are not focusable until asked to be.
    if (!opener.hasAttribute('tabindex')) opener.tabIndex = -1;
    opener.focus();
  }, [isOpen]);

  return (index: number) => {
    pending.current = index;
  };
}
