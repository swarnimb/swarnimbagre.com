import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import {
  projectMediaRowSchema,
  projectMediaSaveSchema,
  PROJECT_MEDIA_MAX_ROWS,
  PROJECT_MEDIA_CAPTION_MAX_LENGTH,
} from '@/lib/admin-project-media-mutations-schemas';

/**
 * T43.E acceptance — pure schema tests for `projectMediaRowSchema` and
 * `projectMediaSaveSchema`.
 *
 * These tests exercise the validation boundary in isolation: no Supabase
 * stub, no DI client. The orchestrator-level behavior (RPC dispatch,
 * envelope shape) is covered in `tests/admin-project-media-mutations.test.ts`.
 * Splitting per CQ-03 so each suite focuses on a single concern.
 */

/** Sample valid UUID v4 reused across row-level cases. */
const VALID_UUID_A = '00000000-0000-4000-8000-0000000000aa';
/** Second valid UUID, used to assert the image_after_id swap path. */
const VALID_UUID_B = '00000000-0000-4000-8000-0000000000bb';
/** Valid UUID v4 reused for the project_id field across top-level cases. */
const VALID_PROJECT_UUID = '00000000-0000-4000-8000-000000000099';

describe('projectMediaRowSchema', () => {
  it('accepts a minimal valid row (image_after_id + caption null)', () => {
    const input = {
      image_id: VALID_UUID_A,
      image_after_id: null,
      caption: null,
    };
    expect(() => projectMediaRowSchema.parse(input)).not.toThrow();
  });

  it('accepts a full valid row (before/after pair + caption)', () => {
    const input = {
      image_id: VALID_UUID_A,
      image_after_id: VALID_UUID_B,
      caption: 'before and after the refactor',
    };
    expect(() => projectMediaRowSchema.parse(input)).not.toThrow();
  });

  it('rejects when image_id is not a valid uuid', () => {
    const input = {
      image_id: 'not-a-uuid',
      image_after_id: null,
      caption: null,
    };
    expect(() => projectMediaRowSchema.parse(input)).toThrow(ZodError);
  });

  it('rejects when image_after_id is not a valid uuid', () => {
    const input = {
      image_id: VALID_UUID_A,
      image_after_id: 'not-a-uuid',
      caption: null,
    };
    expect(() => projectMediaRowSchema.parse(input)).toThrow(ZodError);
  });

  it('rejects when image_after_id equals image_id (DB CHECK mirror)', () => {
    const input = {
      image_id: VALID_UUID_A,
      image_after_id: VALID_UUID_A,
      caption: null,
    };
    expect(() => projectMediaRowSchema.parse(input)).toThrow(ZodError);
  });

  it(`rejects caption longer than ${PROJECT_MEDIA_CAPTION_MAX_LENGTH} chars`, () => {
    const input = {
      image_id: VALID_UUID_A,
      image_after_id: null,
      caption: 'x'.repeat(PROJECT_MEDIA_CAPTION_MAX_LENGTH + 1),
    };
    expect(() => projectMediaRowSchema.parse(input)).toThrow(ZodError);
  });

  it(`accepts caption at exactly ${PROJECT_MEDIA_CAPTION_MAX_LENGTH} chars`, () => {
    const input = {
      image_id: VALID_UUID_A,
      image_after_id: null,
      caption: 'x'.repeat(PROJECT_MEDIA_CAPTION_MAX_LENGTH),
    };
    expect(() => projectMediaRowSchema.parse(input)).not.toThrow();
  });

  it('rejects extra keys in strict mode (e.g., legacy order_index)', () => {
    const input = {
      image_id: VALID_UUID_A,
      image_after_id: null,
      caption: null,
      // order_index would have been on the legacy payload before @supabase
      // routed it to with-ordinality derivation in the RPC.
      order_index: 0,
    };
    expect(() => projectMediaRowSchema.parse(input)).toThrow(ZodError);
  });

  it('rejects a row missing image_id', () => {
    const input = {
      image_after_id: null,
      caption: null,
    };
    expect(() => projectMediaRowSchema.parse(input)).toThrow(ZodError);
  });
});

describe('projectMediaSaveSchema', () => {
  it('accepts an empty rows array (clear-all semantics)', () => {
    const input = {
      project_id: VALID_PROJECT_UUID,
      rows: [],
    };
    expect(() => projectMediaSaveSchema.parse(input)).not.toThrow();
  });

  it('accepts a payload at the max row count', () => {
    const input = {
      project_id: VALID_PROJECT_UUID,
      rows: Array.from({ length: PROJECT_MEDIA_MAX_ROWS }, (_, i) => ({
        image_id: VALID_UUID_A,
        image_after_id: null,
        caption: `slide ${i}`,
      })),
    };
    expect(() => projectMediaSaveSchema.parse(input)).not.toThrow();
  });

  it(`rejects more than ${PROJECT_MEDIA_MAX_ROWS} rows`, () => {
    const input = {
      project_id: VALID_PROJECT_UUID,
      rows: Array.from({ length: PROJECT_MEDIA_MAX_ROWS + 1 }, () => ({
        image_id: VALID_UUID_A,
        image_after_id: null,
        caption: null,
      })),
    };
    expect(() => projectMediaSaveSchema.parse(input)).toThrow(ZodError);
  });

  it('rejects when project_id is not a uuid', () => {
    const input = {
      project_id: 'not-a-uuid',
      rows: [],
    };
    expect(() => projectMediaSaveSchema.parse(input)).toThrow(ZodError);
  });

  it('rejects extra top-level keys in strict mode', () => {
    const input = {
      project_id: VALID_PROJECT_UUID,
      rows: [],
      evil: 'inject',
    };
    expect(() => projectMediaSaveSchema.parse(input)).toThrow(ZodError);
  });

  it('reports a per-row path (rows.N.field) when a row is invalid', () => {
    const input = {
      project_id: VALID_PROJECT_UUID,
      rows: [
        { image_id: VALID_UUID_A, image_after_id: null, caption: null },
        { image_id: 'not-a-uuid', image_after_id: null, caption: null },
      ],
    };
    const result = projectMediaSaveSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('rows.1.image_id');
    }
  });
});
