'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import StatRow from '@/components/admin/StatRow';
import type { Stat } from '@/lib/types';

/** Empty-state copy. CONSTRAINT-13: terse, no decoration, no SaaS phrasing. */
const EMPTY_STATE = 'No stats yet';

/** Props for {@link StatsList}. Page route owns search-param parsing and fetching. */
export interface StatsListProps {
  rows: Stat[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Admin stats list view. A stack of editable {@link StatRow} cards plus the
 * shadcn Pagination footer. Page changes push to URL search params; the
 * server page at `app/(admin)/admin/stats/page.tsx` reads them and refetches
 * via {@link import('@/lib/admin-queries').getAllStats}. Sort is fixed
 * server-side to `sort_order ASC, created_at DESC`, so the list reads in the
 * order the public Other page renders and doubles as a preview of the running
 * order.
 *
 * This was a shadcn Table until stats gained an edit path. Stats are now
 * corrected in place rather than deleted and retyped, and a `form` cannot
 * legally be a child of a `tr`, so table markup and inline editing are
 * mutually exclusive. {@link import('./NotesList').default} made the same
 * trade for the same reason; the two admin surfaces are deliberately the same
 * shape.
 *
 * Delete semantics are untouched: still hard-delete only behind a confirm
 * modal (CONSTRAINT-10). The edit path is an addition, not a replacement.
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
        <p className="text-sm text-muted-foreground">
          {total} total, in display order
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{EMPTY_STATE}</p>
      ) : (
        <>
          <ul className="space-y-4">
            {rows.map((row) => (
              <StatRow key={row.id} stat={row} />
            ))}
          </ul>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
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
