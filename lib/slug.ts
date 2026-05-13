/**
 * Slug helpers.
 *
 * The admin auto-generates a URL slug from the row's title on create. Edit
 * never changes the slug on a published row — both the app (`ProjectForm`,
 * `updateProjectInternal`) and the database (migration 008 trigger) enforce
 * the lock. The slugify rules below are pure string normalization; they have
 * no opinion about uniqueness — UNIQUE on `projects.slug` is the DB-side guard
 * and a name collision surfaces as a `ServiceError` from the mutation wrapper.
 */

/**
 * Maximum slug length. Keeps URLs short and well under the Postgres `text`
 * practical limit. Mirrors the 200-char title cap; if a title is at the cap
 * and the slug ends up shorter, that is fine — the slug is derived, not
 * round-tripped from the title.
 */
const SLUG_MAX_LENGTH = 200;

/**
 * Pattern matching combining-mark codepoints emitted by NFKD normalization
 * (Unicode block U+0300..U+036F). Stripping these turns `é` into `e`, `ö`
 * into `o`, etc. — the input to step 3 of {@link slugify}.
 */
const COMBINING_MARK_PATTERN = /[̀-ͯ]/g;

/** Pattern matching any character that is not ASCII alphanumeric. */
const NON_ALNUM_PATTERN = /[^a-z0-9]+/g;

/** Pattern matching one or more leading/trailing dashes. */
const TRIM_DASH_PATTERN = /^-+|-+$/g;

/**
 * Generate a URL slug from a title.
 *
 * Pipeline:
 *   1. Lowercase.
 *   2. NFKD-normalize and strip combining marks — so `é` becomes `e`,
 *      `ö` becomes `o`, etc. This is what the T21 spec test
 *      `"slugify handles unicode and punctuation"` exercises.
 *   3. Replace any run of non-`[a-z0-9]` characters with a single dash.
 *   4. Trim leading/trailing dashes.
 *   5. Cap at {@link SLUG_MAX_LENGTH}.
 *
 * The function is deterministic and total — every string input yields a
 * (possibly empty) string output. An empty result is a valid signal that
 * the caller passed a title with no slug-eligible characters; callers
 * decide what to do (the mutation layer treats an empty slug as a
 * validation failure rather than silently inserting `''`).
 *
 * @param title Raw human-typed title. Whitespace, punctuation, and Unicode
 *              accents are all permitted.
 * @returns Lowercase, dash-separated slug. Possibly empty.
 */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(COMBINING_MARK_PATTERN, '')
    .replace(NON_ALNUM_PATTERN, '-')
    .replace(TRIM_DASH_PATTERN, '')
    .slice(0, SLUG_MAX_LENGTH);
}
