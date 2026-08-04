import AdminNav from '@/components/admin/AdminNav';
import NotesInsertForm from '@/components/admin/NotesInsertForm';
import NotesList from '@/components/admin/NotesList';
import { getAllNotes } from '@/lib/admin-queries';

/**
 * Admin notes list page (`/admin/notes`).
 *
 * Server component. Calls {@link getAllNotes} and renders the
 * {@link NotesInsertForm} above the {@link NotesList}. Mirrors the stats page
 * layout (insert form on the list page, no separate `/new` route) with two
 * differences: no `searchParams` handling, because notes is unpaginated, and
 * the rows are editable in place rather than delete-only.
 *
 * Errors from the data layer are intentionally NOT wrapped in `safeLoad`:
 * CONSTRAINT-14 governs public pages; the admin operator should see Next 15's
 * error overlay so failures are loud and obvious.
 *
 * Auth is enforced by `middleware.ts` for `/admin/:path*`; this page never
 * renders for an unauthenticated request.
 */
export default async function Page(): Promise<React.ReactElement> {
  const rows = await getAllNotes();
  return (
    <>
      <AdminNav />
      <NotesInsertForm />
      <NotesList rows={rows} />
    </>
  );
}
