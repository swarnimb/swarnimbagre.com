'use client';

import ResourceList from '@/components/admin/ResourceList';
import DeleteProjectButton from '@/components/admin/DeleteProjectButton';
import { saveProjectOrder } from '@/lib/admin-reorder-mutations';
import type { ProjectRow, ProjectFilter } from '@/lib/admin-queries';

/** Empty-state copy. CONSTRAINT-13: terse, no decoration, no SaaS phrasing. */
const EMPTY_STATE = 'No projects yet';

/** Props for {@link ProjectsList}. Page route owns search-param parsing and fetching. */
export interface ProjectsListProps {
  rows: ProjectRow[];
  total: number;
  filter: ProjectFilter;
  page: number;
  pageSize: number;
}

/**
 * Admin projects list view. Thin wrapper over the generic
 * {@link ResourceList}: supplies the projects-specific heading, empty-state
 * copy, edit-href segment, and {@link DeleteProjectButton} per-row control.
 * Rendered DOM, classes, and behavior are identical to the pre-CQ-07
 * copy-pasted component — see `ResourceList` for the shared markup.
 *
 * Filter/page changes push to URL search params; the server page at
 * `app/(admin)/admin/projects/page.tsx` reads them and refetches via
 * {@link import('@/lib/admin-queries').getAllProjects}. Sort is fixed to
 * `created_at DESC` server-side. Edit links to `/admin/projects/[id]` (T21);
 * Delete uses the {@link DeleteProjectButton} per-row pair (T22) — opens the
 * shared {@link import('@/components/admin/DeleteConfirmModal').default}
 * modal and calls the `deleteProject` Server Action; on success the row
 * disappears via `router.refresh()` (no navigation).
 *
 * @param props See {@link ProjectsListProps}.
 * @returns React element rendering the admin projects screen.
 */
export default function ProjectsList({
  rows,
  total,
  filter,
  page,
  pageSize,
}: ProjectsListProps): React.ReactElement {
  return (
    <ResourceList<ProjectRow, ProjectFilter>
      rows={rows}
      total={total}
      filter={filter}
      page={page}
      pageSize={pageSize}
      heading="Projects"
      emptyState={EMPTY_STATE}
      editSegment="projects"
      newLabel="New project"
      saveOrderAction={saveProjectOrder}
      renderDeleteButton={(row) => (
        <DeleteProjectButton
          id={row.id}
          name={row.title}
          afterDelete="refresh"
          size="sm"
        />
      )}
    />
  );
}
