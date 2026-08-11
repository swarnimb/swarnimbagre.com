import { describe, it, expect } from 'vitest';
import {
  fromLoaderRow,
  isRowComplete,
  newRow,
  reorderRows,
  toWirePayload,
  type ProjectMediaRowState,
} from '@/lib/admin-project-media-form-state';
import type { AdminProjectMediaRow } from '@/lib/admin-project-media-preview';

/**
 * Pure-function coverage for the T43.F project-media form-state helpers
 * (TS-01 — happy + error path per function with logic). These functions
 * are also exercised transitively by `ProjectMediaField.test.tsx`; this
 * file pins the branch logic directly.
 */

const IMAGE_A = '00000000-0000-4000-8000-0000000000a1';
const IMAGE_B = '00000000-0000-4000-8000-0000000000b2';
const ROW_ID = '00000000-0000-4000-8000-0000000000c3';

/** Build a complete single-kind form row for assertions. */
function completeSingle(overrides: Partial<ProjectMediaRowState> = {}): ProjectMediaRowState {
  return {
    uid: 'uid-single',
    kind: 'single',
    image_id: IMAGE_A,
    imagePreview: null,
    image_after_id: null,
    imageAfterPreview: null,
    ...overrides,
  };
}

describe('fromLoaderRow', () => {
  it('derives single kind when image_after_id is null', () => {
    const loaded: AdminProjectMediaRow = {
      id: ROW_ID,
      image_id: IMAGE_A,
      imagePreview: null,
      image_after_id: null,
      imageAfterPreview: null,
    };
    const row = fromLoaderRow(loaded);
    expect(row.kind).toBe('single');
    expect(row.image_id).toBe(IMAGE_A);
    expect(row.uid).not.toBe('');
  });

  it('derives pair kind when image_after_id is set', () => {
    const loaded: AdminProjectMediaRow = {
      id: ROW_ID,
      image_id: IMAGE_A,
      imagePreview: null,
      image_after_id: IMAGE_B,
      imageAfterPreview: null,
    };
    expect(fromLoaderRow(loaded).kind).toBe('pair');
  });

  it('uses the project_media row id as uid (SSR-stable, not a fresh UUID)', () => {
    const loaded: AdminProjectMediaRow = {
      id: ROW_ID,
      image_id: IMAGE_A,
      imagePreview: null,
      image_after_id: null,
      imageAfterPreview: null,
    };
    expect(fromLoaderRow(loaded).uid).toBe(ROW_ID);
  });
});

describe('newRow', () => {
  it('builds an empty single row with null image_id', () => {
    const row = newRow('single');
    expect(row.kind).toBe('single');
    expect(row.image_id).toBeNull();
    expect(row.image_after_id).toBeNull();
    expect(row.uid).not.toBe('');
  });

  it('builds an empty pair row', () => {
    expect(newRow('pair').kind).toBe('pair');
  });
});

describe('isRowComplete', () => {
  it('single row is complete once image_id is set', () => {
    expect(isRowComplete(completeSingle())).toBe(true);
  });

  it('single row is incomplete when image_id is null', () => {
    expect(isRowComplete(completeSingle({ image_id: null }))).toBe(false);
  });

  it('pair row needs both image_id and image_after_id', () => {
    const pair = completeSingle({ kind: 'pair', image_after_id: IMAGE_B });
    expect(isRowComplete(pair)).toBe(true);
    expect(isRowComplete({ ...pair, image_after_id: null })).toBe(false);
  });
});

describe('toWirePayload', () => {
  it('maps complete rows to the wire shape, dropping local-only fields', () => {
    // toEqual is exact — a local-only field (uid, kind, imagePreview) or a
    // retired one (caption) leaking into the payload fails this. The
    // boundary schema is `.strict()`, so a leak would reject the save.
    const payload = toWirePayload([completeSingle()]);
    expect(payload).toEqual([{ image_id: IMAGE_A, image_after_id: null }]);
  });

  it('filters out incomplete rows', () => {
    const rows = [completeSingle(), completeSingle({ uid: 'x', image_id: null })];
    expect(toWirePayload(rows)).toHaveLength(1);
  });

  it('forces image_after_id null for single rows', () => {
    const single = completeSingle({ image_after_id: IMAGE_B });
    expect(toWirePayload([single])[0].image_after_id).toBeNull();
  });

  it('preserves row order (the RPC derives order_index from position)', () => {
    const first = completeSingle({ uid: '1', image_id: IMAGE_A });
    const second = completeSingle({ uid: '2', image_id: IMAGE_B });
    const payload = toWirePayload([second, first]);
    expect(payload.map((r) => r.image_id)).toEqual([IMAGE_B, IMAGE_A]);
  });
});

describe('reorderRows', () => {
  it('moves an element from one index to another', () => {
    expect(reorderRows(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
  });

  it('returns the same reference for a same-index no-op', () => {
    const rows = ['a', 'b', 'c'];
    expect(reorderRows(rows, 1, 1)).toBe(rows);
  });
});
