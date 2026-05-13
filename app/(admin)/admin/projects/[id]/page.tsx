import { notFound } from 'next/navigation';
import AdminNav from '@/components/admin/AdminNav';
import ProjectForm from '@/components/admin/ProjectForm';
import { getProjectById } from '@/lib/admin-queries';

/**
 * Admin "edit project" page (`/admin/projects/[id]`).
 *
 * Server component. Awaits the dynamic `params`, fetches the row via
 * {@link getProjectById}, and renders {@link ProjectForm} prefilled with it.
 * A missing row dispatches Next 15's `notFound()` — `getProjectById` returns
 * `null` for the PGRST116 ("no rows") case, distinct from a true DB error
 * (which still throws and surfaces in the Next error overlay, matching the
 * admin-side intentional loudness documented on the list page).
 *
 * Auth is enforced by `middleware.ts` for `/admin/:path*`. CONSTRAINT-14's
 * `safeLoad` discipline is for public pages; the admin operator wants loud
 * failures.
 *
 * @param params The dynamic route params, awaited per Next 15.
 * @returns React element rendering the edit-project screen.
 */
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactElement> {
  const { id } = await params;
  const project = await getProjectById(id);
  if (project === null) {
    notFound();
  }
  return (
    <>
      <AdminNav />
      <ProjectForm project={project} />
    </>
  );
}
