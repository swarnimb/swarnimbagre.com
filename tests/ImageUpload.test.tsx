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

/**
 * T42 fix-pin — multi-instance id + accessible-name uniqueness.
 *
 * Before this fix, `ImageUpload` hardcoded `id="image-file"` (and three
 * sibling ids). T42 Session A made `ProjectForm` render two
 * `ProjectImageField` instances — primary + before/after — which mounted
 * TWO `ImageUpload`s on one page. Result: duplicate DOM ids (invalid HTML)
 * AND a Playwright strict-mode selector violation on
 * `locator('input[type="file"]')`. The fix derives ids per-instance via
 * `useId()` and accepts an `instanceLabel` prop that prefixes the visible
 * file / alt labels so `getByLabel` resolves uniquely too.
 *
 * Coverage (TS-01 — happy + error case for the label-derivation logic):
 *   - happy: `instanceLabel` set on both → distinct ids + distinct labels.
 *   - error case: would-have-been-the-bug case — two instances mounted in
 *     one container must produce DIFFERENT file-input ids.
 *   - back-compat: no `instanceLabel` → defaults `Choose image` / `Alt text`
 *     preserved (the `PostForm` single-instance path must not regress).
 */
describe('ImageUpload — instance-scoped ids + labels (T42 fix)', () => {
  it('keeps default labels when instanceLabel is not supplied (PostForm path)', () => {
    const onUpload = vi.fn();
    const uploadAction = vi.fn().mockResolvedValue({ status: 'idle' as const });

    render(
      <ImageUpload
        parentType="posts"
        parentId={TEST_PARENT_ID}
        onUpload={onUpload}
        uploadAction={uploadAction}
      />,
    );

    // Defaults preserved so the existing PostForm flow + this file's earlier
    // tests stay valid.
    expect(screen.getByLabelText('Choose image')).toBeDefined();
    expect(screen.getByLabelText('Alt text')).toBeDefined();
  });

  it('prefixes visible labels with instanceLabel when supplied', () => {
    const onUpload = vi.fn();
    const uploadAction = vi.fn().mockResolvedValue({ status: 'idle' as const });

    render(
      <ImageUpload
        parentType="projects"
        parentId={TEST_PARENT_ID}
        onUpload={onUpload}
        uploadAction={uploadAction}
        instanceLabel="Image"
      />,
    );

    // Scoped accessible names — the production labels passed by
    // ProjectImageField are "Image" and "After image (before/after slider)".
    expect(screen.getByLabelText('Image choose image')).toBeDefined();
    expect(screen.getByLabelText('Image alt text')).toBeDefined();
  });

  it('renders two instances in one container with distinct file-input ids (regression)', () => {
    // This is the test that would have caught the original bug: two
    // ProjectImageField instances on one ProjectForm rendered two
    // ImageUploads with the SAME `id="image-file"`. The fix makes the ids
    // derive per-instance via React 19 `useId()`.
    const onUpload = vi.fn();
    const uploadAction = vi.fn().mockResolvedValue({ status: 'idle' as const });

    const { container } = render(
      <div>
        <ImageUpload
          parentType="projects"
          parentId={TEST_PARENT_ID}
          onUpload={onUpload}
          uploadAction={uploadAction}
          instanceLabel="Image"
        />
        <ImageUpload
          parentType="projects"
          parentId={TEST_PARENT_ID}
          onUpload={onUpload}
          uploadAction={uploadAction}
          instanceLabel="After image"
        />
      </div>,
    );

    const fileInputs = container.querySelectorAll('input[type="file"]');
    expect(fileInputs).toHaveLength(2);
    const id0 = (fileInputs[0] as HTMLInputElement).id;
    const id1 = (fileInputs[1] as HTMLInputElement).id;
    expect(id0).not.toBe('');
    expect(id1).not.toBe('');
    expect(id0).not.toBe(id1);

    // Same for the alt-text inputs (a sibling id source for the same bug).
    const altInputs = container.querySelectorAll('input[name="altText"]');
    expect(altInputs).toHaveLength(2);
    const altId0 = (altInputs[0] as HTMLInputElement).id;
    const altId1 = (altInputs[1] as HTMLInputElement).id;
    expect(altId0).not.toBe('');
    expect(altId1).not.toBe('');
    expect(altId0).not.toBe(altId1);

    // And the labels resolve to disjoint elements (Playwright strict-mode
    // proxy: `getByLabelText` throws if multiple match).
    expect(screen.getByLabelText('Image choose image')).toBeDefined();
    expect(screen.getByLabelText('After image choose image')).toBeDefined();
  });
});
