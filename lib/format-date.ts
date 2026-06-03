/**
 * Format an ISO timestamp as the `/writing` header meta label does
 * (e.g. `FEB 2026`). Returns an empty string for an unparseable value.
 *
 * Extracted under DRY (T45 review) from `app/writing/[slug]/page.tsx` and
 * `app/projects/[slug]/page.tsx`, which each defined an identical copy.
 */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const month = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  const year = d.getUTCFullYear();
  return `${month} ${year}`;
}
