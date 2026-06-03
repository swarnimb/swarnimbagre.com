import AdminNav from '@/components/admin/AdminNav';
import ProjectForm from '@/components/admin/ProjectForm';
import { listPostsForPicker } from '@/lib/admin-queries';

/**
 * Admin "new project" page (`/admin/projects/new`).
 *
 * Server component. Fetches the published posts for the "Linked writeup"
 * picker (T45.B), then renders the admin nav + an unfilled {@link ProjectForm}.
 * The form is a client component (it needs `useActionState` + the sonner
 * toast); auth is enforced by `middleware.ts` for `/admin/:path*`, so this
 * page never renders for an unauthenticated request.
 *
 * The `project` prop is intentionally omitted, which the form reads as
 * "create mode".
 *
 * @returns React element rendering the create-project screen.
 */
export default async function Page(): Promise<React.ReactElement> {
  const posts = await listPostsForPicker();
  return (
    <>
      <AdminNav />
      <ProjectForm posts={posts} />
    </>
  );
}
