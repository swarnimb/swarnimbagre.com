'use client';

import ResourceList from '@/components/admin/ResourceList';
import DeletePostButton from '@/components/admin/DeletePostButton';
import type { PostRow, PostFilter } from '@/lib/admin-queries';

/** Empty-state copy. CONSTRAINT-13: terse, no decoration, no SaaS phrasing. */
const EMPTY_STATE = 'No posts yet';

/** Props for {@link PostsList}. Page route owns search-param parsing and fetching. */
export interface PostsListProps {
  rows: PostRow[];
  total: number;
  filter: PostFilter;
  page: number;
  pageSize: number;
}

/**
 * Admin posts list view. Thin wrapper over the generic {@link ResourceList}:
 * supplies the posts-specific heading, empty-state copy, edit-href segment,
 * and {@link DeletePostButton} per-row control. Rendered DOM, classes, and
 * behavior are identical to the pre-CQ-07 copy-pasted component — see
 * `ResourceList` for the shared markup.
 *
 * Filter/page changes push to URL search params; the server page at
 * `app/(admin)/admin/posts/page.tsx` reads them and refetches via
 * {@link import('@/lib/admin-queries').getAllPosts}. Sort is fixed to
 * `created_at DESC` server-side. Edit links to `/admin/posts/[id]`; Delete
 * uses the {@link DeletePostButton} per-row pair — opens the shared
 * {@link import('@/components/admin/DeleteConfirmModal').default} modal and
 * calls the `deletePost` Server Action; on success the row disappears via
 * `router.refresh()` (no navigation).
 *
 * @param props See {@link PostsListProps}.
 * @returns React element rendering the admin posts screen.
 */
export default function PostsList({
  rows,
  total,
  filter,
  page,
  pageSize,
}: PostsListProps): React.ReactElement {
  return (
    <ResourceList<PostRow, PostFilter>
      rows={rows}
      total={total}
      filter={filter}
      page={page}
      pageSize={pageSize}
      heading="Posts"
      emptyState={EMPTY_STATE}
      editSegment="posts"
      renderDeleteButton={(row) => (
        <DeletePostButton
          id={row.id}
          name={row.title}
          afterDelete="refresh"
          size="sm"
        />
      )}
    />
  );
}
