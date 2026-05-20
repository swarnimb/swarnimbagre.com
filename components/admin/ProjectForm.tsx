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
  type ProjectMutationFieldName,
  type ProjectMutationState,
} from '@/lib/admin-projects-mutations-types';
import type { Project, ProjectStatus } from '@/lib/types';
import ProjectFormLinks from '@/components/admin/ProjectFormLinks';
import ProjectFormDisplay from '@/components/admin/ProjectFormDisplay';
import ProjectImageField, {
  type ImagePreview,
} from '@/components/admin/ProjectImageField';

/** Toast copy on success. CONSTRAINT-13: dry, no SaaS phrasing, no emoji. */
const SAVE_SUCCESS_MESSAGE = 'Saved.';

/** Hardcoded after-save destination — list view for both create and edit. */
const PROJECTS_LIST_PATH = '/admin/projects';

/** Title text input cap — mirrors `projects.title` CHECK in migration 001. */
const TITLE_INPUT_MAX_LENGTH = 200;

/** Props for {@link ProjectForm}. `project` absent => create mode. */
export interface ProjectFormProps {
  /** Existing project row; absent for create. */
  project?: Project;
  /** Resolved preview for `project.image_id`. Null when unset/orphaned. */
  currentImage?: ImagePreview | null;
  /** Resolved preview for `project.image_after_id`. Null when unset/orphaned. */
  currentImageAfter?: ImagePreview | null;
  /** Optional injected actions — tests override these to avoid Server Action wiring. */
  createAction?: typeof createProject;
  updateAction?: typeof updateProject;
}

/** Read a field error from the action state; '' renders no inline message. */
function fieldError(
  state: ProjectMutationState,
  field: ProjectMutationFieldName,
): string {
  return state.fieldErrors?.[field] ?? '';
}

/**
 * Admin create / edit form for a project row. One component, two modes —
 * inferred from the `project` prop. T42 splits new fields into three sub-
 * components: `ProjectFormLinks` (3 URLs), `ProjectFormDisplay` (progress +
 * thumb_kind), and two `ProjectImageField` instances (primary + after).
 * Slug is read-only on `status === 'published'` (CONSTRAINT-12; migration
 * 008 is the DB-side guard). Success: toast + push to list. Error: zod
 * field messages inline; generic form-level error above the form.
 */
export default function ProjectForm({
  project,
  currentImage = null,
  currentImageAfter = null,
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

  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? 'draft');

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

        <div className="space-y-2">
          <Label htmlFor="project-title">Title</Label>
          <Input
            id="project-title"
            name="title"
            defaultValue={project?.title ?? ''}
            aria-invalid={Boolean(fieldError(state, 'title'))}
            aria-describedby="project-title-error"
            maxLength={TITLE_INPUT_MAX_LENGTH}
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

        <ProjectFormLinks project={project} state={state} />
        <ProjectFormDisplay project={project} state={state} />

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

        {isEdit ? (
          <ProjectImageField
            parentId={project.id}
            fieldName="image_id"
            label="Image"
            initialPreview={currentImage}
          />
        ) : null}

        {isEdit ? (
          <ProjectImageField
            parentId={project.id}
            fieldName="image_after_id"
            label="After image (before/after slider)"
            initialPreview={currentImageAfter}
          />
        ) : null}

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
