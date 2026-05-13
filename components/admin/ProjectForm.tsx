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
import { createProject, updateProject } from '@/lib/admin-mutations';
import {
  PROJECT_MUTATION_INITIAL_STATE,
  type ProjectMutationState,
} from '@/lib/admin-mutations-types';
import type { Project, ProjectStatus } from '@/lib/types';

/** Toast copy on success. CONSTRAINT-13: dry, no SaaS phrasing, no emoji. */
const SAVE_SUCCESS_MESSAGE = 'Saved.';

/** Hardcoded after-save destination — list view for both create and edit. */
const PROJECTS_LIST_PATH = '/admin/projects';

/**
 * Props for {@link ProjectForm}. `project` is omitted on the create screen
 * and present on the edit screen.
 */
export interface ProjectFormProps {
  /** Existing project row; absent for create. */
  project?: Project;
  /** Optional injected action — tests override these to avoid Server Action wiring. */
  createAction?: typeof createProject;
  /** Optional injected action — tests override these to avoid Server Action wiring. */
  updateAction?: typeof updateProject;
}

/**
 * Read a field error from the action state, defaulting to empty string for
 * the inline `<p role="alert">` slot below each input.
 */
function fieldError(
  state: ProjectMutationState,
  field: 'title' | 'description' | 'status',
): string {
  return state.fieldErrors?.[field] ?? '';
}

/**
 * Admin create / edit form for a project row.
 *
 * One component, two modes. Mode is inferred from the `project` prop:
 *
 * - **No `project`** → render the create form; submit calls `createProject`
 *   (the Server Action from `lib/admin-mutations.ts`).
 * - **`project` present** → render the edit form prefilled from `project`;
 *   submit calls `updateProject` with a hidden `id` field. The slug input
 *   becomes read-only when `project.status === 'published'` to reflect
 *   CONSTRAINT-12 (the migration 008 trigger is the DB-side guard).
 *
 * On a successful action resolution (`state.status === 'ok'`), the form
 * surfaces a sonner toast and pushes the user to `/admin/projects`. On
 * error, field-level zod messages render inline under each input, and a
 * form-level generic message renders above the form for any non-validation
 * failure. The action wrapper enforces six-channel uniformity for the
 * non-validation paths (`docs/auth-flow.md` §2a).
 *
 * @param props See {@link ProjectFormProps}.
 * @returns React element rendering the project form.
 */
export default function ProjectForm({
  project,
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

  // Local state for the controlled `status` Select (FormData needs a name; the
  // shadcn Select renders into a portal so a hidden input mirrors the value
  // back into the form submission).
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? 'draft');

  // On success: toast + redirect. Effect rather than render-time side-effect
  // because `router.push` is forbidden during render.
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
