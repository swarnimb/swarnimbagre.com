export type NavTarget = 'home' | 'projects' | 'writing' | 'other';

export const NAV_PATHS: Record<NavTarget, string> = {
  home: '/',
  projects: '/projects',
  writing: '/writing',
  other: '/other',
};

/**
 * Resolve a nav-target key to its public site path.
 *
 * @param target A nav-target key (`'home' | 'projects' | 'writing' | 'other'`).
 * @returns The mapped path from {@link NAV_PATHS}, or `'/'` for any value that
 *          is not a known {@link NavTarget} (fallback for unknown targets).
 */
export function resolveNavPath(target: string): string {
  return NAV_PATHS[target as NavTarget] ?? '/';
}
