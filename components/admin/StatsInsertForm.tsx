'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { insertStat } from '@/lib/admin-stats-mutations';
import {
  STAT_MUTATION_INITIAL_STATE,
  type StatMutationState,
} from '@/lib/admin-stats-mutations-types';

/** Toast copy on success. CONSTRAINT-13: dry, no SaaS phrasing, no emoji. */
const SAVE_SUCCESS_MESSAGE = 'Saved.';

/**
 * Max input length for each text field. Mirrors `STAT_FIELD_MAX_LENGTH` in
 * `lib/admin-stats-mutations-internal.ts` so the HTML `maxLength`
 * attribute and the zod boundary agree.
 */
const FIELD_MAX_LENGTH = 200;

/** Names of fields the stat form owns. */
type StatFormField = 'category' | 'label' | 'value' | 'unit';

/** Props for {@link FieldRow}. */
interface FieldRowProps {
  id: string;
  name: StatFormField;
  labelText: string;
  value: string;
  onValueChange: (next: string) => void;
  error: string;
  required?: boolean;
}

/**
 * Label + Input + inline error slot row. Extracted (CQ-07) because the four
 * stat-form fields differ only in `name`, `labelText`, and `required` —
 * inlining the same JSX four times would be duplication, not clarity.
 */
function FieldRow({
  id,
  name,
  labelText,
  value,
  onValueChange,
  error,
  required = false,
}: FieldRowProps): React.ReactElement {
  const errorId = `${id}-error`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{labelText}</Label>
      <Input
        id={id}
        name={name}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={errorId}
        maxLength={FIELD_MAX_LENGTH}
        required={required}
      />
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Props for {@link StatsInsertForm}.
 */
export interface StatsInsertFormProps {
  /** Optional injected action — tests override this to avoid Server Action wiring. */
  insertAction?: typeof insertStat;
}

/**
 * Read a field error from the action state, defaulting to empty string for
 * the inline `<p role="alert">` slot below each input.
 */
function fieldError(state: StatMutationState, field: StatFormField): string {
  return state.fieldErrors?.[field] ?? '';
}

/**
 * Admin insert form for a stat row.
 *
 * Stats has no edit path (CONSTRAINT-10: delete-then-reinsert for
 * corrections) and no slug or status, so this is an insert-only form. Four
 * text inputs — `category`, `label`, `value` are required; `unit` is
 * optional. The Submit button is disabled until all three required fields
 * are non-empty (the controlled-state guard matches the zod boundary's
 * `.trim().min(1)`).
 *
 * On a successful action resolution (`state.status === 'ok'`), the form
 * surfaces a sonner toast, resets the four controlled fields, and calls
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

  const [category, setCategory] = useState('');
  const [label, setLabel] = useState('');
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState('');

  // `useActionState` returns a new object reference on every dispatch; the
  // ref tracks which `'ok'` state we've already handled so the success
  // effect fires once per submit. The form stays on the page (unlike
  // `PostForm`, which redirects), hence the need to dedupe.
  const handledStateRef = useRef<StatMutationState | null>(null);

  useEffect(() => {
    if (state.status !== 'ok' || handledStateRef.current === state) return;
    handledStateRef.current = state;
    toast.success(SAVE_SUCCESS_MESSAGE);
    setCategory('');
    setLabel('');
    setValue('');
    setUnit('');
    router.refresh();
  }, [state, router]);

  const isFilled =
    category.trim().length > 0 &&
    label.trim().length > 0 &&
    value.trim().length > 0;

  return (
    <section className="px-6 py-10 space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">New stat</h1>
      {state.status === 'error' && state.formError ? (
        <p role="alert" className="text-sm text-destructive">
          {state.formError}
        </p>
      ) : null}
      <form action={formAction} className="space-y-6" noValidate>
        <FieldRow
          id="stat-category"
          name="category"
          labelText="Category"
          value={category}
          onValueChange={setCategory}
          error={fieldError(state, 'category')}
          required
        />
        <FieldRow
          id="stat-label"
          name="label"
          labelText="Label"
          value={label}
          onValueChange={setLabel}
          error={fieldError(state, 'label')}
          required
        />
        <FieldRow
          id="stat-value"
          name="value"
          labelText="Value"
          value={value}
          onValueChange={setValue}
          error={fieldError(state, 'value')}
          required
        />
        <FieldRow
          id="stat-unit"
          name="unit"
          labelText="Unit (optional)"
          value={unit}
          onValueChange={setUnit}
          error={fieldError(state, 'unit')}
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
