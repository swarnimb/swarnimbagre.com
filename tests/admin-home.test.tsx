import { describe, it, expect, vi, afterEach } from 'vitest';

/**
 * TS-01 — `AdminHome` redirect contract (T39 rewrite).
 *
 * The original `/admin` page rendered a dry "Admin" heading + 4-link nav.
 * T39 (commit 5b88f24) demoted the route to a pure redirect because the
 * standalone landing screen had no purpose — the four sections (projects,
 * posts, stats, images) are the working surface, and `/admin/projects`
 * is the natural default. The nav itself moved to the admin layout file,
 * which is covered by the route-level tests for each section.
 *
 * This suite verifies the only behavior the page now carries: it calls
 * `redirect('/admin/projects')` exactly once when invoked. Anything else
 * is a regression.
 *
 * `redirect` from `next/navigation` throws a `NEXT_REDIRECT` sentinel at
 * runtime to short-circuit the render; in tests we mock the module so the
 * call is observable as a spy invocation without the throw escaping into
 * the test harness.
 */
const redirectMock = vi.fn();
vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}));

const AdminHome = (await import('@/app/(admin)/admin/page')).default;

afterEach(() => {
  redirectMock.mockClear();
});

describe('AdminHome — TS-01 redirects to /admin/projects', () => {
  it('invokes redirect exactly once', () => {
    AdminHome();

    expect(redirectMock).toHaveBeenCalledTimes(1);
  });

  it('redirects to the /admin/projects working surface', () => {
    AdminHome();

    expect(redirectMock).toHaveBeenCalledWith('/admin/projects');
  });
});
