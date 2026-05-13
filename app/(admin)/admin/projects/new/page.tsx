import AdminNav from '@/components/admin/AdminNav';
import ProjectForm from '@/components/admin/ProjectForm';

/**
 * Admin "new project" page (`/admin/projects/new`).
 *
 * Server component. Renders the admin nav + an unfilled {@link ProjectForm}.
 * The form is a client component (it needs `useActionState` + the sonner
 * toast); auth is enforced by `middleware.ts` for `/admin/:path*`, so this
 * page never renders for an unauthenticated request.
 *
 * No data fetch — the `project` prop is intentionally omitted, which the form
 * reads as "create mode".
 *
 * @returns React element rendering the create-project screen.
 */
export default function Page(): React.ReactElement {
  return (
    <>
      <AdminNav />
      <ProjectForm />
    </>
  );
}
