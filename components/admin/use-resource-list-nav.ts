'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import type { ResourceFilter } from '@/components/admin/ResourceList';

/** A `{ filter, page }` target the list navigates to via URL search params. */
export interface ResourceListNavTarget<TFilter extends ResourceFilter> {
  filter: TFilter;
  page: number;
}

/** Functions returned by {@link useResourceListNav}. */
export interface ResourceListNav<TFilter extends ResourceFilter> {
  /** Build the absolute href (current path + merged search params) for a target. */
  buildHref: (next: ResourceListNavTarget<TFilter>) => string;
  /** Push a target onto the router (preserves unrelated search params). */
  pushParams: (next: ResourceListNavTarget<TFilter>) => void;
  /** Select `onValueChange` handler — coerces to a valid filter, resets to page 1. */
  onFilterChange: (value: string) => void;
}

/**
 * URL/search-param navigation for the generic admin list. Extracted from
 * `ResourceList` (CQ-02 file-length + CQ-03 single responsibility) so the
 * component file holds only render concerns. Behavior is byte-identical to
 * the previously inline closures.
 *
 * @template TFilter The concrete filter literal (extends {@link ResourceFilter}).
 * @returns A {@link ResourceListNav}: `buildHref`, `pushParams`, and
 *          `onFilterChange`, all bound to the current path and search params.
 */
export function useResourceListNav<
  TFilter extends ResourceFilter,
>(): ResourceListNav<TFilter> {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function buildHref(next: ResourceListNavTarget<TFilter>): string {
    const params = new URLSearchParams(searchParams.toString());
    params.set('filter', next.filter);
    params.set('page', String(next.page));
    return `${pathname}?${params.toString()}`;
  }

  function pushParams(next: ResourceListNavTarget<TFilter>): void {
    router.push(buildHref(next));
  }

  function onFilterChange(value: string): void {
    // The Select only emits values from its declared items, but coerce defensively.
    const nextFilter = (
      value === 'published' || value === 'draft' ? value : 'all'
    ) as TFilter;
    pushParams({ filter: nextFilter, page: 1 });
  }

  return { buildHref, pushParams, onFilterChange };
}
