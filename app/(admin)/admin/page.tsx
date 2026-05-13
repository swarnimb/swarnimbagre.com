import AdminNav from '@/components/admin/AdminNav';

/**
 * Admin home page. Renders the post-login landing surface.
 * Auth is enforced at the middleware layer — this page never renders for an unauthenticated request.
 */
export default function AdminHome() {
  return (
    <>
      <AdminNav />
      <main className="px-6 py-10">
        <h1 className="text-2xl font-semibold text-foreground">Admin</h1>
      </main>
    </>
  );
}
