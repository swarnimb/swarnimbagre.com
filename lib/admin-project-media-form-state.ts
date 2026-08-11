import type { AdminMediaPreview, AdminProjectMediaRow } from '@/lib/admin-project-media-preview';

/**
 * Local-only kind discriminator. NOT a DB column — derived from
 * `image_after_id !== null` for loaded rows, set by which "+" button
 * created the row for new rows.
 */
export type ProjectMediaRowKind = 'single' | 'pair';

/**
 * In-form state shape for one media row. Mirrors the wire payload
 * (`{ image_id, image_after_id }`) plus local-only fields the form needs.
 * `image_id` is `string | null` because new rows start without an uploaded
 * image — the DB column is NOT NULL, so save is blocked until the upload
 * completes.
 */
export interface ProjectMediaRowState {
  /** Stable React key + DOM-id base. The `project_media` row id for loaded
   *  rows (SSR-safe); a client-minted `crypto.randomUUID()` for new rows
   *  (which are only ever added post-hydration in an event handler). */
  uid: string;
  kind: ProjectMediaRowKind;
  image_id: string | null;
  imagePreview: AdminMediaPreview;
  image_after_id: string | null;
  imageAfterPreview: AdminMediaPreview;
}

/** Wire-format row sent to `saveProjectMedia`. Order in the array is the
 *  display order — the RPC derives `order_index` via `WITH ORDINALITY`. */
export interface ProjectMediaWireRow {
  image_id: string;
  image_after_id: string | null;
}

/**
 * Lift a loader row into the form-state shape: derive `kind`, reuse the
 * `project_media` row id as `uid`. The DB id (not a fresh `randomUUID`)
 * is deliberate — `fromLoaderRow` runs in the `useState` initializer of a
 * `'use client'` component, which executes on BOTH the SSR pass and the
 * client hydration pass. A minted UUID would differ between the two and
 * trip a React hydration mismatch on the row's DOM ids.
 */
export function fromLoaderRow(row: AdminProjectMediaRow): ProjectMediaRowState {
  return {
    uid: row.id,
    kind: row.image_after_id !== null ? 'pair' : 'single',
    image_id: row.image_id,
    image_after_id: row.image_after_id,
    imagePreview: row.imagePreview,
    imageAfterPreview: row.imageAfterPreview,
  };
}

/** Mint a fresh empty row of the chosen kind. */
export function newRow(kind: ProjectMediaRowKind): ProjectMediaRowState {
  return {
    uid: crypto.randomUUID(),
    kind,
    image_id: null,
    image_after_id: null,
    imagePreview: null,
    imageAfterPreview: null,
  };
}

/**
 * Row is save-eligible when its required FK(s) are filled. Single rows
 * need `image_id`; pair rows need both. The form blocks Save until every
 * row is complete — partial uploads cannot be persisted, preventing
 * silent data loss.
 */
export function isRowComplete(row: ProjectMediaRowState): boolean {
  if (row.image_id === null) return false;
  if (row.kind === 'pair' && row.image_after_id === null) return false;
  return true;
}

/** Convert form rows to the wire payload, dropping local-only fields. The
 *  boundary schema is `.strict()`, so nothing extra may ride along. */
export function toWirePayload(rows: ProjectMediaRowState[]): ProjectMediaWireRow[] {
  return rows.filter(isRowComplete).map((row) => ({
    image_id: row.image_id as string,
    image_after_id: row.kind === 'pair' ? row.image_after_id : null,
  }));
}

/** Pure reorder: move `from` to `to` in a new array. Same-index is a no-op. */
export function reorderRows<T>(rows: T[], from: number, to: number): T[] {
  if (from === to) return rows;
  const next = [...rows];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
