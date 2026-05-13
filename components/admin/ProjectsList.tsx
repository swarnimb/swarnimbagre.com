'use client';

import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ProjectRow, ProjectFilter } from '@/lib/admin-queries';

/** Empty-state copy. CONSTRAINT-13: terse, no decoration, no SaaS phrasing. */
const EMPTY_STATE = 'No projects yet';

/** Format an ISO timestamp into a compact YYYY-MM-DD string for the Created column. */
function formatCreated(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * Status cell. `published` → `default` (accent), `draft` → `secondary` (muted).
 */
function StatusBadge({ status }: { status: ProjectRow['status'] }): React.ReactElement {
  if (status === 'published') {
    return <Badge variant="default">published</Badge>;
  }
  return <Badge variant="secondary">draft</Badge>;
}

/** Props for {@link ProjectsList}. Page route owns search-param parsing and fetching. */
export interface ProjectsListProps {
  rows: ProjectRow[];
  total: number;
  filter: ProjectFilter;
  page: number;
  pageSize: number;
}

/**
 * Admin projects list view. shadcn Table + Select filter + shadcn Pagination.
 * Filter/page changes push to URL search params; the server page at
 * `app/(admin)/admin/projects/page.tsx` reads them and refetches via
 * {@link import('@/lib/admin-queries').getAllProjects}. Sort is fixed to
 * `created_at DESC` server-side. Edit links to `/admin/projects/[id]` (T21);
 * Delete is `disabled` with a title hint (T22).
 */
export default function ProjectsList({
  rows,
  total,
  filter,
  page,
  pageSize,
}: ProjectsListProps): React.ReactElement {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function buildHref(next: { filter: ProjectFilter; page: number }): string {
    const params = new URLSearchParams(searchParams.toString());
    params.set('filter', next.filter);
    params.set('page', String(next.page));
    return `${pathname}?${params.toString()}`;
  }

  function pushParams(next: { filter: ProjectFilter; page: number }): void {
    router.push(buildHref(next));
  }

  function onFilterChange(value: string): void {
    // The Select only emits values from its declared items, but coerce defensively.
    const nextFilter: ProjectFilter =
      value === 'published' || value === 'draft' ? value : 'all';
    pushParams({ filter: nextFilter, page: 1 });
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <section className="px-6 py-10 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Projects</h1>
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
      </header>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{EMPTY_STATE}</p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
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
                        <Link href={`/admin/projects/${row.id}`}>Edit</Link>
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled
                        title="Wired in T22"
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

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
