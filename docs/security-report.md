# Security Report: swarnimbagre.com

**Last audit:** 2026-05-11
**Scope:** T12 — Markdown rendering (`lib/markdown.ts`, `components/public/MarkdownContent.tsx`, `tests/markdown.test.ts`) + supply-chain hygiene for newly added deps (`marked@18.0.3`, `dompurify@3.4.2`, `@types/dompurify@3.0.5`) + SEC-07 sensitive-file exposure across the repo.
**Status:** CLEAR

**Summary:** 0 Critical / 0 High / 0 Medium / 4 Low

**Unresolved Critical/High findings:** None

---

## Audit method

Three independent sub-agents reviewed the code with no shared priming:

1. **XSS red team** — exhaustively attempted bypasses against the DOMPurify whitelist (tag bypasses, attribute bypasses, URI scheme bypasses, mXSS, marked parser quirks, deferred-render race conditions, CSP gaps).
2. **Supply chain** — `npm audit`, version currency, lockfile integrity, transitive surface, known CVE history for marked + dompurify.
3. **Rules + SEC-07 compliance** — line-by-line against `rules/security.md` SEC-01 through SEC-07 + `.gitignore` coverage audit + git history scan + data-flow trace from DB to render.

---

## Scope A — SEC-01 through SEC-07 compliance on T12 code

| Rule | Status | Note |
|---|---|---|
| SEC-01 (no secrets in code) | PASS | No hardcoded keys/tokens in any T12 file. |
| SEC-02 (input validation at boundaries) | PASS | Two-stage: `assertSlug` validates URL slug at the DB boundary (`lib/db.ts:109`); DOMPurify whitelist sanitizes markdown at the render boundary (`lib/markdown.ts:22`). |
| SEC-03 (parameterized queries) | PASS | All Supabase queries use `.eq()` / `.select()` builders. No string concatenation. |
| SEC-04 (auth on protected ops) | N/A | T12 is read-only public content. |
| SEC-05 (no PII in logs) | PASS | `logDbError` logs only error code + message, never row data. Component-level errors don't reach client. |
| SEC-06 (HTTPS, encryption at rest) | N/A | Deployment concern, not in T12 code. |
| SEC-07 (no sensitive files in VCS) | PASS | `.gitignore` covers all SEC-07-listed files. None staged. None in git history. No secrets in `package.json`, lockfile, or config files. |

---

## Scope B — XSS red team result

The red-team agent attempted bypasses across all common XSS vector classes and **found nothing exploitable**:

- **Blocked tags** (verified stripped): `<script>`, `<svg>`, `<iframe>`, `<object>`, `<embed>`, `<form>`, `<input>`, `<link>`, `<meta>`, `<style>`, `<base>`, `<math>`, `<template>`, `<noscript>`, `<title>`. None are in `ALLOWED_TAGS`.
- **Blocked attributes** (verified stripped): `onerror`, `onload`, `onclick`, `formaction`, `xlink:href`, `style`, `srcset`, `srcdoc`, `ping`, all `data-*`. `ALLOWED_ATTR = [href, src, alt]` is enforced per-tag.
- **URI scheme bypasses**: `javascript:`, `data:` (in `<a>` context), `vbscript:`, unicode/whitespace-evasion variants — all neutralized by DOMPurify's default `ALLOWED_URI_REGEXP`.
- **mXSS**: DOMPurify 3.4.2 includes patches for all publicly known mXSS bypasses (DOM clobbering, SVG `<use>`).
- **Parser quirks**: marked's HTML passthrough emits raw `<script>` from markdown sources, which DOMPurify then strips at the next layer.
- **Deferred-render race**: `MarkdownContent` re-runs the `useEffect` whenever `md` changes (dep array `[md]`); there is no path where stale unsanitized HTML reaches the DOM.

---

## Scope C — Supply chain

`npm audit --json`: 7 moderate advisories, all in unrelated upstream packages (vitest, vite, esbuild, postcss, next). **Zero advisories** for `marked`, `dompurify`, or their transitive deps. Both packages are installed at the latest patch (`marked@18.0.3`, `dompurify@3.4.2`). `package-lock.json` present and committed.

---

## Findings

### LOW — No Content-Security-Policy configured

**Rule violated:** Defense-in-depth (not in rules/security.md; OWASP A05 — security misconfiguration).

**Founder Brief**
**Decided:** The site has no CSP HTTP header set; if a sanitization bypass ever slipped through DOMPurify, an injected script would execute without a second line of defense.
**Means for your product:** Today, no measurable risk — DOMPurify is the primary defense and is holding. But security best practice is layered: CSP catches what sanitization missed and shrinks the blast radius of any future bypass.
**Check before approving:** When the fix lands, load the site in a browser, open DevTools Network → Headers, confirm `Content-Security-Policy` is set on document responses, and check the console for any CSP violation reports.
**What this closes off:** Nothing meaningful.

**What is wrong:** `next.config.ts`, `middleware.ts`, and `app/layout.tsx` contain no `Content-Security-Policy` header configuration.

**What could go wrong:** If a future DOMPurify CVE or whitelist mistake lets a `<script>` or inline-event-handler through, the browser will execute it. CSP would block inline scripts and limit script sources to first-party origins.

**How to fix it:** Add a CSP header in `next.config.ts` via `headers()` or in `middleware.ts`. Starting policy: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.supabase.co; font-src 'self'; connect-src 'self' https://*.supabase.co; frame-ancestors 'none'`. Tune `style-src` once the design source's inline-style usage is mapped.

---

### LOW — `@types/dompurify@3.0.5` is outdated and likely deprecated

**Rule violated:** Build hygiene (not security-critical; documented for completeness).

**Founder Brief**
**Decided:** The TypeScript type-definitions package for DOMPurify is over a year behind the runtime version.
**Means for your product:** Zero runtime impact — the actual DOMPurify code is current and enforcing the whitelist correctly. The risk is developer-experience: future code that uses newer DOMPurify config options won't get accurate type-checking, which could mask a config typo at build time.
**Check before approving:** After the fix, run `npm ls @types/dompurify` and `npm ls dompurify` — confirm matching major versions. Run `tsc --noEmit` to confirm no new type errors.
**What this closes off:** Nothing.

**What is wrong:** `package.json` declares `@types/dompurify@3.0.5` while runtime is `dompurify@3.4.2`. DOMPurify started bundling its own types in v3.2.0+, so the `@types/dompurify` package is effectively a stale stub.

**What could go wrong:** Future T-tasks may misconfigure DOMPurify (e.g., typo a new config key) without TS catching it. Not exploitable directly — runtime behavior is unaffected.

**How to fix it:** Remove `@types/dompurify` from `devDependencies` and let TypeScript pick up the types that ship inside the `dompurify` package itself. Verify with `tsc --noEmit`.

---

### LOW — Caret pins on security-sensitive deps allow minor drift

**Rule violated:** Best-practice (not in rules/security.md).

**Founder Brief**
**Decided:** `marked` and `dompurify` use caret pins (`^18.0.3`, `^3.4.2`), so `npm install` on a fresh checkout could pull a newer minor version.
**Means for your product:** In practice, low risk: `package-lock.json` is committed and `npm ci` pins exact versions for reproducibility. The exposure only exists for someone who runs `npm install` instead of `npm ci` and gets a different minor version with a regression.
**Check before approving:** If the fix lands, verify the lockfile still resolves to `18.0.3` / `3.4.2` and CI continues to use `npm ci`.
**What this closes off:** Friction if you ever want to take a routine minor bump — manual review required.

**What is wrong:** Caret pins on two deps where minor-version changes could (historically have) introduced sanitization regressions.

**What could go wrong:** A fresh `npm install` (not `npm ci`) on a new machine pulls a new minor version that introduces an mXSS regression or marked HTML-emission change before manual review.

**How to fix it:** Either (a) standardize on `npm ci` in CI/local-setup docs (likely already true), or (b) pin exactly: `"marked": "18.0.3"`, `"dompurify": "3.4.2"`. (a) is lower-friction; (b) is more defensive. Recommend (a) — it's the standard practice.

---

### LOW — Test coverage gap on non-tested XSS vector classes

**Rule violated:** TS-04 (security-critical test coverage, soft interpretation).

**Founder Brief**
**Decided:** The 6 tests in `tests/markdown.test.ts` cover the most common XSS vectors but not the full vector matrix.
**Means for your product:** No current exploit — the red-team review confirmed all uncovered vectors are blocked by the whitelist anyway. The cost is regression-detection: if someone widens the whitelist later, the tests won't catch every new opening.
**Check before approving:** After the fix, confirm new tests fail when the whitelist is intentionally widened, then pass when reverted.
**What this closes off:** Nothing.

**What is wrong:** No tests for `<svg>`, `<iframe>`, `<object>`, `<form>`, `data:` URIs, `vbscript:` protocol, or unicode-escape protocol bypasses.

**What could go wrong:** A future T-task that widens `ALLOWED_TAGS` or relaxes the URI regex could open one of these vectors with no failing test to flag it.

**How to fix it:** Add ~5 more tests for the above vector classes. Not a T12 blocker — fold into Phase 4 (launch prep) hardening, or open a tracked debt item.

---

## Out-of-scope items surfaced

These were discovered during the audit but lie outside T12's scope. Documented here so they're not lost:

- **7 moderate-severity npm advisories** in upstream deps (vitest, vite, esbuild, postcss, next). None affect the markdown-rendering path. Recommend addressing during `@launch-prep` or whenever the next dep upgrade pass is scheduled.

---

## Verdict

CLEAR — no critical or high findings. T12 may proceed past the security gate. The four LOW findings are documented and should be addressed during Phase 4 launch prep or earlier at your discretion.

`@dev` may proceed to the next step in the Completion Order (`@code-review` for Phase 1 completion, then `@qa` for foundation-milestone shippability).
