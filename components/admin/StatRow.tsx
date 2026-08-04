'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import DeleteStatButton from '@/components/admin/DeleteStatButton';
import StatFields, {
  statFieldsDirty,
  statFieldsFilled,
  type StatFieldValues,
} from '@/components/admin/StatFields';
import { updateStat } from '@/lib/admin-stats-mutations';
import {
  STAT_MUTATION_INITIAL_STATE,
  type StatMutationState,
} from '@/lib/admin-stats-mutations-types';
import type { Stat } from '@/lib/types';

/** Toast copy on success. CONSTRAINT-13: dry, no SaaS phrasing, no emoji. */
const SAVE_SUCCESS_MESSAGE = 'Saved.';

/** Props for {@link StatRow}. */
export interface StatRowProps {
  /** The stat being edited. */
  stat: Stat;
  /** Optional injected action: tests override this to avoid Server Action wiring. */
  updateAction?: typeof updateStat;
}

/** Field values as they stand in the database, for the dirty check. */
function valuesFromStat(stat: Stat): StatFieldValues {
  return {
    category: stat.category,
    label: stat.label,
    value: stat.value,
    unit: stat.unit ?? '',
    aside: stat.aside ?? '',
    sortOrder: String(stat.sort_order),
  };
}

/** Format an ISO timestamp into a compact YYYY-MM-DD string. */
function formatCreated(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * One editable stat, rendered as a self-contained form card.
 *
 * Stats are edited in place rather than at a `/admin/stats/[id]/edit` route,
 * for the same reason notes are: a stat is six short inputs, so a navigation
 * per correction would cost more than it buys. That also rules out the shadcn
 * Table this list used before, since a `form` cannot legally be a child of a
 * `tr`, and inline editing plus table markup are therefore mutually
 * exclusive. {@link import('./NoteRow').default} solved the identical problem
 * the same way; the two admin surfaces are deliberately the same shape.
 *
 * Save is disabled until a field actually changes, so a stray click cannot
 * fire a no-op write. After a successful save the row rebases its dirty check
 * on the values it just wrote and calls `router.refresh()`.
 *
 * Delete is unchanged: {@link import('./DeleteStatButton').default} with its
 * confirm modal, still hard-delete only (CONSTRAINT-10). Adding an edit path
 * does not add an undo path.
 *
 * @param props See {@link StatRowProps}.
 * @returns React element rendering one stat edit form.
 */
export default function StatRow({
  stat,
  updateAction = updateStat,
}: StatRowProps): React.ReactElement {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<
    StatMutationState,
    FormData
  >(updateAction, STAT_MUTATION_INITIAL_STATE);

  const [values, setValues] = useState<StatFieldValues>(valuesFromStat(stat));
  const [saved, setSaved] = useState<StatFieldValues>(valuesFromStat(stat));

  // `useActionState` hands back a new object per dispatch; the ref makes the
  // success effect fire once per submit rather than once per re-render.
  const handledStateRef = useRef<StatMutationState | null>(null);

  useEffect(() => {
    if (state.status !== 'ok' || handledStateRef.current === state) return;
    handledStateRef.current = state;
    toast.success(SAVE_SUCCESS_MESSAGE);
    setSaved(values);
    router.refresh();
  }, [state, values, router]);

  const isDirty = statFieldsDirty(values, saved);
  const isFilled = statFieldsFilled(values);

  return (
    <li className="rounded-md border border-border bg-secondary p-4">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <p className="text-sm font-medium text-foreground">{saved.label}</p>
        <p className="text-sm text-muted-foreground">
          Created {formatCreated(stat.created_at)}
        </p>
      </div>
      {state.status === 'error' && state.formError ? (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {state.formError}
        </p>
      ) : null}
      <form action={formAction} className="space-y-4" noValidate>
        <input type="hidden" name="id" value={stat.id} />
        <StatFields
          idPrefix={`stat-${stat.id}`}
          values={values}
          onChange={setValues}
          state={state}
          showHints={false}
        />
        <div className="flex items-center gap-2">
          <Button
            type="submit"
            size="sm"
            disabled={isPending || !isDirty || !isFilled}
          >
            {isPending ? 'Saving' : 'Save'}
          </Button>
          <DeleteStatButton id={stat.id} name={saved.label} size="sm" />
        </div>
      </form>
    </li>
  );
}
