'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ProjectMutationState } from '@/lib/admin-projects-mutations-types';
import { THUMB_KIND_OPTIONS, type ThumbKind } from '@/lib/thumb-kinds';
import type { Project } from '@/lib/types';

/** Lower bound for the progress_percent input — matches DB CHECK. */
const PERCENT_MIN = 0;
/** Upper bound for the progress_percent input — matches DB CHECK. */
const PERCENT_MAX = 100;
/** Sentinel value rendered when `thumb_kind` is null (admin can leave unset). */
const THUMB_KIND_UNSET = '__unset__';

/** Props for {@link ProjectFormDisplay}. */
export interface ProjectFormDisplayProps {
  /** Existing project row; absent for create mode. */
  project?: Project;
  /** Live state from `useActionState`. Used to read per-field zod errors. */
  state: ProjectMutationState;
}

/**
 * Two display-controlling inputs — `progress_percent` (number 0-100) and
 * `thumb_kind` (closed enum of motif keys). Split out of `ProjectForm.tsx`
 * to keep that file under CQ-02 (200-line component cap).
 *
 * `thumb_kind` is rendered as a shadcn Select with a hidden input that
 * carries the value back to the form (Select component values don't
 * participate in native FormData on submit). The "Unset" option resolves
 * to an empty string at submit, which the server-side FormData reader
 * coerces to `null`.
 */
export default function ProjectFormDisplay({
  project,
  state,
}: ProjectFormDisplayProps): React.ReactElement {
  const initialThumbKind: ThumbKind | null = project?.thumb_kind ?? null;
  const [thumbKind, setThumbKind] = useState<ThumbKind | typeof THUMB_KIND_UNSET>(
    initialThumbKind ?? THUMB_KIND_UNSET,
  );

  const progressError = state.fieldErrors?.progress_percent ?? '';
  const thumbKindError = state.fieldErrors?.thumb_kind ?? '';

  const initialProgress =
    typeof project?.progress_percent === 'number'
      ? String(project.progress_percent)
      : '';

  // Hidden input value: empty string when unset; server coerces to null.
  const hiddenThumbKindValue =
    thumbKind === THUMB_KIND_UNSET ? '' : thumbKind;

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="project-progress-percent">Progress</Label>
        <Input
          id="project-progress-percent"
          name="progress_percent"
          type="number"
          defaultValue={initialProgress}
          aria-invalid={Boolean(progressError)}
          aria-describedby="project-progress-percent-error"
          min={PERCENT_MIN}
          max={PERCENT_MAX}
          step={1}
          className="w-32"
          placeholder="0-100"
        />
        {progressError ? (
          <p id="project-progress-percent-error" role="alert" className="text-sm text-destructive">
            {progressError}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Leave empty to hide the progress ring.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="project-thumb-kind">Thumbnail</Label>
        <input type="hidden" name="thumb_kind" value={hiddenThumbKindValue} />
        <Select
          value={thumbKind}
          onValueChange={(value) =>
            setThumbKind(value as ThumbKind | typeof THUMB_KIND_UNSET)
          }
        >
          <SelectTrigger id="project-thumb-kind" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={THUMB_KIND_UNSET}>Unset</SelectItem>
            {THUMB_KIND_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {thumbKindError ? (
          <p role="alert" className="text-sm text-destructive">
            {thumbKindError}
          </p>
        ) : null}
      </div>
    </>
  );
}
