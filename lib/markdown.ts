import { marked } from 'marked';
import DOMPurify from 'dompurify';

/**
 * Render a raw Markdown string to a sanitized HTML string.
 *
 * Sanitization runs through DOMPurify with a locked tag whitelist:
 * `p, ul, ol, li, blockquote, code, pre, em, strong, a, h1, h2, h3, h4, img`.
 * Allowed attributes are `href` (on `<a>`), `src` and `alt` (on `<img>`).
 * Everything outside the whitelist — including inline event handlers,
 * `<script>` tags, and `javascript:` URLs — is stripped.
 *
 * Must run in a window context (browser or jsdom). Calling this during
 * Next.js server-side render will throw, by design — callers defer the
 * call to `useEffect` so it executes only after client hydration.
 *
 * @param rawMd Raw Markdown source.
 * @returns Sanitized HTML string safe to inject via `dangerouslySetInnerHTML`.
 */
export function renderMarkdown(rawMd: string): string {
  const html = marked.parse(rawMd, { async: false }) as string;
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'em', 'strong', 'a', 'h1', 'h2', 'h3', 'h4', 'img'],
    ALLOWED_ATTR: ['href', 'src', 'alt'],
  });
}
