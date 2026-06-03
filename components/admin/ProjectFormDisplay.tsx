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
/** Sentinel value rendered when `post_id` is null (project has no linked post). */
const POST_ID_UNSET = '__unset__';

/** Props for {@link ProjectFormDisplay}. */
export interface ProjectFormDisplayProps {
  /** Existing project row; absent for create mode. */
  project?: Project;
  /** Live state from `useActionState`. Used to read per-field zod errors. */
  state: ProjectMutationState;
  /** Published posts available for the "Linked writeup" picker (T45.B). */
  posts: { id: string; title: string }[];
}

/**
 * Three display-controlling inputs — `progress_percent` (number 0-100),
 * `thumb_kind` (closed enum of motif keys), and `post_id` (the "Linked
 * writeup" FK into `posts`, T45.B). Split out of `ProjectForm.tsx` to keep
 * that file under CQ-02 (200-line component cap).
 *
 * `thumb_kind` and `post_id` are each rendered as a shadcn Select with a
 * hidden input that carries the value back to the form (Select component
 * values don't participate in native FormData on submit). The "Unset" option
 * resolves to an empty string at submit, which the server-side FormData reader
 * coerces to `null`. `post_id`'s options are the published posts passed in via
 * `posts` (drafts are excluded upstream by `listPostsForPicker`).
 */
export default function ProjectFormDisplay({
  project,
  state,
  posts,
}: ProjectFormDisplayProps): React.ReactElement {
  const initialThumbKind: ThumbKind | null = project?.thumb_kind ?? null;
  const [thumbKind, setThumbKind] = useState<ThumbKind | typeof THUMB_KIND_UNSET>(
    initialThumbKind ?? THUMB_KIND_UNSET,
  );

  const initialPostId: string | null = project?.post_id ?? null;
  const [postId, setPostId] = useState<string>(
    initialPostId ?? POST_ID_UNSET,
  );

  const progressError = state.fieldErrors?.progress_percent ?? '';
  const thumbKindError = state.fieldErrors?.thumb_kind ?? '';
  const postIdError = state.fieldErrors?.post_id ?? '';

  const initialProgress =
    typeof project?.progress_percent === 'number'
      ? String(project.progress_percent)
      : '';

  // Hidden input value: empty string when unset; server coerces to null.
  const hiddenThumbKindValue =
    thumbKind === THUMB_KIND_UNSET ? '' : thumbKind;

  // Hidden input value: empty string when unset; server coerces to null.
  const hiddenPostIdValue = postId === POST_ID_UNSET ? '' : postId;

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

      <div className="space-y-2">
        <Label htmlFor="project-post-id">Linked writeup</Label>
        <input type="hidden" name="post_id" value={hiddenPostIdValue} />
        <Select
          value={postId}
          onValueChange={(value) => setPostId(value)}
        >
          <SelectTrigger id="project-post-id" className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={POST_ID_UNSET}>Unset</SelectItem>
            {posts.map((post) => (
              <SelectItem key={post.id} value={post.id}>
                {post.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {postIdError ? (
          <p role="alert" className="text-sm text-destructive">
            {postIdError}
          </p>
        ) : null}
      </div>
    </>
  );
}
