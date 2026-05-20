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
  image_id: string | null;
  created_at: string;
  updated_at: string;
  github_url: string | null;
  live_url: string | null;
  post_url: string | null;
  progress_percent: number | null;
  thumb_kind: ThumbKind | null;
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
