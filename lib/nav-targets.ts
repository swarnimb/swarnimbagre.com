export type NavTarget = 'home' | 'projects' | 'writing' | 'other';

export const NAV_PATHS: Record<NavTarget, string> = {
  home: '/',
  projects: '/projects',
  writing: '/writing',
  other: '/other',
};

export function resolveNavPath(target: string): string {
  return NAV_PATHS[target as NavTarget] ?? '/';
}
