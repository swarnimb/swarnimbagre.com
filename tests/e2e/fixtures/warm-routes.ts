/**
 * T47 — pre-compile the routes the suite hits first.
 *
 * `playwright.config.ts` runs `fullyParallel: true` against a single
 * `next dev` server. Next dev compiles a route the first time it is requested,
 * so whichever spec asks for `/admin` first pays the whole cold-compile bill
 * while seven other spec files compete for the same CPU. On a loaded machine
 * that first navigation blows the 20s step budget in `admin-smoke.spec.ts`
 * ("auth gate: signed-out /admin to /admin/login"), and `admin-tailwind-scope`
 * follows it down. `--workers=1` is green, which confirms contention rather
 * than a product defect.
 *
 * The fix is to pay the compile cost once, here, before any test's clock is
 * running. Playwright's `webServer` is registered as a plugin and plugin setup
 * tasks are ordered ahead of `globalSetup` in the runner's task list
 * (`runner/tasks.js` -> `createGlobalSetupTasks`), and the plugin's `setup()`
 * polls `webServer.url` until it answers. So by the time this module runs the
 * dev server is already listening.
 *
 * Plain HTTP GETs, no browser: compilation is triggered by the request, not by
 * rendering the result.
 */

/**
 * Per-route ceiling for a warm-up request.
 *
 * A cold admin route can take well over the suite's 20s step budget when ten
 * compiles run at once, which is the entire reason this file exists. Kept
 * below `webServer.timeout` (120s) so a genuinely wedged server still surfaces
 * as a server-start failure rather than as a warm-up hang.
 */
const WARM_UP_TIMEOUT_MS = 90_000;

/**
 * Routes a spec file reaches before the server has had any chance to warm
 * itself. Each entry is the first navigation of at least one spec, or sits on
 * the critical path of a bounded step:
 *
 *   `/`, `/projects`, `/writing`, `/other` — `pages.spec.ts`, `smoke.spec.ts`,
 *       `writing-detail.spec.ts`, `admin-tailwind-scope.spec.ts`, and the
 *       public style baseline captured at the top of `admin-smoke.spec.ts`.
 *   `/writing/<bogus slug>` — compiles the `[slug]` segment and the not-found
 *       path without needing a real post to exist.
 *   `/admin`, `/admin/login` — the auth-gate step that actually fails today.
 *   `/admin/projects` — where `/admin` lands once signed in, asserted under the
 *       same 20s budget one step later.
 *   `/admin/auth/callback` — the only navigation in
 *       `admin-auth-callback.spec.ts`. A bare GET has no token and no code, so
 *       it takes the logged-failure branch and redirects to the login page; it
 *       touches no session.
 *   `/api/test/sign-in` — POST-only, so a GET returns 405. The route module is
 *       still loaded to work that out, which is all the warm-up needs. It is on
 *       the critical path of every signed-in spec.
 *
 * Deeper admin routes (`/admin/projects/new`, `/admin/images`, ...) are left
 * out deliberately: they are reached far enough into a run that the server is
 * no longer cold, and warming them would trade real setup time for nothing.
 */
const WARM_ROUTES = [
  '/',
  '/projects',
  '/writing',
  '/other',
  '/writing/warm-up-slug-that-does-not-exist',
  '/admin',
  '/admin/login',
  '/admin/projects',
  '/admin/auth/callback',
  '/api/test/sign-in',
] as const;

/**
 * Request one route and report whether the server answered at all.
 *
 * Status is deliberately ignored. A 404, a 405, or a redirect all prove the
 * route compiled, which is the only thing being bought here. Redirects are
 * followed, so warming `/admin` while signed out also warms `/admin/login`.
 *
 * @param baseURL Absolute origin the suite points at.
 * @param route   Path to request.
 * @returns True if any HTTP response came back.
 */
async function warmRoute(baseURL: string, route: string): Promise<boolean> {
  const url = new URL(route, baseURL).toString();
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(WARM_UP_TIMEOUT_MS) });
    // Drain the body so a streamed server render finishes instead of being
    // cancelled part-way through. A failure draining is irrelevant — the
    // response headers already proved the route compiled.
    await response.arrayBuffer().catch(() => undefined);
    return true;
  } catch {
    return false;
  }
}

/**
 * Warm every route in `WARM_ROUTES` concurrently.
 *
 * Individual failures are tolerated and reported in the log line: one route
 * failing to answer is not worth aborting a suite over, and the tests that
 * touch it will fail on their own terms with a far more useful message. Every
 * route failing means the dev server is unreachable, which is not something
 * the suite can recover from, so that case throws.
 *
 * @param baseURL Absolute origin the suite points at.
 */
export async function warmRoutes(baseURL: string): Promise<void> {
  const startedAt = Date.now();
  const results = await Promise.all(WARM_ROUTES.map((route) => warmRoute(baseURL, route)));
  const elapsedMs = Date.now() - startedAt;
  const warmed = results.filter(Boolean).length;
  if (warmed === 0) {
    throw new Error(
      `[e2e setup] route warm-up reached none of ${WARM_ROUTES.length} routes at ${baseURL} ` +
        `within ${WARM_UP_TIMEOUT_MS}ms. The dev server is not answering.`,
    );
  }
  console.log(
    `[e2e setup] warmed ${warmed}/${WARM_ROUTES.length} routes in ${elapsedMs}ms.`,
  );
}
