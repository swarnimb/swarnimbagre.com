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
import { createProject, updateProject } from '@/lib/admin-projects-mutations';
import {
  PROJECT_MUTATION_INITIAL_STATE,
  type ProjectMutationState,
} from '@/lib/admin-projects-mutations-types';
import type { ImageRecord, Project, ProjectStatus } from '@/lib/types';
import ImageUpload from '@/components/admin/ImageUpload';

/** Toast copy on success. CONSTRAINT-13: dry, no SaaS phrasing, no emoji. */
const SAVE_SUCCESS_MESSAGE = 'Saved.';

/** Hardcoded after-save destination — list view for both create and edit. */
const PROJECTS_LIST_PATH = '/admin/projects';

/** Props for {@link ProjectForm}. `project` absent => create mode. */
export interface ProjectFormProps {
  /** Existing project row; absent for create. */
  project?: Project;
  /** Resolved image preview payload for the project's `image_id`. Null when
   * the project has no image, or the image row was orphaned. Page-side
   * loader handles the signed-URL resolution (CONSTRAINT-15). */
  currentImage?: { id: string; signedUrl: string; altText: string } | null;
  /** Optional injected actions — tests override these to avoid Server Action wiring. */
  createAction?: typeof createProject;
  updateAction?: typeof updateProject;
}

/** Read a field error from the action state; '' renders no inline message. */
function fieldError(
  state: ProjectMutationState,
  field: 'title' | 'description' | 'status',
): string {
  return state.fieldErrors?.[field] ?? '';
}

/**
 * Admin create / edit form for a project row. One component, two modes —
 * inferred from the `project` prop. Edit mode renders with the row prefilled
 * and submits `updateProject` with a hidden `id`; the slug input becomes
 * read-only on `status === 'published'` (CONSTRAINT-12; migration 008 is the
 * DB-side guard). On success: sonner toast + push to `/admin/projects`. On
 * error: zod field messages inline; generic form-level message above the form.
 * Six-channel uniformity is enforced by the action wrapper (see
 * `docs/auth-flow.md` §2a).
 */
export default function ProjectForm({
  project,
  currentImage = null,
  createAction = createProject,
  updateAction = updateProject,
}: ProjectFormProps): React.ReactElement {
  const router = useRouter();
  const isEdit = project !== undefined;
  const action = isEdit ? updateAction : createAction;
  const [state, formAction, isPending] = useActionState<
    ProjectMutationState,
    FormData
  >(action, PROJECT_MUTATION_INITIAL_STATE);

  // Status: controlled Select (renders into a portal) mirrored back into the
  // form submission via a hidden input below.
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? 'draft');

  // Image binding. `imageId` mirrors `image_id` after a fresh upload; the
  // hidden `image_id` input carries it back to the server (empty string =>
  // null per backend coercion contract).
  const [imageId, setImageId] = useState<string | null>(currentImage?.id ?? null);
  const [uploadedImage, setUploadedImage] = useState<ImageRecord | null>(null);

  useEffect(() => {
    if (state.status === 'ok') {
      toast.success(SAVE_SUCCESS_MESSAGE);
      router.push(PROJECTS_LIST_PATH);
    }
  }, [state.status, router]);

  const isSlugLocked = project?.status === 'published';

  return (
    <section className="px-6 py-10 space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">
        {isEdit ? 'Edit project' : 'New project'}
      </h1>
      {state.status === 'error' && state.formError ? (
        <p role="alert" className="text-sm text-destructive">
          {state.formError}
        </p>
      ) : null}
      <form action={formAction} className="space-y-6" noValidate>
        {isEdit ? <input type="hidden" name="id" value={project.id} /> : null}
        <input type="hidden" name="status" value={status} />
        <input type="hidden" name="image_id" value={imageId ?? ''} />

        <div className="space-y-2">
          <Label htmlFor="project-title">Title</Label>
          <Input
            id="project-title"
            name="title"
            defaultValue={project?.title ?? ''}
            aria-invalid={Boolean(fieldError(state, 'title'))}
            aria-describedby="project-title-error"
            maxLength={200}
            required
          />
          {fieldError(state, 'title') ? (
            <p id="project-title-error" role="alert" className="text-sm text-destructive">
              {fieldError(state, 'title')}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="project-description">Description</Label>
          <Textarea
            id="project-description"
            name="description"
            defaultValue={project?.description ?? ''}
            aria-invalid={Boolean(fieldError(state, 'description'))}
            aria-describedby="project-description-error"
            rows={6}
            required
          />
          {fieldError(state, 'description') ? (
            <p id="project-description-error" role="alert" className="text-sm text-destructive">
              {fieldError(state, 'description')}
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
              parentType="projects"
              parentId={project.id}
              onUpload={(image) => { setImageId(image.id); setUploadedImage(image); }}
            />
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="project-status">Status</Label>
          <Select
            value={status}
            onValueChange={(value) => setStatus(value as ProjectStatus)}
          >
            <SelectTrigger id="project-status" className="w-48">
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
            <Label htmlFor="project-slug">Slug</Label>
            <Input id="project-slug" value={project.slug} readOnly aria-readonly />
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
