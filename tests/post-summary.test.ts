import { describe, it, expect } from 'vitest';
import { formatPostDate, excerptFromContent } from '@/lib/post-summary';

/**
 * T46: display helpers for the `/writing` list. Both are pure: the month
 * label and the excerpt are derived from `created_at` and `content` rather
 * than stored, so a post edit can never leave them stale.
 */

describe('formatPostDate', () => {
  it('formats an ISO timestamp as month and year', () => {
    expect(formatPostDate('2026-05-13T00:00:00.000Z')).toBe('May 2026');
  });

  // UTC parts are used deliberately: a post published late on the last of the
  // month must not slide into the next one depending on the reader's timezone.
  it('reads the month in UTC, not local time', () => {
    expect(formatPostDate('2026-05-31T23:59:59.000Z')).toBe('May 2026');
  });

  it('returns an empty string for an unparseable timestamp', () => {
    expect(formatPostDate('not a date')).toBe('');
  });
});

describe('excerptFromContent', () => {
  it('strips markdown constructs down to plain prose', () => {
    const markdown = [
      '# A heading',
      '',
      'Some **bold** text with a [link](https://example.com) and `code`.',
      '',
      '- a list item',
    ].join('\n');

    expect(excerptFromContent(markdown)).toBe(
      'A heading Some bold text with a link and . a list item',
    );
  });

  it('truncates on a word boundary with an ellipsis', () => {
    const result = excerptFromContent('alpha beta gamma delta', 12);
    expect(result).toBe('alpha beta…');
  });

  it('returns an empty string for empty content', () => {
    expect(excerptFromContent('')).toBe('');
  });
});
