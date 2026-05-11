/**
 * Domain types for swarnimbagre.com.
 *
 * Hand-derived from `docs/architecture.md` §2 (data model). These mirror the
 * Postgres table shapes (snake_case columns) so query results can be assigned
 * directly without renaming. Keep in sync with migrations.
 */

/** Lifecycle state of a project row. Mirrors the `project_status` enum. */
export type ProjectStatus = 'draft' | 'published';

/** Lifecycle state of a post row. Mirrors the `post_status` enum. */
export type PostStatus = 'draft' | 'published';

/** A portfolio project. One row in `public.projects`. */
export interface Project {
  id: string;
  title: string;
  slug: string;
  description: string;
  status: ProjectStatus;
  image_id: string | null;
  created_at: string;
  updated_at: string;
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
