'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Max input length for a plain stat text field. Mirrors
 * `STAT_FIELD_MAX_LENGTH` in `lib/admin-stats-mutations-schemas.ts` so the
 * HTML `maxLength` attribute and the zod boundary agree.
 */
export const FIELD_MAX_LENGTH = 200;

/**
 * Max input length for the optional `aside` quip. Mirrors
 * `STAT_ASIDE_MAX_LENGTH` in `lib/admin-stats-mutations-schemas.ts`, which
 * in turn mirrors the `stats_aside_length` CHECK in migration 014.
 */
export const ASIDE_MAX_LENGTH = 160;

/** Lower bound for the `sort_order` input. Mirrors the migration 014 CHECK. */
export const SORT_ORDER_MIN = 0;

/** Names of fields the stat form owns. */
export type StatFormField =
  | 'category'
  | 'label'
  | 'value'
  | 'unit'
  | 'aside'
  | 'sort_order';

/** Props for {@link StatFieldRow}. */
export interface StatFieldRowProps {
  id: string;
  name: StatFormField;
  labelText: string;
  value: string;
  onValueChange: (next: string) => void;
  error: string;
  required?: boolean;
  /** Character ceiling for text inputs. Ignored when `type` is `'number'`. */
  maxLength?: number;
  /** Input type. `'number'` swaps the length cap for a `min` bound. */
  type?: 'text' | 'number';
  /** Optional hint rendered under the input when there is no error. */
  hint?: string;
}

/**
 * Label + Input + inline error slot row for the stat form. Extracted (CQ-07)
 * because the stat-form fields differ only in `name`, `labelText`, and a
 * couple of bounds; inlining the same JSX six times would be duplication,
 * not clarity. Lives in its own file so `StatsInsertForm.tsx` stays under
 * the 200-line component cap (CQ-02).
 *
 * @param props See {@link StatFieldRowProps}.
 * @returns React element rendering one labelled input with its error slot.
 */
export default function StatFieldRow({
  id,
  name,
  labelText,
  value,
  onValueChange,
  error,
  required = false,
  maxLength = FIELD_MAX_LENGTH,
  type = 'text',
  hint,
}: StatFieldRowProps): React.ReactElement {
  const errorId = `${id}-error`;
  const isNumber = type === 'number';
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{labelText}</Label>
      <Input
        id={id}
        name={name}
        type={type}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={errorId}
        maxLength={isNumber ? undefined : maxLength}
        min={isNumber ? SORT_ORDER_MIN : undefined}
        step={isNumber ? 1 : undefined}
        className={isNumber ? 'w-32' : undefined}
        required={required}
      />
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p className="text-sm text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
