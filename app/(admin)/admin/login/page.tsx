import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase';
import { LoginForm } from '@/components/admin/LoginForm';

/**
 * Admin sign-in page. Renders the magic-link form. A request that already
 * carries a valid session is bounced to `/admin` so the form is never shown
 * twice (auth-flow.md §2; CONSTRAINT-17).
 */
export default async function AdminLoginPage(): Promise<React.ReactElement> {
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getUser();
  if (data?.user) {
    redirect('/admin');
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-lg font-medium text-foreground">Sign in</h1>
      <LoginForm />
    </main>
  );
}
