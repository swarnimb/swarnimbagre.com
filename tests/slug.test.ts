import { describe, it, expect } from 'vitest';
import { slugify } from '@/lib/slug';

/**
 * T21 acceptance — slug helper. Two cases:
 *   - Happy: `slugify produces lowercase dashed slug`.
 *   - Edge:  `slugify handles unicode and punctuation` — diacritic strip + trim.
 *
 * The function is pure; no DB, no async. The mutation layer (`lib/admin-
 * mutations-internal.ts`) calls `slugify` directly and rejects an empty
 * derived slug as a `ServiceError`, so the "empty slug" path is tested
 * indirectly via `tests/admin-mutations.test.ts`.
 */

describe('slugify', () => {
  it('produces a lowercase dashed slug from a plain title', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('handles unicode and punctuation by stripping diacritics and collapsing runs', () => {
    // Diacritic strip turns Hellö → Hello; punctuation collapses to a single
    // dash; trailing dash/whitespace are trimmed.
    expect(slugify('Hellö, World! ')).toBe('hello-world');
  });

  it('collapses leading and trailing punctuation', () => {
    expect(slugify('  ---Side Project---  ')).toBe('side-project');
  });

  it('returns an empty string when the title has no slug-eligible characters', () => {
    expect(slugify('   !!!   ')).toBe('');
  });

  it('preserves alphanumeric runs and lowercases mixed case', () => {
    expect(slugify('OpenClaw v2 / 2026')).toBe('openclaw-v2-2026');
  });
});
