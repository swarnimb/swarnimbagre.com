'use client';

import NoteRow from '@/components/admin/NoteRow';
import type { Note } from '@/lib/types';

/** Empty-state copy. CONSTRAINT-13: terse, no decoration, no SaaS phrasing. */
const EMPTY_STATE = 'No notes yet';

/** Props for {@link NotesList}. The page route owns fetching. */
export interface NotesListProps {
  rows: Note[];
}

/**
 * Admin notes list view (T46).
 *
 * A stack of editable {@link NoteRow} cards rather than the shadcn Table the
 * stats, posts and projects lists use. Two reasons: notes are edited in place
 * (no edit route), and a `form` cannot legally be a child of a `tr`, so the
 * table markup and inline editing are mutually exclusive.
 *
 * No pagination either. The Other page renders three text tiles, so the row
 * count is a handful by design and
 * {@link import('@/lib/admin-queries-notes').getAllNotes} returns the whole
 * table in one read. Rows arrive in display order (`sort_order ASC`), which
 * is the order the public page uses, so the list doubles as a preview of the
 * running order.
 *
 * @param props See {@link NotesListProps}.
 * @returns React element rendering the note list.
 */
export default function NotesList({ rows }: NotesListProps): React.ReactElement {
  return (
    <section className="px-6 py-10 space-y-6">
      <header className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">All notes</h2>
        <p className="text-sm text-muted-foreground">
          {rows.length} total, in display order
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{EMPTY_STATE}</p>
      ) : (
        <ul className="space-y-4">
          {rows.map((row) => (
            <NoteRow key={row.id} note={row} />
          ))}
        </ul>
      )}
    </section>
  );
}
