/**
 * T47 — protect the builder's project ordering from the e2e suite.
 *
 * The T44.D step in `admin-smoke.spec.ts` drags the first two rows of
 * `/admin/projects` and clicks "Save order". `saveProjectOrder` rewrites
 * `sort_order` on EVERY project row, not just the fixture rows, and the step
 * grabs `tbody tr` positions 0 and 1 — whatever happens to be there. With no
 * staging database (CONSTRAINT-02) that permanently reorders the builder's real
 * projects on `/projects`, and no row sweep can undo it: the original order is
 * data, not derivable after the fact.
 *
 * So it is captured before the suite runs and written back after. This is the
 * "snapshot and restore the real rows' `sort_order`" branch of the T47 spec;
 * the alternative branch — scoping the reorder step — is not achievable,
 * because "Save order" submits the whole list regardless of which rows moved.
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { CleanupQueryError } from './cleanup';

/**
 * Where the snapshot lives between global setup and global teardown. Under
 * `test-results/`, which `.gitignore` already excludes, so no ordering data
 * is ever committed.
 */
export const SORT_ORDER_SNAPSHOT_PATH = resolve(
  process.cwd(),
  'test-results',
  'projects-sort-order.json',
);

/** One project's ordering position, as it stood before the suite ran. */
export interface SortOrderEntry {
  id: string;
  sort_order: number;
}

/** Named error for a snapshot that is missing or unreadable at restore (EH-05). */
export class SortOrderSnapshotError extends Error {
  public readonly operation: string;

  constructor(message: string, options: { operation: string; cause?: unknown }) {
    super(`${message} path=${SORT_ORDER_SNAPSHOT_PATH} operation=${options.operation}`, {
      cause: options.cause,
    });
    this.name = 'SortOrderSnapshotError';
    this.operation = options.operation;
  }
}

/**
 * Record every project's current `sort_order` to disk.
 *
 * @param client Service-role client.
 * @returns How many rows were captured.
 */
export async function snapshotProjectSortOrder(client: SupabaseClient): Promise<number> {
  const operation = 'snapshotProjectSortOrder';
  const { data, error } = await client.from('projects').select('id, sort_order');
  if (error) {
    throw new CleanupQueryError({ operation, table: 'projects', cause: error });
  }
  const entries = (data ?? []) as SortOrderEntry[];
  mkdirSync(dirname(SORT_ORDER_SNAPSHOT_PATH), { recursive: true });
  writeFileSync(SORT_ORDER_SNAPSHOT_PATH, JSON.stringify(entries, null, 2), 'utf8');
  return entries.length;
}

/** Read the snapshot back, or throw if it is absent or malformed. */
function readSnapshot(operation: string): SortOrderEntry[] {
  if (!existsSync(SORT_ORDER_SNAPSHOT_PATH)) {
    throw new SortOrderSnapshotError('Sort-order snapshot is missing at teardown.', { operation });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(SORT_ORDER_SNAPSHOT_PATH, 'utf8'));
  } catch (cause) {
    throw new SortOrderSnapshotError('Sort-order snapshot is not valid JSON.', { operation, cause });
  }
  if (!Array.isArray(parsed)) {
    throw new SortOrderSnapshotError('Sort-order snapshot is not an array.', { operation });
  }
  return parsed as SortOrderEntry[];
}

/**
 * Write the snapshotted `sort_order` values back.
 *
 * Runs after the sweep, so fixture projects are already gone; a snapshot entry
 * whose row no longer exists simply updates nothing. The snapshot file is
 * removed on success so a later run cannot restore a stale ordering.
 *
 * @param client Service-role client.
 * @returns How many rows were written back.
 */
export async function restoreProjectSortOrder(client: SupabaseClient): Promise<number> {
  const operation = 'restoreProjectSortOrder';
  const entries = readSnapshot(operation);
  let restored = 0;
  for (const entry of entries) {
    const { data, error } = await client
      .from('projects')
      .update({ sort_order: entry.sort_order })
      .eq('id', entry.id)
      .select('id');
    if (error) {
      throw new CleanupQueryError({
        operation,
        table: 'projects',
        cause: error,
        detail: `id=${entry.id} sort_order=${entry.sort_order}`,
      });
    }
    restored += (data ?? []).length;
  }
  rmSync(SORT_ORDER_SNAPSHOT_PATH, { force: true });
  return restored;
}
