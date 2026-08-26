'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ProjectMutationState } from '@/lib/admin-projects-mutations-types';
import type { Project } from '@/lib/types';

/**
 * Maximum URL length surfaced as a hint on the <input> elements. Mirrors
 * the server-side cap in `lib/admin-projects-mutations-internal.ts`
 * (`URL_MAX_LENGTH`). Keep in sync if either side changes.
 */
const URL_INPUT_MAX_LENGTH = 2048;

/** Props for {@link ProjectFormLinks}. */
export interface ProjectFormLinksProps {
  /** Existing project row; absent for create mode. */
  project?: Project;
  /** Live state from `useActionState`. Used to read per-field zod errors. */
  state: ProjectMutationState;
}

/**
 * Three nullable URL inputs for the project's external/internal links.
 * Split out of `ProjectForm.tsx` to keep that file under CQ-02 (200-line
 * component cap). Each input renders an inline error when zod rejected
 * that specific field on the previous submit attempt.
 *
 * Validation lives at the server boundary (`projectCreateSchema` and
 * `projectUpdateSchema`); the form sets `noValidate` so the browser does
 * not pre-empt those messages with its own.
 */
export default function ProjectFormLinks({
  project,
  state,
}: ProjectFormLinksProps): React.ReactElement {
  const githubUrlError = state.fieldErrors?.github_url ?? '';
  const liveUrlError = state.fieldErrors?.live_url ?? '';

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="project-github-url">GitHub URL</Label>
        <Input
          id="project-github-url"
          name="github_url"
          type="url"
          defaultValue={project?.github_url ?? ''}
          aria-invalid={Boolean(githubUrlError)}
          aria-describedby="project-github-url-error"
          maxLength={URL_INPUT_MAX_LENGTH}
          placeholder="https://github.com/..."
        />
        {githubUrlError ? (
          <p id="project-github-url-error" role="alert" className="text-sm text-destructive">
            {githubUrlError}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="project-live-url">Live URL</Label>
        <Input
          id="project-live-url"
          name="live_url"
          type="url"
          defaultValue={project?.live_url ?? ''}
          aria-invalid={Boolean(liveUrlError)}
          aria-describedby="project-live-url-error"
          maxLength={URL_INPUT_MAX_LENGTH}
          placeholder="https://..."
        />
        {liveUrlError ? (
          <p id="project-live-url-error" role="alert" className="text-sm text-destructive">
            {liveUrlError}
          </p>
        ) : null}
      </div>

    </>
  );
}
