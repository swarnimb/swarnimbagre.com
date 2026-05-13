import AdminNav from '@/components/admin/AdminNav';
import ProjectsList from '@/components/admin/ProjectsList';
import { getAllProjects, type ProjectFilter } from '@/lib/admin-queries';

/** Rows per page for the admin projects list. Matches T20 acceptance criteria. */
const PAGE_SIZE = 50;

/** Hard cap on the `page` search-param to guard against abusive `OFFSET` values. */
const MAX_PAGE = 10_000;

/**
 * Coerce a raw `filter` search-param value to a {@link ProjectFilter}. Any
 * unexpected value (missing, array, unknown literal) falls back to `'all'`.
 */
function coerceFilter(raw: string | string[] | undefined): ProjectFilter {
  if (raw === 'published' || raw === 'draft' || raw === 'all') return raw;
  return 'all';
}

/**
 * Coerce a raw `page` search-param value to a positive integer in
 * `[1, MAX_PAGE]`. Anything outside that range falls back to `1`.
 */
function coercePage(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = parseInt(value ?? '', 10);
  if (Number.isNaN(parsed) || parsed <= 0 || parsed > MAX_PAGE) return 1;
  return parsed;
}

/**
 * Admin projects list page (`/admin/projects`).
 *
 * Server component. Reads `filter` and `page` from `searchParams`, calls
 * {@link getAllProjects}, and renders {@link ProjectsList}. Errors from the
 * data layer are intentionally NOT wrapped in `safeLoad` — CONSTRAINT-14
 * governs public pages; the admin operator should see Next 15's error
 * overlay so failures are loud and obvious.
 *
 * Auth is enforced by `middleware.ts` for `/admin/:path*`; this page never
 * renders for an unauthenticated request.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.ReactElement> {
  const params = await searchParams;
  const filter = coerceFilter(params.filter);
  const page = coercePage(params.page);
  const { rows, total } = await getAllProjects(filter, page, PAGE_SIZE);
  return (
    <>
      <AdminNav />
      <ProjectsList
        rows={rows}
        total={total}
        filter={filter}
        page={page}
        pageSize={PAGE_SIZE}
      />
    </>
  );
}
