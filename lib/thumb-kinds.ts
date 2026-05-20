/**
 * Closed value set for `projects.thumb_kind`.
 *
 * The DB stores `thumb_kind` as nullable text (migration 009) without an
 * enum constraint. The value set is enforced here at the code boundary —
 * the admin zod schema validates against `THUMB_KIND_VALUES`, and the
 * public render layer (`ProjectThumb.tsx`) falls back to the `dots` motif
 * on unknown values. CONSTRAINT-05 Override 1 (see docs/founder-brief.md).
 *
 * Adding a new motif:
 *   1. Add the new SVG branch in `components/public/ProjectThumb.tsx`.
 *   2. Add the new key to `THUMB_KIND_VALUES` below.
 *   3. Add a matching `{ value, label }` entry to `THUMB_KIND_OPTIONS`.
 *
 * No migration required — the DB column accepts any text and lets the
 * code-side enum carry the integrity contract.
 */

/**
 * Tuple of allowed `thumb_kind` values. Order is significant only for the
 * admin dropdown — earlier entries appear first.
 */
export const THUMB_KIND_VALUES = [
  'disc',
  'coin',
  'nodes',
  'bars',
  'racquet',
  'dots',
] as const;

/** Union of allowed thumb-kind string literals, derived from the tuple. */
export type ThumbKind = (typeof THUMB_KIND_VALUES)[number];

/**
 * Display options for the admin Select. `value` is the stored DB key;
 * `label` is what the admin sees in the dropdown. Labels are minimal —
 * the single admin user knows what each motif renders as.
 */
export const THUMB_KIND_OPTIONS: ReadonlyArray<{
  readonly value: ThumbKind;
  readonly label: string;
}> = [
  { value: 'disc', label: 'Disc' },
  { value: 'coin', label: 'Coin' },
  { value: 'nodes', label: 'Nodes' },
  { value: 'bars', label: 'Bars' },
  { value: 'racquet', label: 'Racquet' },
  { value: 'dots', label: 'Dots' },
];

/**
 * Type guard for runtime narrowing — useful in load-layer code that
 * receives unconstrained text from the DB.
 */
export function isThumbKind(value: unknown): value is ThumbKind {
  return (
    typeof value === 'string' &&
    (THUMB_KIND_VALUES as readonly string[]).includes(value)
  );
}
