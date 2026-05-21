/**
 * Domain types for swarnimbagre.com.
 *
 * Hand-derived from `docs/architecture.md` §2 (data model). These mirror the
 * Postgres table shapes (snake_case columns) so query results can be assigned
 * directly without renaming. Keep in sync with migrations.
 */

import type { ThumbKind } from './thumb-kinds';

/** Lifecycle state of a project row. Mirrors the `project_status` enum. */
export type ProjectStatus = 'draft' | 'published';

/** Lifecycle state of a post row. Mirrors the `post_status` enum. */
export type PostStatus = 'draft' | 'published';

/**
 * A portfolio project. One row in `public.projects`.
 *
 * Content-model fields below `updated_at` were added in migration 009
 * (T42, CONSTRAINT-05 Override 1). All six are nullable.
 *
 * `thumb_kind` is typed as `ThumbKind | null` to match the rest of the
 * codebase's narrowed-at-boundary convention. The DB column itself is
 * untyped `text` (see `lib/thumb-kinds.ts` for the rationale); if a
 * row holds a value outside `ThumbKind`, the public render layer falls
 * back to the `dots` motif and the type lies harmlessly.
 */
export interface Project {
  id: string;
  title: string;
  slug: string;
  description: string;
  status: ProjectStatus;
  /**
   * @deprecated since T43 (migration 010, 2026-05-20) — superseded by rows in
   * `public.project_media` linked by `project_id`. Retained for backward
   * compatibility with rows authored before T43 (the public render falls back
   * to `image_id` / `image_after_id` when a project has zero `project_media`
   * rows). The deprecation window stays open-ended pending a backfill audit;
   * CONSTRAINT-22 will formalize the schedule at T43.I.
   */
  image_id: string | null;
  created_at: string;
  updated_at: string;
  github_url: string | null;
  live_url: string | null;
  post_url: string | null;
  progress_percent: number | null;
  thumb_kind: ThumbKind | null;
  /**
   * @deprecated since T43 (migration 010, 2026-05-20) — superseded by the
   * `image_after_id` column on `project_media` rows. Same rationale and
   * deprecation window as the legacy `image_id` field above.
   */
  image_after_id: string | null;
}

/** A written post. One row in `public.posts`. */
export interface Post {
  id: string;
  title: string;
  slug: string;
  content: string;
  status: PostStatus;
  image_id: string | null;
  created_at: string;
  updated_at: string;
}

/** A single stat value rendered on the hobby-stats surface. */
export interface Stat {
  id: string;
  category: string;
  label: string;
  value: string;
  unit: string | null;
  created_at: string;
}

/**
 * An image record. Points at an object in Supabase Storage via `bucket_path`
 * and optionally attaches to a parent row (project or post).
 */
export interface ImageRecord {
  id: string;
  bucket_path: string;
  alt_text: string;
  parent_id: string | null;
  parent_type: 'projects' | 'posts' | null;
  created_at: string;
}

/**
 * A media row attached to a project. One row in `public.project_media`
 * (migration 010, T43 Override 2). Each row is one carousel slide. Up to
 * 20 rows per project — enforced by trigger `project_media_enforce_row_cap`.
 *
 * The pair shape (`image_id` + `image_after_id`) holds an optional
 * before/after slide; when `image_after_id` is null the row is a
 * single-image slide. `caption` is plain text only (no markdown — T43
 * Override 2 spec). `order_index` is the carousel order, ASC.
 *
 * Snake-case mirror of the DB row, per the file-level convention.
 */
export interface ProjectMedia {
  id: string;
  project_id: string;
  image_id: string;
  image_after_id: string | null;
  caption: string | null;
  order_index: number;
  created_at: string;
}

/**
 * Render-ready carousel item built from a `ProjectMedia` row plus pre-resolved
 * signed Storage URLs. Built by `loadPublicProjectMedia` in
 * `lib/public-project-media.ts`; consumed by `ProjectMediaCarousel` and
 * `MobileProjectMediaCarousel` (T43 Override 2).
 *
 * Held in `types.ts` rather than next to its builder because it is also
 * referenced by `PublicProject.media` in `lib/public-projects.ts`; centralising
 * the type avoids a circular import.
 */
export interface PublicProjectMediaItem {
  id: string;
  imageUrl: string | null;
  imageAlt: string;
  imageAfterUrl: string | null;
  imageAfterAlt: string | null;
  caption: string | null;
  orderIndex: number;
}
