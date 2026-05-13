import AdminNav from '@/components/admin/AdminNav';
import PostsList from '@/components/admin/PostsList';
import { getAllPosts, type PostFilter } from '@/lib/admin-queries';

/** Rows per page for the admin posts list. Matches the projects list page size. */
const PAGE_SIZE = 50;

/** Hard cap on the `page` search-param to guard against abusive `OFFSET` values. */
const MAX_PAGE = 10_000;

/**
 * Coerce a raw `filter` search-param value to a {@link PostFilter}. Any
 * unexpected value (missing, array, unknown literal) falls back to `'all'`.
 */
function coerceFilter(raw: string | string[] | undefined): PostFilter {
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
 * Admin posts list page (`/admin/posts`).
 *
 * Server component. Reads `filter` and `page` from `searchParams`, calls
 * {@link getAllPosts}, and renders {@link PostsList}. Errors from the data
 * layer are intentionally NOT wrapped in `safeLoad` — CONSTRAINT-14 governs
 * public pages; the admin operator should see Next 15's error overlay so
 * failures are loud and obvious.
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
  const { rows, total } = await getAllPosts(filter, page, PAGE_SIZE);
  return (
    <>
      <AdminNav />
      <PostsList
        rows={rows}
        total={total}
        filter={filter}
        page={page}
        pageSize={PAGE_SIZE}
      />
    </>
  );
}
