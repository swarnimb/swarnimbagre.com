'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import DeleteConfirmModal from '@/components/admin/DeleteConfirmModal';
import { deleteOrphanImages } from '@/lib/admin-images-mutations';
import { GENERIC_FORM_ERROR } from '@/lib/auth-constants';

/** Empty-state copy. CONSTRAINT-13: terse, no decoration, no SaaS phrasing. */
const EMPTY_STATE = 'No orphaned images.';

/** Singular resource label rendered into the confirm dialog title. */
const RESOURCE_LABEL = 'orphaned images';

/** Trigger button label. CONSTRAINT-13: dry. */
const TRIGGER_LABEL = 'Clean orphans';

/** Bytes per megabyte. Named per CQ-04 — the `~M MB` format string is the
 * load-bearing constant. */
const BYTES_PER_MB = 1024 * 1024;

/** Row shape this component renders. Mirrors `OrphanImageRow` from
 * `lib/admin-images-orphan.ts` plus an optional pre-fetched `size` (bytes)
 * the page may have looked up via Storage `list()` for the preview column. */
export interface OrphanRow {
  id: string;
  bucket_path: string;
  created_at: string;
  size: number | null;
}

/**
 * Props for {@link OrphanCleanup}.
 */
export interface OrphanCleanupProps {
  /** Pre-fetched orphan rows older than the grace period. Server page owns
   * the fetch via {@link import('@/lib/admin-images-orphan').listOrphanImages}. */
  rows: OrphanRow[];
  /**
   * Optional injected action — tests override this to avoid Server Action
   * wiring under jsdom. Defaults to the production
   * {@link import('@/lib/admin-images-mutations').deleteOrphanImages}.
   */
  cleanupAction?: typeof deleteOrphanImages;
}

/** Format an ISO timestamp into a compact YYYY-MM-DD for the Created column. */
function formatCreated(iso: string): string {
  return iso.slice(0, 10);
}

/** Format a byte size as `~N.N MB` (1 decimal). Returns `'—'` when null —
 * size lookup may have failed for an individual row but the rest of the
 * sweep is still actionable. */
function formatSize(bytes: number | null): string {
  if (bytes === null) return '-';
  return `~${(bytes / BYTES_PER_MB).toFixed(1)} MB`;
}

/** Compose the success toast string. Extracted so the test can compare
 * against a single source of truth without re-deriving the format. */
function successMessage(deleted: number, freedBytes: number): string {
  return `Deleted ${deleted} image${deleted === 1 ? '' : 's'}, freed ${formatSize(freedBytes)}`;
}

/**
 * Admin orphan-image cleanup view. Lists the current orphan rows older
 * than the {@link import('@/lib/admin-images-orphan').ORPHAN_CLEANUP_THRESHOLD_DAYS}
 * grace period; the "Clean orphans" button opens a generic
 * {@link DeleteConfirmModal} (resource: `'orphaned images'`, name:
 * interpolated count) and, on confirm, calls the
 * `deleteOrphanImages` Server Action.
 *
 * On success: closes the modal, surfaces a sonner toast `Deleted N
 * images, freed ~M MB`, and calls `router.refresh()` so the list
 * re-renders empty (or with whatever orphans aged in between renders).
 *
 * On error: keeps the modal open, surfaces an inline error message above
 * the table — the modal also pre-clears its pending state so the user can
 * retry. (Errors are also loud-logged server-side via the throwing helper
 * — EH-01, EH-02, EH-04.)
 *
 * @param props See {@link OrphanCleanupProps}.
 * @returns React element rendering the orphan list + cleanup trigger.
 */
export default function OrphanCleanup({
  rows,
  cleanupAction = deleteOrphanImages,
}: OrphanCleanupProps): React.ReactElement {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [inlineError, setInlineError] = useState<string>('');

  async function handleConfirm(): Promise<void> {
    setInlineError('');
    const result = await cleanupAction();
    if (result.status === 'ok') {
      toast.success(
        successMessage(result.deleted ?? 0, result.freedBytes ?? 0),
      );
      setIsOpen(false);
      router.refresh();
      return;
    }
    setInlineError(result.formError ?? GENERIC_FORM_ERROR);
    toast.error(result.formError ?? GENERIC_FORM_ERROR);
  }

  const count = rows.length;
  const confirmName = `${count} row${count === 1 ? '' : 's'}`;

  return (
    <section className="px-6 py-10 space-y-6">
      <header className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">
          Orphaned images
        </h2>
        <Button
          type="button"
          variant="destructive"
          onClick={() => setIsOpen(true)}
          disabled={count === 0}
        >
          {TRIGGER_LABEL}
        </Button>
      </header>

      {inlineError ? (
        <p role="alert" className="text-sm text-destructive">
          {inlineError}
        </p>
      ) : null}

      {count === 0 ? (
        <p className="text-sm text-muted-foreground">{EMPTY_STATE}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bucket path</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Size</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-mono text-xs">
                  {row.bucket_path}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatCreated(row.created_at)}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {formatSize(row.size)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <DeleteConfirmModal
        resource={RESOURCE_LABEL}
        name={confirmName}
        onConfirm={handleConfirm}
        isOpen={isOpen}
        onOpenChange={setIsOpen}
      />
    </section>
  );
}
