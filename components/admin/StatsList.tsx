'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import DeleteStatButton from '@/components/admin/DeleteStatButton';
import type { Stat } from '@/lib/types';

/** Empty-state copy. CONSTRAINT-13: terse, no decoration, no SaaS phrasing. */
const EMPTY_STATE = 'No stats yet';

/** Format an ISO timestamp into a compact YYYY-MM-DD string for the Created column. */
function formatCreated(iso: string): string {
  return iso.slice(0, 10);
}

/** Props for {@link StatsList}. Page route owns search-param parsing and fetching. */
export interface StatsListProps {
  rows: Stat[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Admin stats list view. shadcn Table + shadcn Pagination. Page changes push
 * to URL search params; the server page at `app/(admin)/admin/stats/page.tsx`
 * reads them and refetches via
 * {@link import('@/lib/admin-queries').getAllStats}. Sort is fixed to
 * `created_at DESC` server-side.
 *
 * Stats has no edit (CONSTRAINT-10: delete-then-reinsert for corrections)
 * and no status enum, so the list is simpler than `PostsList` — no filter
 * dropdown, no Edit button per row, just a Delete button.
 *
 * Mirrors `PostsList` structurally; the column set, the absence of filter
 * UI, and the absence of an Edit action are the deliberate differences.
 */
export default function StatsList({
  rows,
  total,
  page,
  pageSize,
}: StatsListProps): React.ReactElement {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function buildHref(nextPage: number): string {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(nextPage));
    return `${pathname}?${params.toString()}`;
  }

  function pushPage(nextPage: number): void {
    router.push(buildHref(nextPage));
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <section className="px-6 py-10 space-y-6">
      <header className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">All stats</h2>
      </header>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{EMPTY_STATE}</p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.category}</TableCell>
                  <TableCell>{row.label}</TableCell>
                  <TableCell>{row.value}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.unit ?? ''}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatCreated(row.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <DeleteStatButton id={row.id} name={row.label} size="sm" />
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
                    href={canPrev ? buildHref(page - 1) : '#'}
                    aria-disabled={!canPrev}
                    tabIndex={canPrev ? undefined : -1}
                    className={canPrev ? undefined : 'pointer-events-none opacity-50'}
                    onClick={(e) => {
                      // preventDefault so router.push preserves any other search
                      // params; href stays valid for SSR / right-click / open-in-new-tab.
                      e.preventDefault();
                      if (canPrev) pushPage(page - 1);
                    }}
                  />
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    href={canNext ? buildHref(page + 1) : '#'}
                    aria-disabled={!canNext}
                    tabIndex={canNext ? undefined : -1}
                    className={canNext ? undefined : 'pointer-events-none opacity-50'}
                    onClick={(e) => {
                      e.preventDefault();
                      if (canNext) pushPage(page + 1);
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
