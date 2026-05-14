'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createPost, updatePost } from '@/lib/admin-posts-mutations';
import {
  POST_MUTATION_INITIAL_STATE,
  type PostMutationState,
} from '@/lib/admin-posts-mutations-types';
import type { Post, PostStatus } from '@/lib/types';

/** Toast copy on success. CONSTRAINT-13: dry, no SaaS phrasing, no emoji. */
const SAVE_SUCCESS_MESSAGE = 'Saved.';

/** Hardcoded after-save destination — list view for both create and edit. */
const POSTS_LIST_PATH = '/admin/posts';

/**
 * Props for {@link PostForm}. `post` is omitted on the create screen and
 * present on the edit screen.
 */
export interface PostFormProps {
  /** Existing post row; absent for create. */
  post?: Post;
  /** Optional injected action — tests override these to avoid Server Action wiring. */
  createAction?: typeof createPost;
  /** Optional injected action — tests override these to avoid Server Action wiring. */
  updateAction?: typeof updatePost;
}

/**
 * Read a field error from the action state, defaulting to empty string for
 * the inline `<p role="alert">` slot below each input.
 */
function fieldError(
  state: PostMutationState,
  field: 'title' | 'content' | 'status',
): string {
  return state.fieldErrors?.[field] ?? '';
}

/**
 * Admin create / edit form for a post row.
 *
 * One component, two modes. Mode is inferred from the `post` prop:
 *
 * - **No `post`** → render the create form; submit calls `createPost`
 *   (the Server Action from `lib/admin-posts-mutations.ts`).
 * - **`post` present** → render the edit form prefilled from `post`; submit
 *   calls `updatePost` with a hidden `id` field. The slug input becomes
 *   read-only when `post.status === 'published'` to reflect CONSTRAINT-12
 *   (the migration 006 trigger `posts_prevent_slug_change` is the DB-side
 *   guard).
 *
 * CONSTRAINT-06: `content` is a plain `<Textarea>` storing raw Markdown.
 * No WYSIWYG; no HTML conversion at write time. The T12 client renderer
 * handles read-time rendering and sanitization.
 *
 * On a successful action resolution (`state.status === 'ok'`), the form
 * surfaces a sonner toast and pushes the user to `/admin/posts`. On error,
 * field-level zod messages render inline under each input, and a form-level
 * generic message renders above the form for any non-validation failure.
 * The action wrapper enforces six-channel uniformity for the non-validation
 * paths (`docs/auth-flow.md` §2a).
 *
 * @param props See {@link PostFormProps}.
 * @returns React element rendering the post form.
 */
export default function PostForm({
  post,
  createAction = createPost,
  updateAction = updatePost,
}: PostFormProps): React.ReactElement {
  const router = useRouter();
  const isEdit = post !== undefined;
  const action = isEdit ? updateAction : createAction;
  const [state, formAction, isPending] = useActionState<
    PostMutationState,
    FormData
  >(action, POST_MUTATION_INITIAL_STATE);

  // Local state for the controlled `status` Select (FormData needs a name; the
  // shadcn Select renders into a portal so a hidden input mirrors the value
  // back into the form submission).
  const [status, setStatus] = useState<PostStatus>(post?.status ?? 'draft');

  // On success: toast + redirect. Effect rather than render-time side-effect
  // because `router.push` is forbidden during render.
  useEffect(() => {
    if (state.status === 'ok') {
      toast.success(SAVE_SUCCESS_MESSAGE);
      router.push(POSTS_LIST_PATH);
    }
  }, [state.status, router]);

  const isSlugLocked = post?.status === 'published';

  return (
    <section className="px-6 py-10 space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">
        {isEdit ? 'Edit post' : 'New post'}
      </h1>
      {state.status === 'error' && state.formError ? (
        <p role="alert" className="text-sm text-destructive">
          {state.formError}
        </p>
      ) : null}
      <form action={formAction} className="space-y-6" noValidate>
        {isEdit ? <input type="hidden" name="id" value={post.id} /> : null}
        <input type="hidden" name="status" value={status} />

        <div className="space-y-2">
          <Label htmlFor="post-title">Title</Label>
          <Input
            id="post-title"
            name="title"
            defaultValue={post?.title ?? ''}
            aria-invalid={Boolean(fieldError(state, 'title'))}
            aria-describedby="post-title-error"
            maxLength={200}
            required
          />
          {fieldError(state, 'title') ? (
            <p id="post-title-error" role="alert" className="text-sm text-destructive">
              {fieldError(state, 'title')}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="post-content">Content</Label>
          <Textarea
            id="post-content"
            name="content"
            defaultValue={post?.content ?? ''}
            aria-invalid={Boolean(fieldError(state, 'content'))}
            aria-describedby="post-content-error"
            rows={20}
            required
          />
          {fieldError(state, 'content') ? (
            <p id="post-content-error" role="alert" className="text-sm text-destructive">
              {fieldError(state, 'content')}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="post-status">Status</Label>
          <Select
            value={status}
            onValueChange={(value) => setStatus(value as PostStatus)}
          >
            <SelectTrigger id="post-status" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isEdit && isSlugLocked ? (
          <div className="space-y-2">
            <Label htmlFor="post-slug">Slug</Label>
            <Input id="post-slug" value={post.slug} readOnly aria-readonly />
            <p className="text-sm text-muted-foreground">
              Slug locked after publish.
            </p>
          </div>
        ) : null}

        <div className="flex items-center gap-2">
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving' : 'Save'}
          </Button>
        </div>
      </form>
    </section>
  );
}
