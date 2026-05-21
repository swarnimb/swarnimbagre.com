/**
 * Admin read-query barrel.
 *
 * Split under CQ-02 (services < 300 lines) into per-resource modules with a
 * single responsibility each (CQ-03). This file is a thin re-export surface
 * only — it carries no logic. Every public symbol keeps its original name so
 * existing consumers (`import { ... } from '@/lib/admin-queries'`) need no
 * change.
 *
 * Per-resource modules:
 *   - `lib/admin-queries-projects.ts`      — projects list + detail reads
 *   - `lib/admin-queries-posts.ts`         — posts list + detail reads
 *   - `lib/admin-queries-stats.ts`         — stats list reads
 *   - `lib/admin-queries-project-media.ts` — project media (carousel rows) reads (T43.D)
 *
 * The shared structured-log helper lives in `lib/admin-mutation-log.ts`
 * (`logQueryError`) — the per-module duplicate copies were removed under
 * CQ-07.
 */

export { getAllProjects, getProjectById } from './admin-queries-projects';
export type { ProjectFilter, ProjectRow } from './admin-queries-projects';

export { getAllPosts, getPostById } from './admin-queries-posts';
export type { PostFilter, PostRow } from './admin-queries-posts';

export { getAllStats } from './admin-queries-stats';

export { getProjectMediaByProjectAdmin } from './admin-queries-project-media';
