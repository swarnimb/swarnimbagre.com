import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import ProjectMediaRow from '@/components/admin/ProjectMediaRow';
import type { ProjectMediaRowState } from '@/lib/admin-project-media-form-state';

/**
 * T43.F acceptance — UI: `ProjectMediaRow` slot-shape, preview branches,
 * caption length/warn behavior, delete + drag callbacks. The child
 * `ImageUpload` widget has its own dedicated test file — coverage here
 * stays scoped to the row's local behavior.
 */

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const TEST_PROJECT_ID = '00000000-0000-4000-8000-000000000a43';
const TEST_ROW_UID = '00000000-0000-4000-8000-000000000777';
const CAPTION_MAX = 280;
const CAPTION_WARN_THRESHOLD = 140;

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

function baseRow(overrides: Partial<ProjectMediaRowState> = {}): ProjectMediaRowState {
  return {
    uid: TEST_ROW_UID,
    kind: 'single',
    image_id: null,
    imagePreview: null,
    image_after_id: null,
    imageAfterPreview: null,
    caption: null,
    ...overrides,
  };
}

function renderRow(
  rowOverrides: Partial<ProjectMediaRowState> = {},
  propsOverrides: Partial<{
    index: number;
    onChange: ReturnType<typeof vi.fn>;
    onDelete: ReturnType<typeof vi.fn>;
    onDragStart: ReturnType<typeof vi.fn>;
    onDragOver: ReturnType<typeof vi.fn>;
    onDrop: ReturnType<typeof vi.fn>;
  }> = {},
) {
  const onChange = propsOverrides.onChange ?? vi.fn();
  const onDelete = propsOverrides.onDelete ?? vi.fn();
  const onDragStart = propsOverrides.onDragStart ?? vi.fn();
  const onDragOver = propsOverrides.onDragOver ?? vi.fn();
  const onDrop = propsOverrides.onDrop ?? vi.fn();
  const index = propsOverrides.index ?? 0;
  const utils = render(
    <ProjectMediaRow
      row={baseRow(rowOverrides)}
      index={index}
      projectId={TEST_PROJECT_ID}
      onChange={onChange}
      onDelete={onDelete}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
    />,
  );
  return { ...utils, onChange, onDelete, onDragStart, onDragOver, onDrop };
}

describe('ProjectMediaRow — slot shape per kind', () => {
  it('renders single-kind row with one image slot and Image label', () => {
    renderRow({ kind: 'single' });
    expect(screen.getByLabelText('Image choose image')).toBeDefined();
    expect(screen.queryByLabelText('Before image choose image')).toBeNull();
    expect(screen.queryByLabelText('After image choose image')).toBeNull();
  });

  it('renders pair-kind row with two image slots (Before + After)', () => {
    renderRow({ kind: 'pair' });
    expect(screen.getByLabelText('Before image choose image')).toBeDefined();
    expect(screen.getByLabelText('After image choose image')).toBeDefined();
    expect(screen.queryByLabelText('Image choose image')).toBeNull();
  });
});

describe('ProjectMediaRow — image preview branches', () => {
  it('renders preview img when imagePreview.signedUrl is set', () => {
    const { container } = renderRow({
      kind: 'single',
      imagePreview: { signedUrl: 'https://example.com/x.png', altText: 'alpha' },
    });
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect((img as HTMLImageElement).src).toBe('https://example.com/x.png');
    expect((img as HTMLImageElement).alt).toBe('alpha');
  });

  it('renders post-upload hint when imagePreview is set but signedUrl is empty', () => {
    renderRow({
      kind: 'single',
      imagePreview: { signedUrl: '', altText: 'alpha' },
    });
    expect(screen.getByText('New image saved. Preview refreshes after save.')).toBeDefined();
  });

  it('renders no preview img and no hint when imagePreview is null', () => {
    const { container } = renderRow({ kind: 'single', imagePreview: null });
    expect(container.querySelector('img')).toBeNull();
    expect(screen.queryByText('New image saved. Preview refreshes after save.')).toBeNull();
  });
});

describe('ProjectMediaRow — caption', () => {
  it('caption textarea reflects row.caption value', () => {
    renderRow({ caption: 'hello' });
    const textarea = document.getElementById(`caption-${TEST_ROW_UID}`) as HTMLTextAreaElement;
    expect(textarea.value).toBe('hello');
  });

  it('caption counter shows length/max', () => {
    renderRow({ caption: 'hello' });
    expect(screen.getByText(`5/${CAPTION_MAX}`)).toBeDefined();
  });

  it('caption counter soft-warn style at >= 140 chars', () => {
    const longCaption = 'a'.repeat(150);
    renderRow({ caption: longCaption });
    const counter = screen.getByText(`150/${CAPTION_MAX}`);
    // Soft-warn uses the admin destructive token (CONSTRAINT-16) — the
    // counter drops the muted style once the threshold is crossed.
    expect(counter.className).toContain('text-destructive');
    expect(counter.className).not.toContain('text-muted-foreground');
    // Sanity check the threshold constant matches what the component uses.
    expect(longCaption.length).toBeGreaterThanOrEqual(CAPTION_WARN_THRESHOLD);
  });

  it('caption onChange collapses empty string to null', () => {
    const onChange = vi.fn();
    renderRow({ caption: 'x' }, { onChange });
    const textarea = document.getElementById(`caption-${TEST_ROW_UID}`) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    const callArg = onChange.mock.calls[0][0] as ProjectMediaRowState;
    expect(callArg.caption).toBeNull();
  });
});

describe('ProjectMediaRow — delete + drag', () => {
  it('Delete button fires onDelete prop', () => {
    const onDelete = vi.fn();
    renderRow({}, { onDelete });
    const deleteBtn = screen.getByRole('button', { name: 'Delete' });
    fireEvent.click(deleteBtn);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('drag handle has aria-label including 1-indexed row number', () => {
    renderRow({}, { index: 4 });
    expect(screen.getByRole('button', { name: 'Drag row 5' })).toBeDefined();
  });

  it('onDragStart fires with index when row is dragged', () => {
    const onDragStart = vi.fn();
    const { container } = renderRow({}, { index: 2, onDragStart });
    const draggable = container.querySelector('[draggable]') as HTMLElement;
    expect(draggable).not.toBeNull();
    fireEvent.dragStart(draggable);
    expect(onDragStart).toHaveBeenCalledTimes(1);
    expect(onDragStart).toHaveBeenCalledWith(2);
  });
});
