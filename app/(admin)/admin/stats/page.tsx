import AdminNav from '@/components/admin/AdminNav';
import StatsInsertForm from '@/components/admin/StatsInsertForm';
import StatsList from '@/components/admin/StatsList';
import { getAllStats } from '@/lib/admin-queries';

/** Rows per page for the admin stats list. Matches the posts/projects list page size. */
const PAGE_SIZE = 50;

/** Hard cap on the `page` search-param to guard against abusive `OFFSET` values. */
const MAX_PAGE = 10_000;

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
 * Admin stats list page (`/admin/stats`).
 *
 * Server component. Reads `page` from `searchParams`, calls
 * {@link getAllStats}, and renders the {@link StatsInsertForm} above the
 * {@link StatsList}. Unlike the posts and projects admin sections, the
 * insert form lives on the list page itself (no `/admin/stats/new` route)
 * — stats has no edit step (CONSTRAINT-10) so the create/list split would
 * not pay for itself.
 *
 * No filter coercion — stats has no `status` column. Errors from the data
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
  const page = coercePage(params.page);
  const { rows, total } = await getAllStats(page, PAGE_SIZE);
  return (
    <>
      <AdminNav />
      <StatsInsertForm />
      <StatsList rows={rows} total={total} page={page} pageSize={PAGE_SIZE} />
    </>
  );
}
