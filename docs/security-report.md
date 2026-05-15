# Security Report: swarnimbagre.com

**Last audit:** 2026-05-14 (audit 15)
**Scope:** BLOCKING-01 fix delta over audit 14 (CLEAR baseline). Modified files: `components/admin/ImageUpload.tsx` (inner `<form action={formAction}>` → `<div>` wrapper, `type="submit"` → `type="button" onClick={handleUpload}`, manual `FormData` construction inside `useTransition`/`startTransition`, `useActionState` envelope unchanged), `tests/ImageUpload.test.tsx` (added "renders no <form> element" regression test pin, renamed submit-button references to upload-button). Unchanged: `lib/admin-images-mutations.ts` (the `uploadImage` Server Action wrapper), `lib/admin-images-mutations-internal.ts` (throwing helper + zod schema + file validation + Storage + insert + compensating delete), `lib/admin-images-mutations-types.ts` (state envelope shape, allowed MIME, max bytes, alt-text length cap), all other admin code.
**Status:** CLEAR
**Summary:** 0 Critical / 0 High / 2 Medium / 14 Low (delta over audit 14: 0 / 0 / 0 / 0)
**Unresolved Critical/High findings:** None

---

## Verdict

The BLOCKING-01 fix swaps the client-side trigger from a nested `<form action={formAction}>` (which was illegal HTML inside the parent `ProjectForm` / `PostForm` `<form>`) to a `<div>` wrapper with a manual `<button type="button" onClick={handleUpload}>` that constructs a `FormData` from refs/state and calls `dispatch(formData)` inside `startTransition`. Every observable channel that the `uploadImage` Server Action exposes is determined by the action wrapper in `lib/admin-images-mutations.ts` — which was NOT touched by this fix — so the six-channel uniformity contract that audit 14 cleared is preserved by construction. The qa-report's flagged risks (channels 2 + 5) both resolve as UNCHANGED on inspection: a `<form action={formAction}>` in a React-19 client component is already wired to the Server Action via the same RSC dispatch path that the new manual `dispatch(formData)` call uses; both paths land on the same action ID, return the same envelope shape, run through the same `padToFloor` floor in the wrapper's `finally`, and emit the same response headers.

---

## Channel-by-channel verdict (delta-relevant)

### Channel 2 — Response body shape: UNCHANGED

The `uploadImage` Server Action's wrapper code (`lib/admin-images-mutations.ts:111-136`) is byte-identical to the audit 14 baseline. It still resolves with the same `ImageMutationState` envelope: `{status: 'ok', image}` on success, `{status: 'error', fieldErrors}` on zod validation failure, `{status: 'error', formError: GENERIC_FORM_ERROR}` on any non-validation throw. The wrapper still never throws to the wire. The wire-level RSC payload that the `useActionState` reducer consumes is the same in both pre-fix (`<form action={formAction}>`) and post-fix (`dispatch(formData)`) paths — both routes flow through Next.js's `next/dist/server/app-render/action-handler.js` and produce the same Flight frame. The pre-fix path was also Server-Action-based (a `<form action={serverAction}>` in a React-19 client component is bound to the action via React's form-action protocol, NOT a true HTTP form POST to a route handler), so the wire shape was already RSC; there is no protocol switch in this fix.

### Channel 5 — Server Action surface: UNCHANGED

Live build manifest (`.next/server/server-reference-manifest.json`) inspected directly: exactly 12 action IDs in the `node` map, 0 in `edge`. The 12 names match the SEC-09 allowlist verbatim: `createPost`, `createProject`, `deleteOrphanImages`, `deletePost`, `deleteProject`, `deleteStat`, `insertStat`, `signInWithMagicLink`, `signOut`, `updatePost`, `updateProject`, `uploadImage`. The `uploadImage` action ID hash `6020ef4500f09f447d4dd0a086e6a7c605019ff3ec` is unchanged from audit 14 (the action body in `lib/admin-images-mutations.ts` is byte-identical), and the workers map shows reachability from the same five pages: `app/(admin)/admin/posts/new/page`, `app/(admin)/admin/posts/[id]/page`, `app/(admin)/admin/projects/new/page`, `app/(admin)/admin/projects/[id]/page`, `app/(admin)/admin/images/page`. The allowlist test (`tests/server-actions-manifest.test.ts:28-41`) still pins 12 with `Set` equality; any drift in either direction fails loud.

### Channel 1 — UI text: UNCHANGED

`ImageUpload.tsx` introduces no new visible strings in the BLOCKING-01 fix. The two file-level pre-check messages (`FILE_TOO_LARGE_MESSAGE`, `FILE_TYPE_NOT_ALLOWED_MESSAGE`) and the field-error rendering paths (`fileError`, `altTextError`, top-level `formError`) are unchanged from the pre-fix module. The button label (`'Uploading'` / `'Upload'`) is unchanged. The manual `handleUpload` writes nothing user-facing — error/state surfaces still flow exclusively through the `state` envelope returned by the Server Action.

### Channel 3 — Timing: UNCHANGED

`useTransition` adds a microtask boundary between the user click and the action dispatch — not an observable timing channel. The Server Action's `MIN_DURATION_MS = 750ms` floor in `lib/admin-images-mutations.ts::padToFloor` runs in the wrapper's `finally`, so every outcome (success, zod error, throwing-helper rejection) still pads to the floor. No new outcome-conditional code paths exist.

### Channel 4 — Headers / cookies: UNCHANGED

No `revalidatePath` introduced (none was present pre-fix either; refresh is parent-driven via the `onUpload(image)` callback). PKCE cookie behaviour unchanged — the auth flow is independent of the image upload module. RSC payload cache headers identical (no manual `Cache-Control` / `Vary` set anywhere in the upload path).

### Channel 6 — Status codes: UNCHANGED

RSC Server Action responses are 200 across success + error envelopes; the wrapper never throws to the wire. The fix does not alter the response framing.

---

## Validation preserved (SEC-02): YES

Every input validation that the pre-fix `<form>`-based path performed is still in force after the fix:

- **`file` presence** — client-side: `handleUpload` early-returns if `submitDisabled || file === null` (`ImageUpload.tsx:139`); the button is also disabled until a file is picked (`submitDisabled` includes `file === null` at line 122). Server-side: `uploadImageInternal` (untouched) re-validates via the zod schema in `lib/admin-images-mutations-internal.ts`, which is the authoritative boundary.
- **Alt-text non-empty** — client-side: `submitDisabled` includes `altText.trim().length === 0` (`:123`), and the regression test in `tests/ImageUpload.test.tsx:60-62` pins that whitespace-only alt text does not satisfy the gate. Server-side: zod schema enforces `.min(1)` (untouched).
- **MIME-type allowlist** — client-side: `onFileChange` checks against `ALLOWED_MIME_TYPES` (`:111-113`); the `<input accept={ALLOWED_MIME_TYPES.join(',')}>` is also in place (`:163`). Server-side: zod schema validates `file.type` (untouched, authoritative).
- **File size cap** — client-side: `onFileChange` checks `next.size > MAX_FILE_BYTES` (`:115-117`). Server-side: zod schema enforces the same cap (untouched, authoritative).
- **`parentType` / `parentId` shape** — client-side: prop-driven, not user-input. Server-side: zod schema validates `parentType` is `'projects' | 'posts'` and `parentId` is a UUID (untouched).
- **`altText` length cap** — client-side: `<input maxLength={ALT_TEXT_MAX_LENGTH}>` (`:187`). Server-side: zod schema enforces the same cap (untouched).

All client-side checks are UX-side feedback only; the server boundary in `lib/admin-images-mutations-internal.ts` is the authoritative validator and is unchanged. Critically, the manual `handleUpload` does NOT call any pre-validation that bypasses the gate — it just re-uses the same `submitDisabled` predicate the disabled `<button>` uses, so no path reaches `dispatch(formData)` without the gate having held.

### XSS (incidental check)

The new manual handler does not render alt text or file metadata directly — `state.image.alt` (when surfaced) is React-escaped at the consumer (`ProjectForm` / `PostForm`, untouched). No `dangerouslySetInnerHTML` introduced. Pass.

### React-19 pattern correctness

`startTransition(() => dispatch(formData))` wraps the dispatch (correct — React-19 requires Action calls to occur inside a transition for `useActionState`'s `isPending` to track the in-flight action). `FormData` construction is outside the transition, which is the documented pattern (transitions exist to let React mark the work as non-urgent; constructing the payload synchronously before the transition is correct). No code-smell, no security concern.

---

## Manifest invariant: 12 actions / no drift

Live build manifest verified: 12 entries in `node`, 0 in `edge`. `uploadImage` action ID hash unchanged from audit 14. Workers map shows reachability from the 5 expected pages. SEC-09 allowlist test (`tests/server-actions-manifest.test.ts:28-41`) pins exactly these 12 names with `Set` equality.

---

## New findings: None

The BLOCKING-01 fix is a client-side composition refactor (nested `<form>` → `<div>` wrapper + manual dispatch). It introduces no new server-side surface, no new validation paths, no new user-input channels, no new cookies, no new headers, no new error strings. The Server Action it dispatches to is byte-identical to the audit 14 baseline. Every SEC constraint that audit 14 cleared remains satisfied by construction.

### SEC rule re-verification (delta-only)

- **SEC-01 (no secrets in code).** CLEAR. `ImageUpload.tsx` is a client component; reads no env vars, no credentials, no tokens.
- **SEC-02 (input validation at boundary).** CLEAR. See "Validation preserved" above.
- **SEC-03 (parameterized queries).** N/A for the modified file (no DB calls in the client component). Server-side `uploadImageInternal` (unchanged) uses Supabase query builder exclusively.
- **SEC-04 (auth + authz).** CLEAR. The Server Action runs the user-context Supabase client + RLS `images_admin_all`; the manual dispatch path lands on the same action with the same auth guarantees. The `/admin/:path*` middleware gate on the parent pages is unchanged.
- **SEC-05 (no sensitive data in logs).** CLEAR. The new client-side handler does no logging.
- **SEC-07 (no sensitive files in VCS).** CLEAR. Only `components/admin/ImageUpload.tsx` and `tests/ImageUpload.test.tsx` were modified — both application code, both already covered by the standard `.gitignore`'s lack of an exclude.
- **SEC-08 (Server Action surface minimization).** CLEAR. No new `'use server'` modules. No new exports from existing `'use server'` modules. The manual dispatch path consumes the same single `uploadImage` action.
- **SEC-09 (uniform response across channels).** CLEAR. See per-channel walk above; all six channels are UNCHANGED relative to audit 14's CLEAR baseline.

---

## Carry-forward (audit 14)

2 Medium + 14 Low unchanged. T28-fix (BLOCKING-01) does not interact with any of them.

### Medium

- **F-3 (Medium, carry-forward, unchanged):** Zod email schema in `lib/auth-internal.ts:20` has no length cap. Recommended `z.string().min(3).max(254).email()`.
- **F-4 (Medium, carry-forward, unchanged):** Callback handler accepts overly wide OTP type set in `app/(admin)/admin/auth/callback/route.ts`. Recommended narrow to `new Set(['email', 'magiclink'])`.

### Low

F-6, F-7, F-8, F-9, F-10, F-11, F-20, F-21, F-22, F-23, F-24, F-25, F-27, F-28 — all carry-forward from prior audits, none regressed or extended by the BLOCKING-01 fix.

(F-26 remains CLOSED per audit 12.)

---

## Regression-test verification

`tests/ImageUpload.test.tsx:70-88` — the new "renders no <form> element" test correctly pins BLOCKING-01: it renders `<ImageUpload>` and asserts `container.querySelector('form')` is `null`. The test reads cleanly, exercises the production code path (no mocks beyond the standard `uploadAction` stub), and would fail loud if a future change reintroduced a `<form>` wrapper. The pre-existing alt-text gate test at `:32-67` is unchanged in semantics — only the `submitButton` variable name was renamed to `uploadButton`, matching the new `type="button"`.

---

## Summary Table

| Severity | Count | F-codes |
|---|---|---|
| Critical | 0 | — |
| High | 0 | — |
| Medium | 2 | F-3, F-4 |
| Low | 14 | F-6, F-7, F-8, F-9, F-10, F-11, F-20, F-21, F-22, F-23, F-24, F-25, F-27, F-28 |

**Closed this audit:** None.
**Opened this audit:** None.

**Verdict:** CLEAR — no Critical or High findings, no new findings of any severity. The BLOCKING-01 fix is a client-side composition refactor that preserves the audit-14-cleared six-channel uniformity contract by construction: the Server Action wrapper it dispatches to is byte-identical, the manifest is unchanged at 12 actions with the same `uploadImage` action ID hash, and every input-validation gate (file presence, alt-text non-empty, MIME allowlist, file size cap, parent shape, alt-text length cap) is preserved at both the client gate and the authoritative server boundary. The new regression test pins `<form>` absence so the nested-form bug cannot return.

**Path forward:** T28 (BLOCKING-01 fix) is CLEAR. `@qa` can proceed once smoke test re-runs green.

## Status: CLEAR
