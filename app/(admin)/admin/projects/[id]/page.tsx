import { notFound } from 'next/navigation';
import AdminNav from '@/components/admin/AdminNav';
import ProjectForm from '@/components/admin/ProjectForm';
import DeleteProjectButton from '@/components/admin/DeleteProjectButton';
import { getProjectById } from '@/lib/admin-queries';
import { loadAdminProjectMedia } from '@/lib/admin-project-media-preview';

/**
 * Admin "edit project" page (`/admin/projects/[id]`).
 *
 * Server component. Awaits the dynamic `params`, fetches the row via
 * {@link getProjectById}, loads pre-resolved media rows via
 * {@link loadAdminProjectMedia} (T43.F), and renders {@link ProjectForm}
 * prefilled with both. A missing project row dispatches Next 15's
 * `notFound()` — `getProjectById` returns `null` for the PGRST116
 * ("no rows") case, distinct from a true DB error (which still throws and
 * surfaces in the Next error overlay, matching the admin-side intentional
 * loudness documented on the list page).
 *
 * The destructive action lives in a separate {@link DeleteProjectButton}
 * client component below the form: it owns the confirm modal's open-state
 * and calls the `deleteProject` Server Action (T22).
 *
 * Auth is enforced by `middleware.ts` for `/admin/:path*`. CONSTRAINT-14's
 * `safeLoad` discipline is for public pages; the admin operator wants loud
 * failures — `loadAdminProjectMedia` propagates DB / signing errors.
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
  const initialMedia = await loadAdminProjectMedia(project.id);
  return (
    <>
      <AdminNav />
      <ProjectForm project={project} initialMedia={initialMedia} />
      <section className="px-6 pb-10">
        <DeleteProjectButton id={project.id} name={project.title} afterDelete="redirect" />
      </section>
    </>
  );
}
