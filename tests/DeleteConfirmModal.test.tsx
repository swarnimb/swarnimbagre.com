import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import DeleteConfirmModal from '@/components/admin/DeleteConfirmModal';

/**
 * T22 acceptance — destructive confirm modal.
 *
 * Tests target the controlled `<DeleteConfirmModal>` directly: opens when
 * `isOpen=true`, Cancel calls `onOpenChange(false)`, Delete calls
 * `onConfirm` then leaves the parent to close, ESC key closes the modal
 * (shadcn Dialog default — not overridden), and both buttons are disabled
 * while `onConfirm` is in flight.
 *
 * The wrapper `<DeleteProjectButton>` (toast + redirect/refresh + Server
 * Action wiring) is exercised indirectly via the `tests/ProjectForm.test.tsx`
 * pattern — `useRouter` and `sonner` are mocked at the module level there,
 * not here. This file focuses on the reusable modal contract.
 */

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('DeleteConfirmModal', () => {
  it('renders the title and body copy when isOpen is true', () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();

    render(
      <DeleteConfirmModal
        resource="project"
        name="OpenClaw"
        onConfirm={onConfirm}
        isOpen={true}
        onOpenChange={onOpenChange}
      />,
    );

    // Title text includes the resource label and the name in quotes.
    // Use a regex because the curly quotes (&ldquo;/&rdquo;) render as
    // U+201C / U+201D in the DOM, not straight ASCII quotes.
    expect(
      screen.getByText(/Delete project [“"]OpenClaw[”"]\?/),
    ).toBeInTheDocument();
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('does NOT render the dialog content when isOpen is false', () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();

    render(
      <DeleteConfirmModal
        resource="project"
        name="Hidden"
        onConfirm={onConfirm}
        isOpen={false}
        onOpenChange={onOpenChange}
      />,
    );

    expect(screen.queryByText(/Delete project/)).not.toBeInTheDocument();
    expect(screen.queryByText('This cannot be undone.')).not.toBeInTheDocument();
  });

  it('Cancel button calls onOpenChange(false) without invoking onConfirm', () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();

    render(
      <DeleteConfirmModal
        resource="project"
        name="OpenClaw"
        onConfirm={onConfirm}
        isOpen={true}
        onOpenChange={onOpenChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onConfirm).not.toHaveBeenCalled();
    // Either the explicit handler call OR Radix's internal close — both end
    // with onOpenChange(false). Filter for the false case so the assertion
    // is robust to either path.
    expect(
      onOpenChange.mock.calls.some(([open]) => open === false),
    ).toBe(true);
  });

  it('Delete button calls onConfirm (awaited) before any parent close-handling', async () => {
    const callOrder: string[] = [];
    const onConfirm = vi.fn().mockImplementation(async () => {
      callOrder.push('onConfirm:start');
      await Promise.resolve();
      callOrder.push('onConfirm:end');
    });
    const onOpenChange = vi.fn((_open: boolean) => {
      callOrder.push('onOpenChange');
    });

    render(
      <DeleteConfirmModal
        resource="project"
        name="OpenClaw"
        onConfirm={onConfirm}
        isOpen={true}
        onOpenChange={onOpenChange}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    });

    expect(onConfirm).toHaveBeenCalledTimes(1);
    // The first event in `callOrder` MUST be onConfirm:start — the parent
    // close-handling, if any, must be downstream of the awaited confirm.
    expect(callOrder[0]).toBe('onConfirm:start');
  });

  it('ESC key closes the modal via the shadcn Dialog default', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();

    render(
      <DeleteConfirmModal
        resource="project"
        name="OpenClaw"
        onConfirm={onConfirm}
        isOpen={true}
        onOpenChange={onOpenChange}
      />,
    );

    await act(async () => {
      fireEvent.keyDown(document.body, { key: 'Escape', code: 'Escape' });
    });

    await waitFor(() => {
      expect(
        onOpenChange.mock.calls.some(([open]) => open === false),
      ).toBe(true);
    });
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('disables both buttons while onConfirm is pending', async () => {
    let resolveConfirm: (() => void) | undefined;
    const onConfirm = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveConfirm = resolve;
        }),
    );
    const onOpenChange = vi.fn();

    render(
      <DeleteConfirmModal
        resource="project"
        name="OpenClaw"
        onConfirm={onConfirm}
        isOpen={true}
        onOpenChange={onOpenChange}
      />,
    );

    // Click Delete — onConfirm starts but doesn't resolve yet.
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    });

    // While pending, the Delete button label flips to "Deleting" and both
    // buttons are disabled.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Deleting' })).toBeDisabled();
    });
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();

    // Resolve the inner promise — buttons re-enable.
    await act(async () => {
      resolveConfirm?.();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Delete' })).not.toBeDisabled();
    });
  });
});
