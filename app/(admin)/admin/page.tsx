import { redirect } from 'next/navigation';

/**
 * Admin index route. Redirects to `/admin/projects` — there is no standalone
 * admin landing surface; projects is the default working list.
 * Auth is enforced at the middleware layer — this never runs for an
 * unauthenticated request.
 */
export default function AdminHome(): never {
  redirect('/admin/projects');
}
