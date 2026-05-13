import AdminNav from '@/components/admin/AdminNav';
import PostForm from '@/components/admin/PostForm';

/**
 * Admin "new post" page (`/admin/posts/new`).
 *
 * Server component. Renders the admin nav + an unfilled {@link PostForm}.
 * The form is a client component (it needs `useActionState` + the sonner
 * toast); auth is enforced by `middleware.ts` for `/admin/:path*`, so this
 * page never renders for an unauthenticated request.
 *
 * No data fetch — the `post` prop is intentionally omitted, which the form
 * reads as "create mode".
 *
 * @returns React element rendering the create-post screen.
 */
export default function Page(): React.ReactElement {
  return (
    <>
      <AdminNav />
      <PostForm />
    </>
  );
}
