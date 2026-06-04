'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
// prettier-ignore
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
// prettier-ignore
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ResourceListReorder from '@/components/admin/ResourceListReorder';
// StatusBadge + formatCreated are defined here and re-used by ResourceListReorder (CQ-07).
import { useResourceListNav } from '@/components/admin/use-resource-list-nav';
import type { ReorderMutationState } from '@/lib/admin-reorder-mutations-types';

/** Filter literals accepted by every admin list. `ProjectFilter` and
 * `PostFilter` are structurally identical to this and satisfy it directly. */
export type ResourceFilter = 'all' | 'published' | 'draft';

/** Minimum row shape the generic list renders. `ProjectRow` / `PostRow`
 * (from `@/lib/admin-queries`) are supersets and satisfy it without an adapter. */
export interface ResourceListRow {
  id: string;
  title: string;
  slug: string;
  status: 'published' | 'draft';
  created_at: string;
}

/** Format an ISO timestamp into a compact YYYY-MM-DD string for the Created column. */
export function formatCreated(iso: string): string {
  return iso.slice(0, 10);
}

/** Status cell. `published` → `default` (accent), `draft` → `secondary` (muted). */
export function StatusBadge({
  status,
}: { status: ResourceListRow['status'] }): React.ReactElement {
  if (status === 'published') {
    return <Badge variant="default">published</Badge>;
  }
  return <Badge variant="secondary">draft</Badge>;
}

/**
 * Props for {@link ResourceList}. The page route owns search-param parsing
 * and fetching; this component only renders and pushes URL changes.
 *
 * @template TRow    Concrete row type (e.g. `ProjectRow`), extends {@link ResourceListRow}.
 * @template TFilter Concrete filter literal, extends {@link ResourceFilter}.
 */
export interface ResourceListProps<
  TRow extends ResourceListRow,
  TFilter extends ResourceFilter,
> {
  /** Rows for the current page, pre-fetched and pre-sorted server-side. */
  rows: TRow[];
  /** Total row count across all pages (for the pagination label). */
  total: number;
  /** Active status filter, mirrored from the URL search params. */
  filter: TFilter;
  /** 1-indexed current page number. */
  page: number;
  /** Rows per page — used to compute total page count. */
  pageSize: number;
  /** `h1` heading text, e.g. `'Projects'` or `'Posts'`. */
  heading: string;
  /** Copy shown when `rows` is empty, e.g. `'No projects yet'`. */
  emptyState: string;
  /** Path segment after `/admin/` for the Edit link, e.g. `'projects'`
   * → `/admin/projects/[id]`. No leading or trailing slash. Also drives
   * the create-route href (`/admin/${editSegment}/new`). */
  editSegment: string;
  /** Label for the create-resource button, e.g. `'New project'`. */
  newLabel: string;
  /** Render prop for the per-row delete control. Given the row's id and
   * title, returns the resource-specific delete button. */
  renderDeleteButton: (row: { id: string; title: string }) => React.ReactNode;
  /** Reorder Server Action — `saveProjectOrder` or `savePostOrder`. Threaded
   * to {@link ResourceListReorder}, which owns the drag-reorder table body. */
  saveOrderAction: (
    prev: ReorderMutationState,
    formData: FormData,
  ) => Promise<ReorderMutationState>;
}

/**
 * Generic admin list view (shadcn Table + Select filter + Pagination).
 * Filter/page changes push to URL search params; the server page refetches
 * (sort fixed `created_at DESC`). Extracted (CQ-07) from the copy-pasted
 * `ProjectsList` / `PostsList`; rendered DOM, classes, and behavior identical.
 *
 * @param props See {@link ResourceListProps}.
 * @returns React element rendering the admin list screen.
 */
export default function ResourceList<
  TRow extends ResourceListRow,
  TFilter extends ResourceFilter,
>({
  rows,
  total,
  filter,
  page,
  pageSize,
  heading,
  emptyState,
  editSegment,
  newLabel,
  renderDeleteButton,
  saveOrderAction,
}: ResourceListProps<TRow, TFilter>): React.ReactElement {
  const { buildHref, pushParams, onFilterChange } =
    useResourceListNav<TFilter>();

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <section className="px-6 py-10 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">{heading}</h1>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={onFilterChange}>
            <SelectTrigger className="w-40" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
            </SelectContent>
          </Select>
          <Button asChild size="sm">
            <Link href={`/admin/${editSegment}/new`}>{newLabel}</Link>
          </Button>
        </div>
      </header>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyState}</p>
      ) : (
        <>
          <ResourceListReorder
            key={`${filter}-${page}`}
            rows={rows}
            editSegment={editSegment}
            renderDeleteButton={renderDeleteButton}
            saveOrderAction={saveOrderAction}
          />

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages} — {total} total
            </p>
            <Pagination className="mx-0 w-auto justify-end">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href={canPrev ? buildHref({ filter, page: page - 1 }) : '#'}
                    aria-disabled={!canPrev}
                    tabIndex={canPrev ? undefined : -1}
                    className={canPrev ? undefined : 'pointer-events-none opacity-50'}
                    onClick={(e) => {
                      // preventDefault so router.push preserves the filter param;
                      // href stays valid for SSR / right-click / open-in-new-tab.
                      e.preventDefault();
                      if (canPrev) pushParams({ filter, page: page - 1 });
                    }}
                  />
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    href={canNext ? buildHref({ filter, page: page + 1 }) : '#'}
                    aria-disabled={!canNext}
                    tabIndex={canNext ? undefined : -1}
                    className={canNext ? undefined : 'pointer-events-none opacity-50'}
                    onClick={(e) => {
                      e.preventDefault();
                      if (canNext) pushParams({ filter, page: page + 1 });
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </>
      )}
    </section>
  );
}
