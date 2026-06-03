import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ProjectForm from '@/components/admin/ProjectForm';
import type { Project } from '@/lib/types';

/**
 * Radix Select (used by the "Linked writeup" picker) calls these DOM methods
 * that jsdom does not implement. Polyfill them locally so opening the dropdown
 * does not throw. Scoped to this file — the shared `tests/setup.ts` is left
 * untouched so the full-suite run the operator triggers is unaffected.
 */
beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
});

/**
 * T21 acceptance — UI: `ProjectForm shows error inline on mutation failure`.
 *
 * The form uses `useActionState`, which under jsdom resolves the prop-injected
 * action and exposes its returned state via the `state` slot. Tests inject a
 * fake action that resolves with the desired state envelope, then assert the
 * DOM reflects it.
 */

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const PUBLISHED_PROJECT: Project = {
  id: 'p-pub',
  title: 'OpenClaw',
  slug: 'openclaw',
  description: 'shipped',
  status: 'published',
  image_id: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-02T00:00:00.000Z',
  github_url: null,
  live_url: null,
  post_url: null,
  progress_percent: null,
  thumb_kind: null,
  image_after_id: null,
  post_id: null,
};

const DRAFT_PROJECT: Project = {
  id: 'p-draft',
  title: 'Work in progress',
  slug: 'work-in-progress',
  description: 'still thinking',
  status: 'draft',
  image_id: null,
  created_at: '2026-04-01T00:00:00.000Z',
  updated_at: '2026-04-01T00:00:00.000Z',
  github_url: null,
  live_url: null,
  post_url: null,
  progress_percent: null,
  thumb_kind: null,
  image_after_id: null,
  post_id: null,
};

/** Published posts offered by the "Linked writeup" picker (T45.B). */
const PICKER_POSTS = [
  { id: 'post-a', title: 'Aardvarks' },
  { id: 'post-b', title: 'Beavers' },
];

/** Draft project already linked to `post-b` — exercises edit-mode prefill. */
const LINKED_PROJECT: Project = {
  ...DRAFT_PROJECT,
  id: 'p-linked',
  post_id: 'post-b',
};

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

/** Submit the form by dispatching submit on the underlying <form> element. */
async function submitForm(): Promise<void> {
  const form = document.querySelector('form') as HTMLFormElement;
  await act(async () => {
    fireEvent.submit(form);
  });
}

describe('ProjectForm — error surfacing', () => {
  it('renders the form-level error message when the action returns formError', async () => {
    const createAction = vi.fn().mockResolvedValue({
      status: 'error',
      formError: 'Could not save. Try again.',
    });
    const updateAction = vi.fn();

    render(
      <ProjectForm createAction={createAction} updateAction={updateAction} />,
    );

    // Fill title + description so the form passes browser-level required checks.
    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Whatever' },
    });
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'Body' },
    });
    await submitForm();

    await waitFor(() => {
      expect(
        screen.getByText('Could not save. Try again.'),
      ).toBeInTheDocument();
    });
    expect(createAction).toHaveBeenCalledTimes(1);
  });

  it('renders the field-level error message when the action returns fieldErrors', async () => {
    const createAction = vi.fn().mockResolvedValue({
      status: 'error',
      fieldErrors: { title: 'title is required' },
    });
    const updateAction = vi.fn();

    render(
      <ProjectForm createAction={createAction} updateAction={updateAction} />,
    );

    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'Body' },
    });
    await submitForm();

    await waitFor(() => {
      expect(screen.getByText('title is required')).toBeInTheDocument();
    });
  });
});

describe('ProjectForm — slug-lock UX on published edit', () => {
  it('renders the slug field as read-only with the lock copy when project is published', () => {
    const createAction = vi.fn();
    const updateAction = vi.fn();

    render(
      <ProjectForm
        project={PUBLISHED_PROJECT}
        createAction={createAction}
        updateAction={updateAction}
      />,
    );

    const slugInput = screen.getByLabelText('Slug') as HTMLInputElement;
    expect(slugInput.readOnly).toBe(true);
    expect(slugInput.value).toBe(PUBLISHED_PROJECT.slug);
    expect(
      screen.getByText(/locked after publish/i),
    ).toBeInTheDocument();
  });

  it('does NOT render the slug field on a draft edit (slug is derived server-side)', () => {
    const createAction = vi.fn();
    const updateAction = vi.fn();

    render(
      <ProjectForm
        project={DRAFT_PROJECT}
        createAction={createAction}
        updateAction={updateAction}
      />,
    );

    expect(screen.queryByLabelText('Slug')).not.toBeInTheDocument();
  });
});

describe('ProjectForm — linked-writeup picker (T45.B)', () => {
  it('renders the linked-writeup options (plus an Unset choice) and prefills the current post_id on edit', async () => {
    const createAction = vi.fn();
    const updateAction = vi.fn();

    render(
      <ProjectForm
        project={LINKED_PROJECT}
        posts={PICKER_POSTS}
        createAction={createAction}
        updateAction={updateAction}
      />,
    );

    // Prefill: the hidden input that participates in FormData carries the
    // existing post_id, and the trigger shows that post's title.
    const hidden = document.querySelector(
      'input[name="post_id"]',
    ) as HTMLInputElement;
    expect(hidden.value).toBe('post-b');
    const trigger = screen.getByLabelText('Linked writeup');
    expect(trigger).toHaveTextContent('Beavers');

    // Open the dropdown and assert it renders the passed posts + an Unset option.
    fireEvent.click(trigger);
    await waitFor(() => {
      expect(
        screen.getByRole('option', { name: 'Unset' }),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole('option', { name: 'Aardvarks' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Beavers' })).toBeInTheDocument();
  });
});
