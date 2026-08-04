'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import DeleteNoteButton from '@/components/admin/DeleteNoteButton';
import NoteFields, { type NoteFieldValues } from '@/components/admin/NoteFields';
import { updateNote } from '@/lib/admin-notes-mutations';
import {
  NOTE_MUTATION_INITIAL_STATE,
  type NoteMutationState,
} from '@/lib/admin-notes-mutations-types';
import type { Note } from '@/lib/types';

/** Toast copy on success. CONSTRAINT-13: dry, no SaaS phrasing, no emoji. */
const SAVE_SUCCESS_MESSAGE = 'Saved.';

/** Props for {@link NoteRow}. */
export interface NoteRowProps {
  /** The note being edited. */
  note: Note;
  /** Optional injected action: tests override this to avoid Server Action wiring. */
  updateAction?: typeof updateNote;
}

/** Field values as they stand in the database, for the dirty check. */
function valuesFromNote(note: Note): NoteFieldValues {
  return {
    kicker: note.kicker,
    line: note.line,
    sortOrder: String(note.sort_order),
  };
}

/**
 * One editable note, rendered as a self-contained form card.
 *
 * Notes are edited in place rather than at a `/admin/notes/[id]/edit` route:
 * there are three of them and each is two short strings, so a navigation per
 * correction would cost more than it buys. That also rules out the shadcn
 * Table the other admin lists use, since a `form` cannot legally be a child
 * of a `tr`.
 *
 * Save is disabled until a field actually changes, so a stray click cannot
 * fire a no-op write and bump `updated_at` via the migration 014 trigger.
 * After a successful save the row rebases its dirty check on the values it
 * just wrote and calls `router.refresh()`.
 *
 * @param props See {@link NoteRowProps}.
 * @returns React element rendering one note edit form.
 */
export default function NoteRow({
  note,
  updateAction = updateNote,
}: NoteRowProps): React.ReactElement {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<
    NoteMutationState,
    FormData
  >(updateAction, NOTE_MUTATION_INITIAL_STATE);

  const [values, setValues] = useState<NoteFieldValues>(valuesFromNote(note));
  const [saved, setSaved] = useState<NoteFieldValues>(valuesFromNote(note));

  // `useActionState` hands back a new object per dispatch; the ref makes the
  // success effect fire once per submit rather than once per re-render.
  const handledStateRef = useRef<NoteMutationState | null>(null);

  useEffect(() => {
    if (state.status !== 'ok' || handledStateRef.current === state) return;
    handledStateRef.current = state;
    toast.success(SAVE_SUCCESS_MESSAGE);
    setSaved(values);
    router.refresh();
  }, [state, values, router]);

  const isDirty =
    values.kicker !== saved.kicker ||
    values.line !== saved.line ||
    values.sortOrder !== saved.sortOrder;
  const isFilled =
    values.kicker.trim().length > 0 && values.line.trim().length > 0;

  return (
    <li className="rounded-md border border-border bg-secondary p-4">
      {state.status === 'error' && state.formError ? (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {state.formError}
        </p>
      ) : null}
      <form action={formAction} className="space-y-4" noValidate>
        <input type="hidden" name="id" value={note.id} />
        <NoteFields
          idPrefix={`note-${note.id}`}
          values={values}
          onChange={setValues}
          state={state}
        />
        <div className="flex items-center gap-2">
          <Button
            type="submit"
            size="sm"
            disabled={isPending || !isDirty || !isFilled}
          >
            {isPending ? 'Saving' : 'Save'}
          </Button>
          <DeleteNoteButton id={note.id} name={note.kicker} size="sm" />
        </div>
      </form>
    </li>
  );
}
