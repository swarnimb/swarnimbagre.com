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
import { TAGS_MAX_COUNT } from '@/lib/admin-projects-mutations-schemas';
import type { Project } from '@/lib/types';

/** Lower bound for the progress_percent input — matches DB CHECK. */
const PERCENT_MIN = 0;
/** Upper bound for the progress_percent input — matches DB CHECK. */
const PERCENT_MAX = 100;
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
 * The display-controlling inputs: `progress_percent`, `subtitle`, `tags`, and
 * `post_id` (the "Linked writeup" FK into `posts`, T45.B). Split out of
 * `ProjectForm.tsx` to keep that file under CQ-02 (200-line component cap).
 *
 * T46 removed the `thumb_kind` picker. The redesigned card renders
 * photographic media only, so the SVG motif set it selected is no longer
 * drawn anywhere. `subtitle` and `tags` took its place.
 *
 * `tags` is a single comma-separated text input rather than a widget: a
 * handful of short labels is quicker to type than to manage, and the server
 * splits, trims and drops blanks on read.
 *
 * `post_id` is a shadcn Select paired with a hidden input, because Select
 * values do not participate in native FormData on submit. Its "Unset" option
 * resolves to an empty string, which the server-side reader coerces to null.
 */
export default function ProjectFormDisplay({
  project,
  state,
  posts,
}: ProjectFormDisplayProps): React.ReactElement {
  const initialPostId: string | null = project?.post_id ?? null;
  const [postId, setPostId] = useState<string>(initialPostId ?? POST_ID_UNSET);

  const progressError = state.fieldErrors?.progress_percent ?? '';
  const subtitleError = state.fieldErrors?.subtitle ?? '';
  const tagsError = state.fieldErrors?.tags ?? '';
  const postIdError = state.fieldErrors?.post_id ?? '';

  const initialProgress =
    typeof project?.progress_percent === 'number'
      ? String(project.progress_percent)
      : '';

  const initialTags = project?.tags?.join(', ') ?? '';

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
          <p
            id="project-progress-percent-error"
            role="alert"
            className="text-sm text-destructive"
          >
            {progressError}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Leave empty to hide the progress ring.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="project-subtitle">Subtitle</Label>
        <Input
          id="project-subtitle"
          name="subtitle"
          type="text"
          defaultValue={project?.subtitle ?? ''}
          aria-invalid={Boolean(subtitleError)}
          aria-describedby="project-subtitle-error"
          maxLength={120}
          placeholder="One line under the title"
        />
        {subtitleError ? (
          <p
            id="project-subtitle-error"
            role="alert"
            className="text-sm text-destructive"
          >
            {subtitleError}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Leave empty and the card shows a placeholder line.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="project-tags">Tags</Label>
        <Input
          id="project-tags"
          name="tags"
          type="text"
          defaultValue={initialTags}
          aria-invalid={Boolean(tagsError)}
          aria-describedby="project-tags-error"
          placeholder="Next.js, Supabase, Postgres"
        />
        {tagsError ? (
          <p
            id="project-tags-error"
            role="alert"
            className="text-sm text-destructive"
          >
            {tagsError}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Comma separated, up to {TAGS_MAX_COUNT}.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="project-post-id">Linked writeup</Label>
        <input type="hidden" name="post_id" value={hiddenPostIdValue} />
        <Select value={postId} onValueChange={(value) => setPostId(value)}>
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
