/**
 * Display helpers for post rows on `/writing`.
 *
 * The redesign's writing list wants a "May 2026" date string and a one-line
 * excerpt. The posts table carries neither: it has `created_at` (a timestamp)
 * and `content` (markdown). Both are derived here rather than added as
 * columns, because a stored excerpt is a second thing to keep in sync with
 * the body and it would drift the moment a post is edited.
 */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

const DEFAULT_EXCERPT_CHARS = 180;

/**
 * Format a post timestamp as "May 2026".
 *
 * Uses UTC parts deliberately: the server and the reader are in different
 * timezones, and a post published late on the 31st should not appear to
 * belong to the next month depending on who is looking.
 *
 * @param createdAt ISO timestamp from the DB.
 * @returns The formatted month and year, or an empty string if unparseable.
 */
export function formatPostDate(createdAt: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return '';
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/**
 * Reduce markdown body text to a plain one-line excerpt.
 *
 * Strips the constructs that would otherwise leak punctuation into the list
 * (fenced code, images, links, headings, emphasis, blockquotes, list
 * markers), collapses whitespace, then truncates on a word boundary.
 *
 * The row also clamps to one line in CSS; this keeps the DOM honest so the
 * clamp is a visual safeguard rather than the only thing hiding a wall of
 * markdown.
 *
 * @param content  Raw markdown.
 * @param maxChars Maximum length before truncation.
 * @returns A plain-text excerpt, possibly ending in an ellipsis.
 */
export function excerptFromContent(
  content: string,
  maxChars: number = DEFAULT_EXCERPT_CHARS,
): string {
  if (!content) return '';

  const plain = content
    .replace(/```[\s\S]*?```/g, ' ')       // fenced code blocks
    .replace(/`[^`]*`/g, ' ')              // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links -> their text
    .replace(/^\s{0,3}#{1,6}\s+/gm, ' ')   // headings
    .replace(/^\s{0,3}>\s?/gm, ' ')        // blockquotes
    .replace(/^\s{0,3}(?:[-*+]|\d+\.)\s+/gm, ' ') // list markers
    .replace(/[*_~]/g, '')                 // emphasis
    .replace(/\s+/g, ' ')
    .trim();

  if (plain.length <= maxChars) return plain;

  const cut = plain.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(' ');
  const truncated = lastSpace > 0 ? cut.slice(0, lastSpace) : cut;
  return `${truncated.replace(/[.,;:]$/, '')}…`;
}
