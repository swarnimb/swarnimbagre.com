'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { NoteMutationState } from '@/lib/admin-notes-mutations-types';

/**
 * Input bounds. Each mirrors a CHECK constraint in migration 014, via the
 * matching const in `lib/admin-notes-mutations-schemas.ts`. Duplicated as
 * plain numbers here rather than imported because that schema module pulls
 * `zod`, which is server-bundle-only configuration.
 */
export const KICKER_MAX_LENGTH = 40;
/** See {@link KICKER_MAX_LENGTH}. */
export const LINE_MAX_LENGTH = 120;
/** See {@link KICKER_MAX_LENGTH}. */
export const SORT_ORDER_MIN = 0;

/** The three fields a note form owns. */
export interface NoteFieldValues {
  kicker: string;
  line: string;
  sortOrder: string;
}

/** Props for {@link NoteFields}. */
export interface NoteFieldsProps {
  /** Prefix for input ids, so two forms on one page do not collide. */
  idPrefix: string;
  /** Current controlled values. */
  values: NoteFieldValues;
  /** Called with the next values whenever any field changes. */
  onChange: (next: NoteFieldValues) => void;
  /** Live state from `useActionState`. Used to read per-field zod errors. */
  state: NoteMutationState;
}

/** Render one inline error paragraph, or nothing when the field is clean. */
function FieldError({
  id,
  message,
}: {
  id: string;
  message: string;
}): React.ReactElement | null {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}

/**
 * The kicker / line / sort order input trio, shared by the note insert form
 * and the per-row edit form. Extracted (CQ-07) so the two callers cannot
 * drift apart on bounds, ids, or error wiring, and so both stay under the
 * 200-line component cap (CQ-02).
 *
 * Controlled rather than uncontrolled: the insert form needs to clear the
 * fields after a successful submit, and the edit row needs to disable Save
 * until something actually changed. Both want the values in React state.
 *
 * @param props See {@link NoteFieldsProps}.
 * @returns React element rendering the three labelled inputs.
 */
export default function NoteFields({
  idPrefix,
  values,
  onChange,
  state,
}: NoteFieldsProps): React.ReactElement {
  const kickerId = `${idPrefix}-kicker`;
  const lineId = `${idPrefix}-line`;
  const sortOrderId = `${idPrefix}-sort-order`;

  const kickerError = state.fieldErrors?.kicker ?? '';
  const lineError = state.fieldErrors?.line ?? '';
  const sortOrderError = state.fieldErrors?.sort_order ?? '';

  return (
    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_7rem]">
      <div className="space-y-2">
        <Label htmlFor={kickerId}>Kicker</Label>
        <Input
          id={kickerId}
          name="kicker"
          type="text"
          value={values.kicker}
          onChange={(e) => onChange({ ...values, kicker: e.target.value })}
          aria-invalid={Boolean(kickerError)}
          aria-describedby={`${kickerId}-error`}
          maxLength={KICKER_MAX_LENGTH}
          placeholder="Currently reading"
        />
        <FieldError id={`${kickerId}-error`} message={kickerError} />
      </div>

      <div className="space-y-2">
        <Label htmlFor={lineId}>Line</Label>
        <Input
          id={lineId}
          name="line"
          type="text"
          value={values.line}
          onChange={(e) => onChange({ ...values, line: e.target.value })}
          aria-invalid={Boolean(lineError)}
          aria-describedby={`${lineId}-error`}
          maxLength={LINE_MAX_LENGTH}
          placeholder="The thing, and what you make of it so far"
        />
        <FieldError id={`${lineId}-error`} message={lineError} />
      </div>

      <div className="space-y-2">
        <Label htmlFor={sortOrderId}>Sort order</Label>
        <Input
          id={sortOrderId}
          name="sort_order"
          type="number"
          value={values.sortOrder}
          onChange={(e) => onChange({ ...values, sortOrder: e.target.value })}
          aria-invalid={Boolean(sortOrderError)}
          aria-describedby={`${sortOrderId}-error`}
          min={SORT_ORDER_MIN}
          step={1}
        />
        <FieldError id={`${sortOrderId}-error`} message={sortOrderError} />
      </div>
    </div>
  );
}
