import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import {
  projectCreateSchema,
  projectUpdateSchema,
  SUBTITLE_MAX_LENGTH,
  TAGS_MAX_COUNT,
  TAG_MAX_LENGTH,
  URL_MAX_LENGTH,
} from '@/lib/admin-projects-mutations-schemas';

/**
 * T42 acceptance — pure schema tests for `projectCreateSchema` /
 * `projectUpdateSchema`.
 *
 * These tests exercise the validation boundary in isolation: no Supabase
 * stub, no DI client, no slug derivation. The orchestrator-level behavior
 * (insert payload shape, orphan-on-swap, slug-lock) is covered in the
 * sibling file `admin-projects-mutations.test.ts`. Splitting per CQ-03 so
 * each suite focuses on a single concern.
 *
 * `httpsUrlSchema`, `postUrlSchema`, `subtitleSchema`, `tagsSchema`, and the
 * `progress_percent` fragment are shared between create and update — when
 * a fragment is exercised on the create side, the update side reuses it
 * transitively, so create-side coverage is the canonical case set and
 * update-side tests cover only what is distinct (the two image FKs).
 */

/** Sample valid UUID v4 reused across update-side cases. */
const VALID_UUID_A = '00000000-0000-4000-8000-0000000000aa';
/** Second valid UUID, used to assert the image_after_id swap path. */
const VALID_UUID_B = '00000000-0000-4000-8000-0000000000bb';

describe('projectCreateSchema', () => {
  it('accepts a minimal valid payload with all new fields null', () => {
    const input = {
      title: 'New Thing',
      description: 'first cut',
      status: 'draft' as const,
      github_url: null,
      live_url: null,
      subtitle: null,
      tags: null,
      post_id: null,
    };
    expect(() => projectCreateSchema.parse(input)).not.toThrow();
  });

  it('accepts a full valid payload with all new fields set', () => {
    const input = {
      title: 'Full Thing',
      description: 'all fields populated',
      status: 'published' as const,
      github_url: 'https://example.com',
      live_url: 'https://example.com/live',
      subtitle: 'one short line',
      tags: ['next', 'supabase'],
      post_id: null,
    };
    expect(() => projectCreateSchema.parse(input)).not.toThrow();
  });

  it('rejects github_url that is not https', () => {
    const input = {
      title: 'Thing',
      description: 'desc',
      status: 'draft' as const,
      github_url: 'http://example.com',
      live_url: null,
      subtitle: null,
      tags: null,
    };
    expect(() => projectCreateSchema.parse(input)).toThrow(ZodError);
  });

  it('rejects live_url that is not https', () => {
    const input = {
      title: 'Thing',
      description: 'desc',
      status: 'draft' as const,
      github_url: null,
      live_url: 'http://example.com',
      subtitle: null,
      tags: null,
    };
    expect(() => projectCreateSchema.parse(input)).toThrow(ZodError);
  });

  it('rejects a subtitle longer than the CHECK ceiling', () => {
    const base = {
      title: 'Thing',
      description: 'desc',
      status: 'draft' as const,
      github_url: null,
      live_url: null,
      tags: null,
      post_id: null,
    };
    const tooLong = 'a'.repeat(SUBTITLE_MAX_LENGTH + 1);
    expect(() =>
      projectCreateSchema.parse({ ...base, subtitle: tooLong }),
    ).toThrow(ZodError);
    expect(() =>
      projectCreateSchema.parse({ ...base, subtitle: 'a'.repeat(SUBTITLE_MAX_LENGTH) }),
    ).not.toThrow();
  });

  it('rejects a whitespace-only subtitle', () => {
    const input = {
      title: 'Thing',
      description: 'desc',
      status: 'draft' as const,
      github_url: null,
      live_url: null,
      subtitle: '   ',
      tags: null,
      post_id: null,
    };
    expect(() => projectCreateSchema.parse(input)).toThrow(ZodError);
  });

  // The DB CHECK cannot reject a whitespace-only tag (Postgres forbids
  // subqueries inside CHECK, so there is no per-element predicate). The schema
  // is the only place that case is caught.
  it('rejects blank, over-long, empty and over-count tag lists', () => {
    const base = {
      title: 'Thing',
      description: 'desc',
      status: 'draft' as const,
      github_url: null,
      live_url: null,
      subtitle: null,
      post_id: null,
    };
    const cases = [
      ['   '],
      ['a'.repeat(TAG_MAX_LENGTH + 1)],
      [],
      Array.from({ length: TAGS_MAX_COUNT + 1 }, (_, i) => `tag-${i}`),
    ];
    for (const tags of cases) {
      expect(() => projectCreateSchema.parse({ ...base, tags })).toThrow(ZodError);
    }
  });

  it('accepts a tag list at the cardinality ceiling', () => {
    const input = {
      title: 'Thing',
      description: 'desc',
      status: 'draft' as const,
      github_url: null,
      live_url: null,
      subtitle: null,
      tags: Array.from({ length: TAGS_MAX_COUNT }, (_, i) => `tag-${i}`),
      post_id: null,
    };
    expect(() => projectCreateSchema.parse(input)).not.toThrow();
  });

  // The schema is `.strict()`, so a retired column name (`thumb_kind` left the
  // boundary at T46) is rejected outright rather than silently dropped.
  it('rejects an unrecognized key', () => {
    const input = {
      title: 'Thing',
      description: 'desc',
      status: 'draft' as const,
      github_url: null,
      live_url: null,
      subtitle: null,
      tags: null,
      post_id: null,
      thumb_kind: 'disc',
    };
    expect(() => projectCreateSchema.parse(input)).toThrow(ZodError);
  });

  it('rejects URLs longer than 2048 characters', () => {
    // Construct an https URL whose total length exceeds URL_MAX_LENGTH.
    const prefix = 'https://example.com/';
    const overflow = 'a'.repeat(URL_MAX_LENGTH - prefix.length + 1);
    const tooLong = `${prefix}${overflow}`;
    expect(tooLong.length).toBe(URL_MAX_LENGTH + 1);

    const input = {
      title: 'Thing',
      description: 'desc',
      status: 'draft' as const,
      github_url: tooLong,
      live_url: null,
      subtitle: null,
      tags: null,
    };
    expect(() => projectCreateSchema.parse(input)).toThrow(ZodError);
  });
});

describe('projectUpdateSchema', () => {
  it('accepts a payload with image_id and image_after_id as null', () => {
    const input = {
      title: 'Thing',
      description: 'desc',
      status: 'draft' as const,
      image_id: null,
      github_url: null,
      live_url: null,
      subtitle: null,
      tags: null,
      image_after_id: null,
      post_id: null,
    };
    expect(() => projectUpdateSchema.parse(input)).not.toThrow();
  });

  it('accepts a payload with image_id and image_after_id as valid UUIDs', () => {
    const input = {
      title: 'Thing',
      description: 'desc',
      status: 'draft' as const,
      image_id: VALID_UUID_A,
      github_url: null,
      live_url: null,
      subtitle: null,
      tags: null,
      image_after_id: VALID_UUID_B,
      post_id: null,
    };
    expect(() => projectUpdateSchema.parse(input)).not.toThrow();
  });

  it('rejects image_after_id that is not a UUID', () => {
    const input = {
      title: 'Thing',
      description: 'desc',
      status: 'draft' as const,
      image_id: null,
      github_url: null,
      live_url: null,
      subtitle: null,
      tags: null,
      image_after_id: 'not-a-uuid',
      post_id: null,
    };
    try {
      projectUpdateSchema.parse(input);
      throw new Error('expected ZodError to be thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ZodError);
      const issues = (err as ZodError).issues;
      expect(
        issues.some(
          (i) =>
            i.path.join('.') === 'image_after_id' &&
            i.message === 'image_after_id must be a uuid',
        ),
      ).toBe(true);
    }
  });

  // T45.A — `post_id` is a nullable uuid FK into `posts`, mirroring the
  // `image_after_id` empty->null + uuid pattern. Empty-string-to-null
  // coercion happens in the FormData reader (SEC-02); the schema only ever
  // sees the post-coercion shape, so the happy case here asserts `null` is
  // accepted and the error case asserts a non-uuid string is rejected.
  it('zod accepts null/empty post_id and rejects non-uuid', () => {
    const base = {
      title: 'Thing',
      description: 'desc',
      status: 'draft' as const,
      image_id: null,
      github_url: null,
      live_url: null,
      subtitle: null,
      tags: null,
      image_after_id: null,
    };

    // Happy path: `null` (the post-coercion shape an empty form field becomes)
    // is accepted, and a valid uuid is accepted.
    expect(() =>
      projectUpdateSchema.parse({ ...base, post_id: null }),
    ).not.toThrow();
    expect(() =>
      projectUpdateSchema.parse({ ...base, post_id: VALID_UUID_A }),
    ).not.toThrow();

    // Error path: a non-empty, non-uuid string is rejected with the
    // field-tagged message.
    try {
      projectUpdateSchema.parse({ ...base, post_id: 'not-a-uuid' });
      throw new Error('expected ZodError to be thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ZodError);
      const issues = (err as ZodError).issues;
      expect(
        issues.some(
          (i) =>
            i.path.join('.') === 'post_id' &&
            i.message === 'post_id must be a uuid',
        ),
      ).toBe(true);
    }
  });

  // Schema fragments are shared with the create side; the cases below cover
  // one representative of each fragment on the update side to confirm the
  // update schema wires them in correctly. Full case coverage lives in the
  // create-side suite above.

  it('rejects github_url that is not https (update side)', () => {
    const input = {
      title: 'Thing',
      description: 'desc',
      status: 'draft' as const,
      image_id: null,
      github_url: 'http://example.com',
      live_url: null,
      subtitle: null,
      tags: null,
      image_after_id: null,
      post_id: null,
    };
    expect(() => projectUpdateSchema.parse(input)).toThrow(ZodError);
  });

  it('rejects a blank tag entry (update side)', () => {
    const input = {
      title: 'Thing',
      description: 'desc',
      status: 'draft' as const,
      image_id: null,
      github_url: null,
      live_url: null,
      subtitle: null,
      tags: ['next', '   '],
      image_after_id: null,
      post_id: null,
    };
    expect(() => projectUpdateSchema.parse(input)).toThrow(ZodError);
  });

  it('accepts a populated subtitle and tag list (update side)', () => {
    const input = {
      title: 'Thing',
      description: 'desc',
      status: 'draft' as const,
      image_id: null,
      github_url: null,
      live_url: null,
      subtitle: 'one short line',
      tags: ['next', 'supabase'],
      image_after_id: null,
      post_id: null,
    };
    expect(() => projectUpdateSchema.parse(input)).not.toThrow();
  });
});
