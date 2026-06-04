'use client';

import Link from 'next/link';
import { useActionState, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
// prettier-ignore
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  StatusBadge,
  formatCreated,
  type ResourceListRow,
} from '@/components/admin/ResourceList';
import { reorderRows } from '@/lib/admin-project-media-form-state';
import {
  REORDER_MUTATION_INITIAL_STATE,
  type ReorderMutationState,
} from '@/lib/admin-reorder-mutations-types';

/** CONSTRAINT-13 voice copy — operator-facing labels. */
const DRAG_HANDLE_GLYPH = '⠿';
const SAVE_LABEL = 'Save order';
const SAVE_SUCCESS_MESSAGE = 'Order saved.';
const SAVE_ERROR_FALLBACK = 'Could not save order.';

/**
 * Serialize the ordered rows into the wire shape the reorder Server Action
 * reads: a JSON array of `{ id }` in the desired order. Pure + exported so a
 * unit test can pin the exact string without rendering the component.
 */
export function serializeOrder(rows: { id: string }[]): string {
  return JSON.stringify(rows.map((r) => ({ id: r.id })));
}

/** Props for {@link ResourceListReorder}. */
export interface ResourceListReorderProps<TRow extends ResourceListRow> {
  /** Rows for the current page, in their server-sorted starting order. */
  rows: TRow[];
  /** Path segment after `/admin/` for the Edit link, e.g. `'projects'`. */
  editSegment: string;
  /** Render prop for the per-row delete control (resource-specific button). */
  renderDeleteButton: (row: { id: string; title: string }) => React.ReactNode;
  /** Reorder Server Action — `saveProjectOrder` or `savePostOrder`. */
  saveOrderAction: (
    prev: ReorderMutationState,
    formData: FormData,
  ) => Promise<ReorderMutationState>;
}

/**
 * Reorderable table body for the admin list. Owns the optimistic local row
 * order, the HTML5 drag-reorder state, the explicit "Save order" trigger, and
 * the success/error toast. Split out of {@link ResourceList} (CQ-02 line cap).
 *
 * Drag-reorder is HTML5 native DnD (no new dep). Admin is desktop-only for the
 * single operator — touch-DnD is not a target. The Save trigger is explicit
 * (not auto-save): drag rearranges local state, the operator commits with the
 * button. Reorder persists via the `save_project_order` / `save_post_order`
 * RPC behind the injected Server Action.
 */
export default function ResourceListReorder<TRow extends ResourceListRow>({
  rows,
  editSegment,
  renderDeleteButton,
  saveOrderAction,
}: ResourceListReorderProps<TRow>): React.ReactElement {
  // Optimistic local order. The parent remounts this via `key` on filter/page
  // change, so the server-sorted `rows` re-seed without a resync effect.
  const [orderedRows, setOrderedRows] = useState<TRow[]>(rows);
  // Drag-source index. A ref, not state — it is never read during render, only
  // passed between the `dragstart` and `drop` handlers. A ref also updates
  // synchronously, so a drop in the same tick as its dragstart reads the
  // correct source. Mirrors `ProjectMediaField`.
  const draggingIndexRef = useRef<number | null>(null);

  const [state, formAction, isPending] = useActionState<
    ReorderMutationState,
    FormData
  >(saveOrderAction, REORDER_MUTATION_INITIAL_STATE);

  // Dedupe toast firing across re-renders — mirrors `ProjectMediaField`.
  const handledStateRef = useRef<ReorderMutationState | null>(null);
  useEffect(() => {
    if (handledStateRef.current === state) return;
    if (state.status === 'ok') {
      handledStateRef.current = state;
      toast.success(SAVE_SUCCESS_MESSAGE);
    } else if (state.status === 'error') {
      handledStateRef.current = state;
      toast.error(state.formError ?? SAVE_ERROR_FALLBACK);
    }
  }, [state]);

  function handleDragStart(index: number): void {
    draggingIndexRef.current = index;
  }

  function handleDragOver(event: React.DragEvent): void {
    // Without preventDefault HTML5 drop targets refuse the drop silently.
    event.preventDefault();
  }

  function handleDrop(targetIndex: number): void {
    const from = draggingIndexRef.current;
    if (from === null) return;
    setOrderedRows((current) => reorderRows(current, from, targetIndex));
    draggingIndexRef.current = null;
  }

  return (
    <>
      <form action={formAction} className="flex justify-end">
        <input type="hidden" name="rows" value={serializeOrder(orderedRows)} />
        <Button type="submit" size="sm" disabled={isPending}>
          {SAVE_LABEL}
        </Button>
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead>Title</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orderedRows.map((row, index) => (
            <TableRow
              key={row.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(index)}
            >
              <TableCell>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={`Drag row ${index + 1}`}
                  className="cursor-grab"
                >
                  {DRAG_HANDLE_GLYPH}
                </Button>
              </TableCell>
              <TableCell className="font-medium">{row.title}</TableCell>
              <TableCell className="text-muted-foreground">{row.slug}</TableCell>
              <TableCell>
                <StatusBadge status={row.status} />
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatCreated(row.created_at)}
              </TableCell>
              <TableCell className="text-right">
                <div className="inline-flex items-center gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/admin/${editSegment}/${row.id}`}>Edit</Link>
                  </Button>
                  {renderDeleteButton({ id: row.id, title: row.title })}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
