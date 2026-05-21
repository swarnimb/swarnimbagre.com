'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import ProjectMediaRow from '@/components/admin/ProjectMediaRow';
import DeleteConfirmModal from '@/components/admin/DeleteConfirmModal';
import { saveProjectMedia } from '@/lib/admin-project-media-mutations';
import {
  PROJECT_MEDIA_MAX_ROWS,
  PROJECT_MEDIA_MUTATION_INITIAL_STATE,
  type ProjectMediaMutationState,
} from '@/lib/admin-project-media-mutations-types';
import {
  fromLoaderRow,
  isRowComplete,
  newRow,
  reorderRows,
  toWirePayload,
  type ProjectMediaRowKind,
  type ProjectMediaRowState,
} from '@/lib/admin-project-media-form-state';
import type { AdminProjectMediaRow } from '@/lib/admin-project-media-preview';

/** Threshold above which the over-cap soft-warning renders. */
const ROWS_SOFT_WARN_THRESHOLD = 10;

/** CONSTRAINT-13 voice copy — operator-facing labels. */
const ADD_IMAGE_LABEL = '+ image';
const ADD_PAIR_LABEL = '+ pair';
const SAVE_LABEL = 'Save media';
const SAVE_PENDING_LABEL = 'Saving';
const SAVE_SUCCESS_MESSAGE = 'Media saved.';
const DELETE_RESOURCE = 'row';
const HARD_BLOCK_HINT = 'Trim to 20 rows to add more.';
const SOFT_WARN_HINT = '11+ rows may slow render. Consider splitting.';
const SECTION_TITLE = 'Media';

/** Props for {@link ProjectMediaField}. */
export interface ProjectMediaFieldProps {
  /** Owning project UUID. */
  projectId: string;
  /** Loader-provided initial rows. Empty when the project has no media. */
  initialMedia: AdminProjectMediaRow[];
  /** Optional injected action — tests override to avoid Server Action wiring. */
  saveAction?: typeof saveProjectMedia;
}

/**
 * List-level field for project media — owns the rows array, drag-reorder
 * state, the "Save media" trigger, and the per-row delete confirm modal.
 *
 * Mounted inside `ProjectForm` but renders its own Save trigger — HTML
 * forbids nested `<form>` (architecture §6.6.7) and one submit cannot
 * route to two distinct Server Actions. Project metadata and project
 * media save independently. Atomicity for media writes is provided by
 * the `save_project_media` RPC (migration 010a).
 */
export default function ProjectMediaField({
  projectId,
  initialMedia,
  saveAction = saveProjectMedia,
}: ProjectMediaFieldProps): React.ReactElement {
  const [rows, setRows] = useState<ProjectMediaRowState[]>(() =>
    initialMedia.map(fromLoaderRow),
  );
  // Drag-source index. A ref, not state — it is never read during render,
  // only passed between the `dragstart` and `drop` handlers. A ref also
  // updates synchronously, so a drop in the same tick as its dragstart
  // (rapid drags; synchronous test dispatch) reads the correct source.
  const draggingIndexRef = useRef<number | null>(null);
  const [pendingDeleteUid, setPendingDeleteUid] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const [state, dispatch, isPending] = useActionState<
    ProjectMediaMutationState,
    FormData
  >(saveAction, PROJECT_MEDIA_MUTATION_INITIAL_STATE);

  // Dedupe toast firing across re-renders — mirrors `handledStateRef` in
  // `ImageUpload`. useEffect alone would refire on unrelated re-renders.
  const handledStateRef = useRef<ProjectMediaMutationState | null>(null);
  useEffect(() => {
    if (handledStateRef.current === state) return;
    if (state.status === 'ok') {
      handledStateRef.current = state;
      toast.success(SAVE_SUCCESS_MESSAGE);
    } else if (state.status === 'error') {
      handledStateRef.current = state;
    }
  }, [state]);

  const rowCount = rows.length;
  const isHardCapped = rowCount >= PROJECT_MEDIA_MAX_ROWS;
  const isOverSoftWarn = rowCount > ROWS_SOFT_WARN_THRESHOLD;
  const everyRowComplete = rows.every(isRowComplete);
  const saveDisabled = isPending || rowCount === 0 || !everyRowComplete;

  function addRow(kind: ProjectMediaRowKind): void {
    if (isHardCapped) return;
    setRows((current) => [...current, newRow(kind)]);
  }

  function patchRow(index: number, next: ProjectMediaRowState): void {
    setRows((current) => current.map((row, i) => (i === index ? next : row)));
  }

  function confirmDelete(): Promise<void> {
    if (pendingDeleteUid === null) return Promise.resolve();
    setRows((current) => current.filter((row) => row.uid !== pendingDeleteUid));
    setPendingDeleteUid(null);
    return Promise.resolve();
  }

  function onDragOver(event: React.DragEvent): void {
    // Without preventDefault HTML5 drop targets refuse the drop silently.
    event.preventDefault();
  }

  function onDrop(targetIndex: number): void {
    const from = draggingIndexRef.current;
    if (from === null) return;
    setRows((current) => reorderRows(current, from, targetIndex));
    draggingIndexRef.current = null;
  }

  function handleSave(): void {
    if (saveDisabled) return;
    const formData = new FormData();
    formData.append('project_id', projectId);
    formData.append('rows', JSON.stringify(toWirePayload(rows)));
    startTransition(() => dispatch(formData));
  }

  const pendingDeleteIndex =
    pendingDeleteUid === null
      ? -1
      : rows.findIndex((r) => r.uid === pendingDeleteUid);

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{SECTION_TITLE}</h2>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={() => addRow('single')} disabled={isHardCapped}>
            {ADD_IMAGE_LABEL}
          </Button>
          <Button type="button" variant="outline" onClick={() => addRow('pair')} disabled={isHardCapped}>
            {ADD_PAIR_LABEL}
          </Button>
        </div>
      </header>

      {state.status === 'error' && state.formError ? (
        <p role="alert" className="text-sm text-destructive">{state.formError}</p>
      ) : null}

      {isHardCapped ? (
        <p role="alert" className="text-sm text-destructive">{HARD_BLOCK_HINT}</p>
      ) : isOverSoftWarn ? (
        <p className="text-sm text-destructive">{SOFT_WARN_HINT}</p>
      ) : null}

      <ol className="space-y-3" aria-label="Project media rows">
        {rows.map((row, index) => (
          <li key={row.uid}>
            <ProjectMediaRow
              row={row}
              index={index}
              projectId={projectId}
              onChange={(next) => patchRow(index, next)}
              onDelete={() => setPendingDeleteUid(row.uid)}
              onDragStart={(i) => {
                draggingIndexRef.current = i;
              }}
              onDragOver={onDragOver}
              onDrop={onDrop}
            />
          </li>
        ))}
      </ol>

      <div>
        <Button type="button" onClick={handleSave} disabled={saveDisabled}>
          {isPending ? SAVE_PENDING_LABEL : SAVE_LABEL}
        </Button>
      </div>

      <DeleteConfirmModal
        resource={DELETE_RESOURCE}
        name={pendingDeleteIndex >= 0 ? `row ${pendingDeleteIndex + 1}` : ''}
        onConfirm={confirmDelete}
        isOpen={pendingDeleteUid !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteUid(null);
        }}
      />
    </section>
  );
}
