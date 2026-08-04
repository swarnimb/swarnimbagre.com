import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { signOut } from '@/lib/auth';

/**
 * Top navigation bar for the admin panel.
 *
 * Server component. Renders five section links (Projects, Posts, Stats, Notes,
 * Images) on the left and a sign-out form on the right. Notes sits next to
 * Stats because the two back the same public page. The sign-out button posts to the
 * `signOut` Server Action in `lib/auth.ts`, which clears the Supabase session
 * and redirects to `/admin/login` (auth-flow.md §2a).
 *
 * Styling uses only Tailwind utility classes that resolve to namespaced
 * `--admin-*` tokens (CONSTRAINT-16). No raw hex, no emoji. Voice: dry.
 *
 * @returns React element rendering the admin nav bar.
 */
export default function AdminNav(): React.ReactElement {
  return (
    <nav className="flex items-center justify-between border-b border-border bg-secondary px-6 py-3">
      <ul className="flex items-center gap-6">
        <li>
          <Link
            href="/admin/projects"
            className="text-foreground hover:text-primary transition-colors"
          >
            Projects
          </Link>
        </li>
        <li>
          <Link
            href="/admin/posts"
            className="text-foreground hover:text-primary transition-colors"
          >
            Posts
          </Link>
        </li>
        <li>
          <Link
            href="/admin/stats"
            className="text-foreground hover:text-primary transition-colors"
          >
            Stats
          </Link>
        </li>
        <li>
          <Link
            href="/admin/notes"
            className="text-foreground hover:text-primary transition-colors"
          >
            Notes
          </Link>
        </li>
        <li>
          <Link
            href="/admin/images"
            className="text-foreground hover:text-primary transition-colors"
          >
            Images
          </Link>
        </li>
      </ul>
      <form action={signOut}>
        <Button type="submit" variant="ghost">
          Sign out
        </Button>
      </form>
    </nav>
  );
}
