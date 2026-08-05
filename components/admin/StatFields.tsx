'use client';

import StatFieldRow, {
  ASIDE_MAX_LENGTH,
  type StatFormField,
} from '@/components/admin/StatFieldRow';
import type { StatMutationState } from '@/lib/admin-stats-mutations-types';

/** Hint under the `aside` input. Explains what the field is for, tersely. */
const ASIDE_HINT = 'Optional. The small italic line under the label.';

/** Hint under the `sort_order` input. */
const SORT_ORDER_HINT =
  'Lower numbers show first. Leave it blank and the row goes last.';

/** The six fields a stat form owns, as controlled strings. */
export interface StatFieldValues {
  category: string;
  label: string;
  value: string;
  unit: string;
  aside: string;
  sortOrder: string;
}

/**
 * Blank values. Reused for the insert form's initial render and its reset.
 *
 * `sortOrder` starts empty, not `'0'`. A pre-filled zero meant every stat the
 * operator saved without touching the field landed at rank 0 and tied with
 * every other one; an empty string reaches the boundary as "unspecified" and
 * the DB trigger appends the row instead.
 */
export const EMPTY_STAT_VALUES: StatFieldValues = {
  category: '',
  label: '',
  value: '',
  unit: '',
  aside: '',
  sortOrder: '',
};

/**
 * True when the three required fields are non-empty. Mirrors the zod
 * boundary's `.trim().min(1)` so the Save button and the server agree on what
 * counts as submittable.
 */
export function statFieldsFilled(values: StatFieldValues): boolean {
  return (
    values.category.trim().length > 0 &&
    values.label.trim().length > 0 &&
    values.value.trim().length > 0
  );
}

/** True when `values` differs from `saved` in any field. */
export function statFieldsDirty(
  values: StatFieldValues,
  saved: StatFieldValues,
): boolean {
  return (
    values.category !== saved.category ||
    values.label !== saved.label ||
    values.value !== saved.value ||
    values.unit !== saved.unit ||
    values.aside !== saved.aside ||
    values.sortOrder !== saved.sortOrder
  );
}

/** Props for {@link StatFields}. */
export interface StatFieldsProps {
  /** Prefix for input ids, so several forms on one page do not collide. */
  idPrefix: string;
  /** Current controlled values. */
  values: StatFieldValues;
  /** Called with the next values whenever any field changes. */
  onChange: (next: StatFieldValues) => void;
  /** Live state from `useActionState`. Used to read per-field zod errors. */
  state: StatMutationState;
  /**
   * Render the aside / sort-order hints. On by default for the insert form,
   * off for list rows where the same two lines would repeat per row.
   */
  showHints?: boolean;
}

/**
 * Read a field error from the action state, defaulting to empty string for
 * the inline `<p role="alert">` slot below each input.
 */
function fieldError(state: StatMutationState, field: StatFormField): string {
  return state.fieldErrors?.[field] ?? '';
}

/**
 * The six-input stat field set, shared by {@link
 * import('./StatsInsertForm').default} and {@link
 * import('./StatRow').default}. Extracted (CQ-07) so the insert form and the
 * per-row edit form cannot drift apart on bounds, ids, hints, or error
 * wiring, and so both callers stay under the 200-line component cap (CQ-02).
 * Mirrors how `NoteFields` sits between `NotesInsertForm` and `NoteRow`.
 *
 * Controlled rather than uncontrolled: the insert form clears the fields
 * after a successful submit, and an edit row disables Save until something
 * actually changed. Both want the values in React state.
 *
 * @param props See {@link StatFieldsProps}.
 * @returns React element rendering the six labelled inputs.
 */
export default function StatFields({
  idPrefix,
  values,
  onChange,
  state,
  showHints = true,
}: StatFieldsProps): React.ReactElement {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <StatFieldRow
        id={`${idPrefix}-category`}
        name="category"
        labelText="Category"
        value={values.category}
        onValueChange={(next) => onChange({ ...values, category: next })}
        error={fieldError(state, 'category')}
        required
      />
      <StatFieldRow
        id={`${idPrefix}-label`}
        name="label"
        labelText="Label"
        value={values.label}
        onValueChange={(next) => onChange({ ...values, label: next })}
        error={fieldError(state, 'label')}
        required
      />
      <StatFieldRow
        id={`${idPrefix}-value`}
        name="value"
        labelText="Value"
        value={values.value}
        onValueChange={(next) => onChange({ ...values, value: next })}
        error={fieldError(state, 'value')}
        required
      />
      <StatFieldRow
        id={`${idPrefix}-unit`}
        name="unit"
        labelText="Unit (optional)"
        value={values.unit}
        onValueChange={(next) => onChange({ ...values, unit: next })}
        error={fieldError(state, 'unit')}
      />
      <StatFieldRow
        id={`${idPrefix}-aside`}
        name="aside"
        labelText="Aside (optional)"
        value={values.aside}
        onValueChange={(next) => onChange({ ...values, aside: next })}
        error={fieldError(state, 'aside')}
        maxLength={ASIDE_MAX_LENGTH}
        hint={showHints ? ASIDE_HINT : undefined}
      />
      <StatFieldRow
        id={`${idPrefix}-sort-order`}
        name="sort_order"
        labelText="Sort order"
        type="number"
        value={values.sortOrder}
        onValueChange={(next) => onChange({ ...values, sortOrder: next })}
        error={fieldError(state, 'sort_order')}
        hint={showHints ? SORT_ORDER_HINT : undefined}
      />
    </div>
  );
}
