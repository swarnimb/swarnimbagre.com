import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import { GENERIC_FORM_ERROR } from '@/lib/auth-constants';
import { ServiceError } from '@/lib/errors';
import type { ImageRecord } from '@/lib/types';

/**
 * BLOCKING-02 acceptance — the F-39 admin session guard, proved on EVERY
 * admin mutation Server Action rather than on a hand-picked few.
 *
 * `assertAdminSession` is the first statement inside the `try` of all 17
 * admin mutation wrappers. Before this file, only 6 of the 17 had a test
 * proving the guard actually rejects; the other 11 relied on the guard call
 * being visible in the source, which is not evidence. TS-04 requires access
 * control be proved: "verify that protected resources reject unauthorized
 * access. These are non-negotiable."
 *
 * The suite is table-driven on purpose. Each case names one exported action,
 * the throwing helper it must never reach, and the envelope it must resolve
 * with. The `guard coverage table` block at the bottom then compares the
 * table against the modules' real export lists, so adding an 18th action
 * fails this file until somebody decides whether the new action is guarded.
 * A drift-blind suite is how the original 11-action gap stayed invisible.
 *
 * ## Why `lib/auth.ts` is absent
 *
 * `signInWithMagicLink` and `signOut` are Server Actions in the same sense,
 * and they are DELIBERATELY exempt from the guard. Requiring an admin
 * session to sign in is circular — it would lock the single user out of
 * their own site permanently, with no recovery path short of a DB edit. Sign
 * -out is likewise pointless to guard: its only effect on a caller with no
 * session is a no-op. Their protection is the six-channel uniformity
 * contract (rate limiting, uniform timing, uniform envelopes), covered in
 * `tests/auth.test.ts`. They must not be added to the table below.
 *
 * Every case asserts BOTH directions. Asserting only the rejection would
 * pass against an action that is broken in a different way — one that never
 * reaches its helper at all.
 */

vi.mock('@/lib/session', async () => {
  const real = await vi.importActual<typeof import('@/lib/session')>(
    '@/lib/session',
  );
  return { ...real, assertAdminSession: vi.fn() };
});

vi.mock('@/lib/admin-projects-mutations-internal', async () => {
  const real = await vi.importActual<
    typeof import('@/lib/admin-projects-mutations-internal')
  >('@/lib/admin-projects-mutations-internal');
  return {
    ...real,
    createProjectInternal: vi.fn(),
    updateProjectInternal: vi.fn(),
    deleteProjectInternal: vi.fn(),
  };
});

vi.mock('@/lib/admin-posts-mutations-internal', async () => {
  const real = await vi.importActual<
    typeof import('@/lib/admin-posts-mutations-internal')
  >('@/lib/admin-posts-mutations-internal');
  return {
    ...real,
    createPostInternal: vi.fn(),
    updatePostInternal: vi.fn(),
    deletePostInternal: vi.fn(),
  };
});

vi.mock('@/lib/admin-stats-mutations-internal', async () => {
  const real = await vi.importActual<
    typeof import('@/lib/admin-stats-mutations-internal')
  >('@/lib/admin-stats-mutations-internal');
  return {
    ...real,
    insertStatInternal: vi.fn(),
    updateStatInternal: vi.fn(),
    deleteStatInternal: vi.fn(),
  };
});

vi.mock('@/lib/admin-notes-mutations-internal', async () => {
  const real = await vi.importActual<
    typeof import('@/lib/admin-notes-mutations-internal')
  >('@/lib/admin-notes-mutations-internal');
  return {
    ...real,
    createNoteInternal: vi.fn(),
    updateNoteInternal: vi.fn(),
    deleteNoteInternal: vi.fn(),
  };
});

vi.mock('@/lib/admin-images-mutations-internal', async () => {
  const real = await vi.importActual<
    typeof import('@/lib/admin-images-mutations-internal')
  >('@/lib/admin-images-mutations-internal');
  return { ...real, uploadImageInternal: vi.fn() };
});

// `deleteOrphanImages` is the one wrapper whose helper does NOT live in a
// `-internal` sibling: the sweep is in `lib/admin-images-cleanup.ts`, which
// also exports the read-side helpers the /admin/images page uses.
vi.mock('@/lib/admin-images-cleanup', async () => {
  const real = await vi.importActual<
    typeof import('@/lib/admin-images-cleanup')
  >('@/lib/admin-images-cleanup');
  return { ...real, deleteOrphanImagesInternal: vi.fn() };
});

vi.mock('@/lib/admin-project-media-mutations-internal', async () => {
  const real = await vi.importActual<
    typeof import('@/lib/admin-project-media-mutations-internal')
  >('@/lib/admin-project-media-mutations-internal');
  return { ...real, saveProjectMediaInternal: vi.fn() };
});

vi.mock('@/lib/admin-reorder-mutations-internal', async () => {
  const real = await vi.importActual<
    typeof import('@/lib/admin-reorder-mutations-internal')
  >('@/lib/admin-reorder-mutations-internal');
  return { ...real, saveOrderInternal: vi.fn() };
});

const { assertAdminSession } = await import('@/lib/session');

const projectsInternal = await import('@/lib/admin-projects-mutations-internal');
const postsInternal = await import('@/lib/admin-posts-mutations-internal');
const statsInternal = await import('@/lib/admin-stats-mutations-internal');
const notesInternal = await import('@/lib/admin-notes-mutations-internal');
const imagesInternal = await import('@/lib/admin-images-mutations-internal');
const imagesCleanup = await import('@/lib/admin-images-cleanup');
const projectMediaInternal = await import(
  '@/lib/admin-project-media-mutations-internal'
);
const reorderInternal = await import('@/lib/admin-reorder-mutations-internal');

const projectsActions = await import('@/lib/admin-projects-mutations');
const postsActions = await import('@/lib/admin-posts-mutations');
const statsActions = await import('@/lib/admin-stats-mutations');
const notesActions = await import('@/lib/admin-notes-mutations');
const imagesActions = await import('@/lib/admin-images-mutations');
const projectMediaActions = await import('@/lib/admin-project-media-mutations');
const reorderActions = await import('@/lib/admin-reorder-mutations');

/** Module paths, used as the join key between a case and its export list. */
const PROJECTS = 'lib/admin-projects-mutations.ts';
const POSTS = 'lib/admin-posts-mutations.ts';
const STATS = 'lib/admin-stats-mutations.ts';
const NOTES = 'lib/admin-notes-mutations.ts';
const IMAGES = 'lib/admin-images-mutations.ts';
const PROJECT_MEDIA = 'lib/admin-project-media-mutations.ts';
const REORDER = 'lib/admin-reorder-mutations.ts';

/** Syntactically valid UUIDs. Nothing here reaches a validator — the internal
 * helpers are all mocked — but a real-shaped id keeps the cases readable. */
const UUID_A = '00000000-0000-4000-8000-0000000000aa';
const UUID_B = '00000000-0000-4000-8000-0000000000bb';

/** Row `uploadImageInternal` hands back on success, threaded onto the
 * envelope by `uploadImage` (the only action with a success payload besides
 * the orphan sweep). */
const UPLOADED_IMAGE: ImageRecord = {
  id: UUID_A,
  bucket_path: 'projects/example.png',
  alt_text: 'an example image',
  parent_id: null,
  parent_type: null,
  created_at: '2026-08-06T00:00:00.000Z',
};

/** What the mocked orphan sweep reports; `deleteOrphanImages` copies both
 * numbers onto its success envelope. */
const ORPHAN_SWEEP_RESULT = { deleted: 2, freedBytes: 4096 };

function buildFormData(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

/** The upload form's FormData, with a real `File` so the shape matches what
 * the browser sends. The validator behind it is mocked out. */
function buildUploadFormData(): FormData {
  const fd = new FormData();
  fd.set('file', new File([new Uint8Array([1, 2, 3])], 'example.png', {
    type: 'image/png',
  }));
  fd.set('parentType', 'projects');
  fd.set('parentId', UUID_A);
  fd.set('altText', 'an example image');
  return fd;
}

/** The reorder / project-media wire shape: one hidden field of JSON rows. */
function buildRowsFormData(extra: Record<string, string>, rows: unknown): FormData {
  const fd = buildFormData(extra);
  fd.set('rows', JSON.stringify(rows));
  return fd;
}

/**
 * One admin mutation Server Action under the guard.
 *
 * `internal` is the throwing helper the wrapper calls immediately after
 * `assertAdminSession`; a rejected guard must leave it uncalled. `invoke`
 * calls the action with arguments shaped like the real caller's.
 * `okEnvelope` is the exact success envelope — the shapes are NOT uniform
 * across the 17 (`uploadImage` and `deleteOrphanImages` carry payloads), so
 * each case states its own rather than sharing a constant.
 */
interface GuardCase {
  /** Exported Server Action name. */
  readonly action: string;
  /** Module the action is exported from — joins to the export-list check. */
  readonly module: string;
  /** Name of the throwing helper, for readable failure messages. */
  readonly internalName: string;
  /** The mocked throwing helper itself. */
  readonly internal: Mock;
  /** Value the mocked helper resolves with when the guard passes. */
  readonly internalResult: unknown;
  /** Call the action the way its caller does. */
  readonly invoke: () => Promise<unknown>;
  /** Envelope the action must resolve with when the guard passes. */
  readonly okEnvelope: unknown;
}

const OK = { status: 'ok' };

const GUARD_CASES: readonly GuardCase[] = [
  {
    action: 'createProject',
    module: PROJECTS,
    internalName: 'createProjectInternal',
    internal: projectsInternal.createProjectInternal as unknown as Mock,
    internalResult: undefined,
    invoke: () =>
      projectsActions.createProject(
        { status: 'idle' },
        buildFormData({ title: 'T', description: 'D', status: 'draft' }),
      ),
    okEnvelope: OK,
  },
  {
    action: 'updateProject',
    module: PROJECTS,
    internalName: 'updateProjectInternal',
    internal: projectsInternal.updateProjectInternal as unknown as Mock,
    internalResult: undefined,
    invoke: () =>
      projectsActions.updateProject(
        { status: 'idle' },
        buildFormData({
          id: UUID_A,
          title: 'T',
          description: 'D',
          status: 'draft',
        }),
      ),
    okEnvelope: OK,
  },
  {
    action: 'deleteProject',
    module: PROJECTS,
    internalName: 'deleteProjectInternal',
    internal: projectsInternal.deleteProjectInternal as unknown as Mock,
    internalResult: undefined,
    invoke: () => projectsActions.deleteProject(UUID_A),
    okEnvelope: OK,
  },
  {
    action: 'createPost',
    module: POSTS,
    internalName: 'createPostInternal',
    internal: postsInternal.createPostInternal as unknown as Mock,
    internalResult: undefined,
    invoke: () =>
      postsActions.createPost(
        { status: 'idle' },
        buildFormData({ title: 'T', content: 'C', status: 'draft' }),
      ),
    okEnvelope: OK,
  },
  {
    action: 'updatePost',
    module: POSTS,
    internalName: 'updatePostInternal',
    internal: postsInternal.updatePostInternal as unknown as Mock,
    internalResult: undefined,
    invoke: () =>
      postsActions.updatePost(
        { status: 'idle' },
        buildFormData({
          id: UUID_A,
          title: 'T',
          content: 'C',
          status: 'draft',
          image_id: '',
        }),
      ),
    okEnvelope: OK,
  },
  {
    action: 'deletePost',
    module: POSTS,
    internalName: 'deletePostInternal',
    internal: postsInternal.deletePostInternal as unknown as Mock,
    internalResult: undefined,
    invoke: () => postsActions.deletePost(UUID_A),
    okEnvelope: OK,
  },
  {
    action: 'insertStat',
    module: STATS,
    internalName: 'insertStatInternal',
    internal: statsInternal.insertStatInternal as unknown as Mock,
    internalResult: undefined,
    invoke: () =>
      statsActions.insertStat(
        { status: 'idle' },
        buildFormData({
          category: 'reading',
          label: 'Books',
          value: '12',
          unit: '',
          aside: '',
          sort_order: '',
        }),
      ),
    okEnvelope: OK,
  },
  {
    action: 'updateStat',
    module: STATS,
    internalName: 'updateStatInternal',
    internal: statsInternal.updateStatInternal as unknown as Mock,
    internalResult: undefined,
    invoke: () =>
      statsActions.updateStat(
        { status: 'idle' },
        buildFormData({
          id: UUID_A,
          category: 'reading',
          label: 'Books',
          value: '12',
          unit: '',
          aside: '',
          sort_order: '',
        }),
      ),
    okEnvelope: OK,
  },
  {
    action: 'deleteStat',
    module: STATS,
    internalName: 'deleteStatInternal',
    internal: statsInternal.deleteStatInternal as unknown as Mock,
    internalResult: undefined,
    invoke: () => statsActions.deleteStat(UUID_A),
    okEnvelope: OK,
  },
  {
    action: 'createNote',
    module: NOTES,
    internalName: 'createNoteInternal',
    internal: notesInternal.createNoteInternal as unknown as Mock,
    internalResult: undefined,
    invoke: () =>
      notesActions.createNote(
        { status: 'idle' },
        buildFormData({ kicker: 'K', line: 'L', sort_order: '' }),
      ),
    okEnvelope: OK,
  },
  {
    action: 'updateNote',
    module: NOTES,
    internalName: 'updateNoteInternal',
    internal: notesInternal.updateNoteInternal as unknown as Mock,
    internalResult: undefined,
    invoke: () =>
      notesActions.updateNote(
        { status: 'idle' },
        buildFormData({ id: UUID_A, kicker: 'K', line: 'L', sort_order: '' }),
      ),
    okEnvelope: OK,
  },
  {
    action: 'deleteNote',
    module: NOTES,
    internalName: 'deleteNoteInternal',
    internal: notesInternal.deleteNoteInternal as unknown as Mock,
    internalResult: undefined,
    invoke: () => notesActions.deleteNote(UUID_A),
    okEnvelope: OK,
  },
  {
    action: 'uploadImage',
    module: IMAGES,
    internalName: 'uploadImageInternal',
    internal: imagesInternal.uploadImageInternal as unknown as Mock,
    internalResult: UPLOADED_IMAGE,
    invoke: () =>
      imagesActions.uploadImage({ status: 'idle' }, buildUploadFormData()),
    // Deviates from the shared `{ status: 'ok' }`: the upload envelope
    // carries the inserted row so the form can call `onUpload(image)`.
    okEnvelope: { status: 'ok', image: UPLOADED_IMAGE },
  },
  {
    action: 'deleteOrphanImages',
    module: IMAGES,
    internalName: 'deleteOrphanImagesInternal',
    internal: imagesCleanup.deleteOrphanImagesInternal as unknown as Mock,
    internalResult: ORPHAN_SWEEP_RESULT,
    // The one action taking no arguments — the cutoff is wall-clock and the
    // orphan predicate is fixed, so there is nothing for a caller to pass.
    invoke: () => imagesActions.deleteOrphanImages(),
    okEnvelope: {
      status: 'ok',
      deleted: ORPHAN_SWEEP_RESULT.deleted,
      freedBytes: ORPHAN_SWEEP_RESULT.freedBytes,
    },
  },
  {
    action: 'saveProjectMedia',
    module: PROJECT_MEDIA,
    internalName: 'saveProjectMediaInternal',
    internal: projectMediaInternal.saveProjectMediaInternal as unknown as Mock,
    internalResult: undefined,
    invoke: () =>
      projectMediaActions.saveProjectMedia(
        { status: 'idle' },
        buildRowsFormData({ project_id: UUID_A }, [
          { image_id: UUID_B, image_after_id: null, caption: 'a slide' },
        ]),
      ),
    okEnvelope: OK,
  },
  {
    action: 'saveProjectOrder',
    module: REORDER,
    internalName: 'saveOrderInternal',
    internal: reorderInternal.saveOrderInternal as unknown as Mock,
    internalResult: undefined,
    invoke: () =>
      reorderActions.saveProjectOrder(
        { status: 'idle' },
        buildRowsFormData({}, [{ id: UUID_A }, { id: UUID_B }]),
      ),
    okEnvelope: OK,
  },
  {
    action: 'savePostOrder',
    module: REORDER,
    internalName: 'saveOrderInternal',
    internal: reorderInternal.saveOrderInternal as unknown as Mock,
    internalResult: undefined,
    invoke: () =>
      reorderActions.savePostOrder(
        { status: 'idle' },
        buildRowsFormData({}, [{ id: UUID_A }]),
      ),
    okEnvelope: OK,
  },
];

beforeEach(() => {
  // Fake timers so each case fast-forwards past the MIN_DURATION_MS floor
  // instead of burning 750ms of real time per assertion. The floor itself is
  // covered by the per-resource timing tests.
  vi.useFakeTimers({ toFake: ['setTimeout', 'performance'] });
  // Default: the caller holds an admin session. The rejection case overrides.
  vi.mocked(assertAdminSession).mockResolvedValue(undefined);
  for (const testCase of GUARD_CASES) {
    testCase.internal.mockResolvedValue(testCase.internalResult);
  }
});

afterEach(() => {
  vi.resetAllMocks();
  vi.useRealTimers();
});

/**
 * Run an action past the timing floor and hand back its resolved envelope.
 * The wrapper's `finally` awaits `padToFloor`, so the promise does not settle
 * until the fake clock has moved past `MIN_DURATION_MS` (750).
 */
async function resolvePastTimingFloor(invoke: () => Promise<unknown>) {
  const pending = invoke();
  await vi.advanceTimersByTimeAsync(1000);
  return pending;
}

describe('admin mutation Server Actions — assertAdminSession guard', () => {
  for (const testCase of GUARD_CASES) {
    describe(testCase.action, () => {
      it(`${testCase.action} resolves the uniform error envelope and never calls ${testCase.internalName} when assertAdminSession rejects`, async () => {
        vi.mocked(assertAdminSession).mockRejectedValue(
          new ServiceError('no admin session', {
            operation: 'assertAdminSession',
          }),
        );

        const result = await resolvePastTimingFloor(testCase.invoke);

        // Byte-identical to any other failure: a rejected guard must not be
        // distinguishable from a DB error through the response body.
        expect(result).toEqual({
          status: 'error',
          formError: GENERIC_FORM_ERROR,
        });
        expect(testCase.internal).not.toHaveBeenCalled();
      });

      it(`${testCase.action} calls ${testCase.internalName} and resolves the success envelope when assertAdminSession resolves`, async () => {
        const result = await resolvePastTimingFloor(testCase.invoke);

        expect(testCase.internal).toHaveBeenCalledTimes(1);
        expect(result).toEqual(testCase.okEnvelope);
      });
    });
  }
});

/**
 * Drift guard. The rejection tests above only prove the actions the table
 * lists, so the table itself has to be checked against reality — otherwise a
 * new unguarded action ships green, which is exactly how the 11-action gap
 * this file closes went unnoticed.
 *
 * Each `'use server'` module's export surface IS its Server Action surface
 * (SEC-09): Next.js promotes every export to a publicly-addressable action
 * ID. So an export not in the table is an unproven endpoint.
 */
describe('guard coverage table', () => {
  const ACTION_MODULES: ReadonlyArray<{
    path: string;
    exports: Record<string, unknown>;
  }> = [
    { path: PROJECTS, exports: projectsActions },
    { path: POSTS, exports: postsActions },
    { path: STATS, exports: statsActions },
    { path: NOTES, exports: notesActions },
    { path: IMAGES, exports: imagesActions },
    { path: PROJECT_MEDIA, exports: projectMediaActions },
    { path: REORDER, exports: reorderActions },
  ];

  for (const actionModule of ACTION_MODULES) {
    it(`the table covers every Server Action exported by ${actionModule.path}`, () => {
      const covered = GUARD_CASES.filter(
        (testCase) => testCase.module === actionModule.path,
      ).map((testCase) => testCase.action);
      expect([...new Set(covered)].sort()).toEqual(
        Object.keys(actionModule.exports).sort(),
      );
    });
  }

  it('the table holds seventeen actions across seven modules', () => {
    // Fails when a whole new `'use server'` mutation module appears and is
    // not registered above. Update both numbers deliberately, not reflexively.
    expect(GUARD_CASES).toHaveLength(17);
    expect(ACTION_MODULES).toHaveLength(7);
  });
});
