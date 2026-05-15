import { notFound } from 'next/navigation';
import AdminNav from '@/components/admin/AdminNav';
import ProjectForm from '@/components/admin/ProjectForm';
import DeleteProjectButton from '@/components/admin/DeleteProjectButton';
import { getProjectById } from '@/lib/admin-queries';
import { getImageById } from '@/lib/db';
import { getImageUrl } from '@/lib/images';

/**
 * Shape passed to {@link ProjectForm} for the existing-image preview.
 * `null` when the project has no `image_id` or the row was orphaned.
 */
type CurrentImage = { id: string; signedUrl: string; altText: string } | null;

/**
 * Resolve the project's `image_id` to a signed-URL preview payload.
 *
 * CONSTRAINT-15: reads go through `getImageUrl` (signed URL, TTL 3600s) —
 * the `images` bucket is private and `getPublicUrl` would return 404.
 * Throws bubble loudly per the admin-loud carve-out from CONSTRAINT-14.
 */
async function loadCurrentImage(imageId: string | null): Promise<CurrentImage> {
  if (imageId === null) return null;
  const record = await getImageById(imageId);
  if (record === null) return null;
  const signedUrl = await getImageUrl(record.bucket_path);
  return { id: record.id, signedUrl, altText: record.alt_text };
}

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
 * The destructive action lives in a separate {@link DeleteProjectButton}
 * client component below the form: it owns the confirm modal's open-state
 * and calls the `deleteProject` Server Action (T22).
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
  const currentImage = await loadCurrentImage(project.image_id);
  return (
    <>
      <AdminNav />
      <ProjectForm project={project} currentImage={currentImage} />
      <section className="px-6 pb-10">
        <DeleteProjectButton id={project.id} name={project.title} afterDelete="redirect" />
      </section>
    </>
  );
}
