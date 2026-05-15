import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import {
  projectCreateSchema,
  projectUpdateSchema,
} from '@/lib/admin-projects-mutations-internal';
import {
  postCreateSchema,
  postUpdateSchema,
} from '@/lib/admin-posts-mutations-internal';
import { statInsertSchema } from '@/lib/admin-stats-mutations-internal';
import { uploadImageSchema } from '@/lib/admin-images-mutations-internal';
import { deleteOrphanImages } from '@/lib/admin-images-mutations';

/**
 * Omnibus regression guard for F-26 (zod `.strict()` defense-in-depth on the
 * admin mutation surface).
 *
 * Every Zod schema on the admin write boundary has `.strict()` appended so the
 * parser throws a `ZodError` with the `unrecognized_keys` issue code on any
 * input field whose name is not declared in the schema. This file asserts that
 * behavior holds for all six write-boundary schemas in lock-step. If a future
 * change removes `.strict()` from any of them, the matching test fails loudly
 * — that is the regression guard.
 *
 * See `docs/founder-brief.md` (entry "Zod `.strict()` adopted across the admin
 * mutation surface (F-26 closure)") and `docs/security-report.md` F-26 for the
 * narrative behind this discipline. The runtime is byte-identical for users
 * today — admin Server Action wrappers read FormData via explicit per-key
 * `formData.get(...)` calls so unknown keys never reach the schemas. Strict
 * mode is the depth-of-defense layer that closes the boundary for any future
 * refactor that switches to `Object.fromEntries(formData.entries())`.
 *
 * Each case constructs a payload that satisfies all required fields with valid
 * values, adds one unknown key (`extra: 'should-fail'`), parses, and asserts
 * the resulting `ZodError` carries at least one `unrecognized_keys` issue.
 */

/** Asserts the thrown error is a ZodError with at least one
 * `unrecognized_keys` issue. Centralised so each case stays focused on its
 * payload shape, not error inspection. */
function expectUnrecognizedKeys(parse: () => unknown): void {
  expect(parse).toThrow(ZodError);
  try {
    parse();
  } catch (err) {
    expect(err).toBeInstanceOf(ZodError);
    const zodErr = err as ZodError;
    const hasUnrecognizedKeys = zodErr.issues.some(
      (issue) => issue.code === 'unrecognized_keys',
    );
    expect(hasUnrecognizedKeys).toBe(true);
  }
}

describe('admin mutation schemas — .strict() defense-in-depth (F-26)', () => {
  it('projectCreateSchema rejects unknown keys via .strict()', () => {
    const payload = {
      title: 'Valid title',
      description: 'Valid description',
      status: 'draft',
      extra: 'should-fail',
    };
    expectUnrecognizedKeys(() => projectCreateSchema.parse(payload));
  });

  it('projectUpdateSchema rejects unknown keys via .strict()', () => {
    const payload = {
      title: 'Valid title',
      description: 'Valid description',
      status: 'draft',
      image_id: null,
      extra: 'should-fail',
    };
    expectUnrecognizedKeys(() => projectUpdateSchema.parse(payload));
  });

  it('postCreateSchema rejects unknown keys via .strict()', () => {
    const payload = {
      title: 'Valid title',
      content: 'Valid content',
      status: 'draft',
      extra: 'should-fail',
    };
    expectUnrecognizedKeys(() => postCreateSchema.parse(payload));
  });

  it('postUpdateSchema rejects unknown keys via .strict()', () => {
    const payload = {
      title: 'Valid title',
      content: 'Valid content',
      status: 'draft',
      image_id: null,
      extra: 'should-fail',
    };
    expectUnrecognizedKeys(() => postUpdateSchema.parse(payload));
  });

  it('statInsertSchema rejects unknown keys via .strict()', () => {
    const payload = {
      category: 'fitness',
      label: 'pushups',
      value: '50',
      unit: 'reps',
      extra: 'should-fail',
    };
    expectUnrecognizedKeys(() => statInsertSchema.parse(payload));
  });

  it('uploadImageSchema rejects unknown keys via .strict()', () => {
    const payload = {
      parentType: 'projects',
      parentId: '00000000-0000-4000-8000-000000000000',
      altText: 'Valid alt text',
      extra: 'should-fail',
    };
    expectUnrecognizedKeys(() => uploadImageSchema.parse(payload));
  });

  /**
   * `deleteOrphanImages` (T27) takes no inputs — there is no zod schema to
   * append `.strict()` to. The empty-input contract is enforced by the
   * action's TypeScript signature (`(): Promise<OrphanCleanupState>`); this
   * test asserts the runtime function arity is 0 so a future refactor that
   * smuggles in an `unknown` arg (then forgets to validate it) breaks the
   * suite. This is the F-26 analogue for an arg-less action — the boundary
   * is "no input is accepted at all", and arity is its observable invariant.
   */
  it('deleteOrphanImages enforces an empty-input contract (no args)', () => {
    expect(deleteOrphanImages.length).toBe(0);
  });
});
