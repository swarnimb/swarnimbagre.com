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
import type { ImageRecord, Post, PostStatus } from '@/lib/types';
import ImageUpload from '@/components/admin/ImageUpload';

/** Toast copy on success. CONSTRAINT-13: dry, no SaaS phrasing, no emoji. */
const SAVE_SUCCESS_MESSAGE = 'Saved.';

/** Hardcoded after-save destination — list view for both create and edit. */
const POSTS_LIST_PATH = '/admin/posts';

/** Props for {@link PostForm}. `post` absent => create mode. */
export interface PostFormProps {
  /** Existing post row; absent for create. */
  post?: Post;
  /** Resolved image preview payload for the post's `image_id`. Null when the
   * post has no image, or the image row was orphaned. Page-side loader
   * handles the signed-URL resolution (CONSTRAINT-15). */
  currentImage?: { id: string; signedUrl: string; altText: string } | null;
  /** Optional injected actions — tests override these to avoid Server Action wiring. */
  createAction?: typeof createPost;
  updateAction?: typeof updatePost;
}

/** Read a field error from the action state; '' renders no inline message. */
function fieldError(
  state: PostMutationState,
  field: 'title' | 'content' | 'status',
): string {
  return state.fieldErrors?.[field] ?? '';
}

/**
 * Admin create / edit form for a post row. One component, two modes —
 * inferred from the `post` prop. Edit mode renders with the row prefilled
 * and submits `updatePost` with a hidden `id`; the slug input becomes
 * read-only on `status === 'published'` (CONSTRAINT-12; migration 006 trigger
 * `posts_prevent_slug_change` is the DB-side guard). `content` is a plain
 * Textarea storing raw Markdown (CONSTRAINT-06) — the T12 client renderer
 * handles read-time rendering and sanitization. On success: sonner toast +
 * push to `/admin/posts`. On error: zod field messages inline; generic
 * form-level message above the form. Six-channel uniformity is enforced by
 * the action wrapper (see `docs/auth-flow.md` §2a).
 */
export default function PostForm({
  post,
  currentImage = null,
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

  // Status: controlled Select (renders into a portal) mirrored back into the
  // form submission via a hidden input below.
  const [status, setStatus] = useState<PostStatus>(post?.status ?? 'draft');

  // Image binding. `imageId` mirrors `image_id` after a fresh upload; the
  // hidden `image_id` input carries it back to the server (empty string =>
  // null per backend coercion contract).
  const [imageId, setImageId] = useState<string | null>(currentImage?.id ?? null);
  const [uploadedImage, setUploadedImage] = useState<ImageRecord | null>(null);

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
        <input type="hidden" name="image_id" value={imageId ?? ''} />

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

        {isEdit ? (
          <div className="space-y-3">
            <Label>Image</Label>
            {imageId !== null && currentImage !== null && uploadedImage === null ? (
              <img src={currentImage.signedUrl} alt={currentImage.altText} className="max-w-xs border border-border" />
            ) : null}
            {uploadedImage !== null ? (
              <p className="text-sm text-muted-foreground">New image saved. Preview refreshes after save.</p>
            ) : null}
            <ImageUpload
              parentType="posts"
              parentId={post.id}
              onUpload={(image) => { setImageId(image.id); setUploadedImage(image); }}
            />
          </div>
        ) : null}

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
