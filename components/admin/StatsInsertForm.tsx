'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import StatFields, {
  EMPTY_STAT_VALUES,
  statFieldsFilled,
  type StatFieldValues,
} from '@/components/admin/StatFields';
import { insertStat } from '@/lib/admin-stats-mutations';
import {
  STAT_MUTATION_INITIAL_STATE,
  type StatMutationState,
} from '@/lib/admin-stats-mutations-types';

/** Toast copy on success. CONSTRAINT-13: dry, no SaaS phrasing, no emoji. */
const SAVE_SUCCESS_MESSAGE = 'Saved.';

/**
 * Props for {@link StatsInsertForm}.
 */
export interface StatsInsertFormProps {
  /** Optional injected action: tests override this to avoid Server Action wiring. */
  insertAction?: typeof insertStat;
}

/**
 * Admin insert form for a stat row.
 *
 * `category`, `label`, `value` are required; `unit` and `aside` are optional;
 * `sort_order` is an optional non-negative integer, and leaving it blank
 * appends the row to the end rather than filing it at rank 0. The Save button
 * is disabled until all three required fields are non-empty (the
 * controlled-state guard matches the zod boundary's `.trim().min(1)`).
 *
 * T46 (migration 014) added the last two fields: `aside` is the italic quip
 * the redesigned tile renders under the label, and `sort_order` is the manual
 * display rank the fixed 7-tile grid needs, since category-then-recency could
 * not express "these four, in this sequence".
 *
 * The inputs themselves live in {@link import('./StatFields').default}, which
 * this form shares with {@link import('./StatRow').default} so the insert
 * path and the in-place edit path cannot drift apart.
 *
 * On a successful action resolution (`state.status === 'ok'`), the form
 * surfaces a sonner toast, resets the controlled fields, and calls
 * `router.refresh()` so the list below picks up the new row without a
 * navigation. On error, field-level zod messages render inline under each
 * input, and a form-level generic message renders above the form for any
 * non-validation failure.
 *
 * @param props See {@link StatsInsertFormProps}.
 * @returns React element rendering the stat insert form.
 */
export default function StatsInsertForm({
  insertAction = insertStat,
}: StatsInsertFormProps = {}): React.ReactElement {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<
    StatMutationState,
    FormData
  >(insertAction, STAT_MUTATION_INITIAL_STATE);

  const [values, setValues] = useState<StatFieldValues>(EMPTY_STAT_VALUES);

  // `useActionState` returns a new object reference on every dispatch; the
  // ref tracks which `'ok'` state we've already handled so the success
  // effect fires once per submit. The form stays on the page (unlike
  // `PostForm`, which redirects), hence the need to dedupe.
  const handledStateRef = useRef<StatMutationState | null>(null);

  useEffect(() => {
    if (state.status !== 'ok' || handledStateRef.current === state) return;
    handledStateRef.current = state;
    toast.success(SAVE_SUCCESS_MESSAGE);
    setValues(EMPTY_STAT_VALUES);
    router.refresh();
  }, [state, router]);

  const isFilled = statFieldsFilled(values);

  return (
    <section className="px-6 py-10 space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">New stat</h1>
      {state.status === 'error' && state.formError ? (
        <p role="alert" className="text-sm text-destructive">
          {state.formError}
        </p>
      ) : null}
      <form action={formAction} className="space-y-6" noValidate>
        <StatFields
          idPrefix="stat"
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
