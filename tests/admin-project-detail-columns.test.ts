import { describe, it, expect } from 'vitest';
import { PROJECT_DETAIL_COLUMNS } from '@/lib/admin-queries-projects';
import type { Project } from '@/lib/types';

/**
 * Guard for the edit-form data-loss class of bug.
 *
 * `getProjectById` casts its result to `Project`, so any column missing from
 * the projection is invisible to the type checker, reaches the edit form as
 * `undefined`, renders as an empty input, and is then written back as empty by
 * `updateProject` — destroying the stored value. The projection silently
 * drifted behind migrations 009, 011, 012 and 013 and did exactly that.
 *
 * `Record<keyof Project, true>` is exhaustive: adding a field to the `Project`
 * interface breaks this file's compilation until the field is listed here, and
 * the assertion then fails until it is also added to the projection.
 */
const EVERY_PROJECT_FIELD: Record<keyof Project, true> = {
  id: true,
  title: true,
  slug: true,
  description: true,
  status: true,
  image_id: true,
  image_after_id: true,
  created_at: true,
  updated_at: true,
  github_url: true,
  live_url: true,
  post_url: true,
  progress_percent: true,
  thumb_kind: true,
  post_id: true,
  sort_order: true,
  subtitle: true,
  tags: true,
};

describe('PROJECT_DETAIL_COLUMNS', () => {
  const selected = PROJECT_DETAIL_COLUMNS.split(',').map((c) => c.trim());

  it('selects every field on the Project interface', () => {
    const missing = Object.keys(EVERY_PROJECT_FIELD).filter((f) => !selected.includes(f));
    expect(missing).toEqual([]);
  });

  it('selects nothing that is not a Project field', () => {
    const extra = selected.filter((c) => !(c in EVERY_PROJECT_FIELD));
    expect(extra).toEqual([]);
  });

  it('names each column exactly once', () => {
    expect(new Set(selected).size).toBe(selected.length);
  });
});
