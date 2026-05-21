import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { toast } from 'sonner';
import ProjectMediaField from '@/components/admin/ProjectMediaField';
import type { AdminProjectMediaRow } from '@/lib/admin-project-media-preview';
import type { ProjectMediaMutationState } from '@/lib/admin-project-media-mutations-types';

/**
 * T43.F acceptance — ProjectMediaField list-level form. Mirrors
 * `tests/ImageUpload.test.tsx`: top-level mocks, cleanup in afterEach,
 * vi.fn().mockResolvedValue for the injected saveAction. Lets
 * `ProjectMediaRow` render naturally — row count via list items, pair
 * detection via the distinct "After image choose image" label.
 */

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

const TEST_PROJECT_ID = '00000000-0000-4000-8000-000000000a43';
const TEST_IMAGE_ID_A = '00000000-0000-4000-8000-000000000aa1';
const TEST_IMAGE_ID_B = '00000000-0000-4000-8000-000000000aa2';
const TEST_IMAGE_ID_C = '00000000-0000-4000-8000-000000000aa3';
const OK_STATE: ProjectMediaMutationState = { status: 'ok' };

// Monotonic counter — each loader row needs a UNIQUE `id`. `fromLoaderRow`
// now reuses the row id as the React key (SSR-stable), so duplicate ids
// would collide. Counter keeps ids valid-UUID-shaped and deterministic.
let rowIdCounter = 0;
function nextRowId(): string {
  rowIdCounter += 1;
  return `00000000-0000-4000-8000-${String(rowIdCounter).padStart(12, '0')}`;
}

function loaderRow(image_id: string, caption: string | null, after: string | null = null): AdminProjectMediaRow {
  return {
    id: nextRowId(),
    image_id,
    image_after_id: after,
    caption,
    imagePreview: { signedUrl: `https://example.test/${image_id}.png`, altText: `alt-${image_id}` },
    imageAfterPreview: after
      ? { signedUrl: `https://example.test/${after}.png`, altText: `alt-${after}` }
      : null,
  };
}

// Reuse the same dummy FK — each row still gets a unique `id` via the
// counter, so duplicate FKs are fine for over-cap render tests.
function manyRows(n: number): AdminProjectMediaRow[] {
  return Array.from({ length: n }, () => loaderRow(TEST_IMAGE_ID_A, null));
}

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('ProjectMediaField', () => {
  it('renders initial rows in order from initialMedia', () => {
    render(
      <ProjectMediaField
        projectId={TEST_PROJECT_ID}
        initialMedia={[
          loaderRow(TEST_IMAGE_ID_A, 'first'),
          loaderRow(TEST_IMAGE_ID_B, 'second'),
          loaderRow(TEST_IMAGE_ID_C, 'third'),
        ]}
        saveAction={vi.fn().mockResolvedValue(OK_STATE)}
      />,
    );
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(within(items[0]).getByText('first')).toBeInTheDocument();
    expect(within(items[1]).getByText('second')).toBeInTheDocument();
    expect(within(items[2]).getByText('third')).toBeInTheDocument();
  });

  it('+ image button appends a single row', () => {
    render(
      <ProjectMediaField projectId={TEST_PROJECT_ID} initialMedia={[]} saveAction={vi.fn().mockResolvedValue(OK_STATE)} />,
    );
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    act(() => { fireEvent.click(screen.getByRole('button', { name: '+ image' })); });
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(1);
    expect(within(items[0]).getByLabelText('Image choose image')).toBeInTheDocument();
    expect(within(items[0]).queryByLabelText('After image choose image')).not.toBeInTheDocument();
  });

  it('+ pair button appends a pair row', () => {
    render(
      <ProjectMediaField projectId={TEST_PROJECT_ID} initialMedia={[]} saveAction={vi.fn().mockResolvedValue(OK_STATE)} />,
    );
    act(() => { fireEvent.click(screen.getByRole('button', { name: '+ pair' })); });
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(1);
    expect(within(items[0]).getByLabelText('Before image choose image')).toBeInTheDocument();
    expect(within(items[0]).getByLabelText('After image choose image')).toBeInTheDocument();
  });

  it('over-cap soft-warn renders at 11+ rows', () => {
    render(
      <ProjectMediaField projectId={TEST_PROJECT_ID} initialMedia={manyRows(11)} saveAction={vi.fn().mockResolvedValue(OK_STATE)} />,
    );
    expect(screen.getByText('11+ rows may slow render. Consider splitting.')).toBeInTheDocument();
  });

  it('hard-block at 20+ rows: add buttons disabled, hint visible', () => {
    render(
      <ProjectMediaField projectId={TEST_PROJECT_ID} initialMedia={manyRows(20)} saveAction={vi.fn().mockResolvedValue(OK_STATE)} />,
    );
    expect((screen.getByRole('button', { name: '+ image' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: '+ pair' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Trim to 20 rows to add more.')).toBeInTheDocument();
  });

  it('delete button opens confirm modal with row index in name', () => {
    render(
      <ProjectMediaField
        projectId={TEST_PROJECT_ID}
        initialMedia={[loaderRow(TEST_IMAGE_ID_A, 'one'), loaderRow(TEST_IMAGE_ID_B, 'two')]}
        saveAction={vi.fn().mockResolvedValue(OK_STATE)}
      />,
    );
    const items = screen.getAllByRole('listitem');
    act(() => { fireEvent.click(within(items[1]).getByRole('button', { name: 'Delete' })); });
    expect(screen.getByRole('dialog')).toHaveTextContent(/row 2/);
  });

  it('Save media disabled when rows is empty', () => {
    render(
      <ProjectMediaField projectId={TEST_PROJECT_ID} initialMedia={[]} saveAction={vi.fn().mockResolvedValue(OK_STATE)} />,
    );
    expect((screen.getByRole('button', { name: 'Save media' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('Save media disabled when a row is incomplete (image_id null)', () => {
    const saveAction = vi.fn().mockResolvedValue(OK_STATE);
    render(
      <ProjectMediaField projectId={TEST_PROJECT_ID} initialMedia={[]} saveAction={saveAction} />,
    );
    act(() => { fireEvent.click(screen.getByRole('button', { name: '+ image' })); });
    expect((screen.getByRole('button', { name: 'Save media' }) as HTMLButtonElement).disabled).toBe(true);
    expect(saveAction).not.toHaveBeenCalled();
  });

  it('Save media dispatches with project_id + JSON-stringified rows when all complete', async () => {
    const saveAction = vi.fn().mockResolvedValue(OK_STATE);
    render(
      <ProjectMediaField
        projectId={TEST_PROJECT_ID}
        initialMedia={[loaderRow(TEST_IMAGE_ID_A, 'shipped')]}
        saveAction={saveAction}
      />,
    );
    const save = screen.getByRole('button', { name: 'Save media' }) as HTMLButtonElement;
    expect(save.disabled).toBe(false);
    await act(async () => { fireEvent.click(save); });
    await waitFor(() => { expect(saveAction).toHaveBeenCalledTimes(1); });
    // useActionState invokes (prevState, formData) — formData is arg[1].
    const formData = saveAction.mock.calls[0][1] as FormData;
    expect(formData.get('project_id')).toBe(TEST_PROJECT_ID);
    const rows = JSON.parse(formData.get('rows') as string);
    expect(rows).toEqual([{ image_id: TEST_IMAGE_ID_A, image_after_id: null, caption: 'shipped' }]);
    // Wire shape must NOT leak local-only form-state fields.
    expect(rows[0]).not.toHaveProperty('uid');
    expect(rows[0]).not.toHaveProperty('kind');
    expect(rows[0]).not.toHaveProperty('imagePreview');
  });

  it('toast.success fires once on state.status === ok', async () => {
    const saveAction = vi.fn().mockResolvedValue(OK_STATE);
    render(
      <ProjectMediaField
        projectId={TEST_PROJECT_ID}
        initialMedia={[loaderRow(TEST_IMAGE_ID_A, null)]}
        saveAction={saveAction}
      />,
    );
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save media' })); });
    await waitFor(() => { expect(toast.success).toHaveBeenCalledWith('Media saved.'); });
    expect(toast.success).toHaveBeenCalledTimes(1);
  });
});
