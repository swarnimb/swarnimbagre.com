'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import NoteFields, {
  type NoteFieldValues,
} from '@/components/admin/NoteFields';
import { createNote } from '@/lib/admin-notes-mutations';
import {
  NOTE_MUTATION_INITIAL_STATE,
  type NoteMutationState,
} from '@/lib/admin-notes-mutations-types';

/** Toast copy on success. CONSTRAINT-13: dry, no SaaS phrasing, no emoji. */
const SAVE_SUCCESS_MESSAGE = 'Saved.';

/**
 * Blank field values. Reused for the initial render and the post-submit reset.
 *
 * `sortOrder` starts empty, not `'0'`. A pre-filled zero meant every note the
 * operator saved without touching the field landed at rank 0 and tied with
 * every other one; an empty string reaches the boundary as "unspecified" and
 * the DB trigger appends the row instead.
 */
const EMPTY_VALUES: NoteFieldValues = {
  kicker: '',
  line: '',
  sortOrder: '',
};

/** Props for {@link NotesInsertForm}. */
export interface NotesInsertFormProps {
  /** Optional injected action: tests override this to avoid Server Action wiring. */
  createAction?: typeof createNote;
}

/**
 * Admin insert form for a note row.
 *
 * Mirrors {@link import('./StatsInsertForm').default}: the form sits above
 * the list on the same page rather than at a `/admin/notes/new` route,
 * because a note is three short inputs and a create/list split would not pay
 * for itself. The Submit button is disabled until both text fields are
 * non-empty, matching the zod boundary's `.trim().min(1)`.
 *
 * On a successful action resolution, the form surfaces a sonner toast,
 * clears the fields, and calls `router.refresh()` so the list below picks up
 * the new row without a navigation. On error, field-level zod messages
 * render inline under each input and a form-level generic message renders
 * above the form.
 *
 * @param props See {@link NotesInsertFormProps}.
 * @returns React element rendering the note insert form.
 */
export default function NotesInsertForm({
  createAction = createNote,
}: NotesInsertFormProps = {}): React.ReactElement {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<
    NoteMutationState,
    FormData
  >(createAction, NOTE_MUTATION_INITIAL_STATE);

  const [values, setValues] = useState<NoteFieldValues>(EMPTY_VALUES);

  // `useActionState` returns a new object reference on every dispatch; the
  // ref tracks which `'ok'` state we've already handled so the success
  // effect fires once per submit. The form stays on the page, hence the
  // need to dedupe.
  const handledStateRef = useRef<NoteMutationState | null>(null);

  useEffect(() => {
    if (state.status !== 'ok' || handledStateRef.current === state) return;
    handledStateRef.current = state;
    toast.success(SAVE_SUCCESS_MESSAGE);
    setValues(EMPTY_VALUES);
    router.refresh();
  }, [state, router]);

  const isFilled =
    values.kicker.trim().length > 0 && values.line.trim().length > 0;

  return (
    <section className="px-6 py-10 space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">New note</h1>
      <p className="text-sm text-muted-foreground">
        The text tiles on the Other page. Kicker is the small label, line is
        the sentence under it.
      </p>
      {state.status === 'error' && state.formError ? (
        <p role="alert" className="text-sm text-destructive">
          {state.formError}
        </p>
      ) : null}
      <form action={formAction} className="space-y-6" noValidate>
        <NoteFields
          idPrefix="note-new"
          values={values}
          onChange={setValues}
          state={state}
        />
        <div className="flex items-center gap-2">
          <Button type="submit" disabled={isPending || !isFilled}>
            {isPending ? 'Saving' : 'Save'}
          </Button>
        </div>
      </form>
    </section>
  );
}
