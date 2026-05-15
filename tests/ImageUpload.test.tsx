import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import ImageUpload from '@/components/admin/ImageUpload';

/**
 * T26 acceptance — UI gate on the image upload widget + BLOCKING-01
 * regression pin.
 *
 * The empty-alt-text gate lives in {@link ImageUpload}, not in the parent
 * forms. This file is the single home for that assertion — `ProjectForm` /
 * `PostForm` tests deliberately do not duplicate it.
 *
 * The component reads `altText` via `useState` and computes
 * `submitDisabled = isPending || file === null || altText.trim().length === 0
 * || clientError.length > 0`. Asserting the button is disabled when alt is
 * empty is sufficient — a disabled `<button>` cannot dispatch the upload
 * action, so the server boundary is unreachable from the UI in that state.
 *
 * The "renders no <form> element" test pins BLOCKING-01: ImageUpload is
 * composed inside `<form>` parents (T26 wiring), so its own JSX must NOT
 * contain a `<form>` (nested forms are invalid HTML and silently break the
 * upload flow).
 */

const TEST_PARENT_ID = '00000000-0000-4000-8000-000000000999';

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('ImageUpload — empty alt-text gate (T26)', () => {
  it('keeps the upload button disabled when a file is picked but alt-text is empty', () => {
    const onUpload = vi.fn();
    // Stub action — never expected to fire because the button stays disabled.
    const uploadAction = vi.fn().mockResolvedValue({ status: 'idle' as const });

    render(
      <ImageUpload
        parentType="projects"
        parentId={TEST_PARENT_ID}
        onUpload={onUpload}
        uploadAction={uploadAction}
      />,
    );

    const uploadButton = screen.getByRole('button', { name: /upload/i });
    // Initial state: no file, no alt — disabled.
    expect((uploadButton as HTMLButtonElement).disabled).toBe(true);

    // Pick a valid file but leave alt-text blank.
    const file = new File(['x'], 'pic.png', { type: 'image/png' });
    const fileInput = screen.getByLabelText('Choose image') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Gate still holds — alt-text is the missing piece.
    expect((uploadButton as HTMLButtonElement).disabled).toBe(true);

    // Whitespace-only alt-text must not satisfy the gate either (`trim()`).
    const altInput = screen.getByLabelText('Alt text') as HTMLInputElement;
    fireEvent.change(altInput, { target: { value: '   ' } });
    expect((uploadButton as HTMLButtonElement).disabled).toBe(true);

    // The action must never have been invoked from this disabled state.
    expect(uploadAction).not.toHaveBeenCalled();
    expect(onUpload).not.toHaveBeenCalled();
  });
});

describe('ImageUpload — non-form structure (BLOCKING-01 regression)', () => {
  it('renders no <form> element', () => {
    // Parent surfaces (`ProjectForm` / `PostForm`) wrap this widget in their
    // own `<form>`. An inner `<form>` here would be invalid HTML and silently
    // break submission. Pin the structure so the regression cannot return.
    const onUpload = vi.fn();
    const uploadAction = vi.fn().mockResolvedValue({ status: 'idle' as const });

    const { container } = render(
      <ImageUpload
        parentType="projects"
        parentId={TEST_PARENT_ID}
        onUpload={onUpload}
        uploadAction={uploadAction}
      />,
    );

    expect(container.querySelector('form')).toBeNull();
  });
});
