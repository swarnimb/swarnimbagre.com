# Security Report: swarnimbagre.com

**Last audit:** 2026-05-21 (audit 20 — T43.F admin component `ProjectMediaField` + `ProjectMediaRow` + `ImageUpload.tsx` CQ-02 split; CLEAR)
**Scope:** T43.F delta. Created — `components/admin/ProjectMediaField.tsx`, `components/admin/ProjectMediaRow.tsx`, `components/admin/ImageUploadFileInput.tsx`, `components/admin/ImageUploadAltInput.tsx`, `lib/admin-project-media-preview.ts`, `lib/admin-project-media-form-state.ts`, `tests/ProjectMediaField.test.tsx`, `tests/ProjectMediaRow.test.tsx`, `tests/admin-project-media-form-state.test.ts`. Modified — `components/admin/ImageUpload.tsx` (CQ-02 split), `components/admin/ProjectForm.tsx`, `app/(admin)/admin/projects/[id]/page.tsx`, `tests/server-actions-manifest.test.ts` (allowlist 12 → 13), `tests/e2e/admin-smoke.spec.ts`. Deleted — `components/admin/ProjectImageField.tsx`. Out of scope: the `saveProjectMedia` Server Action + RPC + migration 010/010a (audited CLEAR in audit 19, unchanged by T43.F); T43.G+ public carousel render surface (re-audit when it lands).
**Status:** CLEAR
**Summary:** 0 Critical / 0 High / 2 Medium / ~19 Low (carry-forward F-3, F-4 Mediums unchanged; F-37 Low unchanged; no new findings opened in audit 20)

**Unresolved Critical/High findings:** None

---

## Verdict

CLEAR. Zero Critical, zero High, zero new findings. T43.F is a client-side form surface over the `saveProjectMedia` Server Action, which was audited CLEAR in audit 19. The form does not bypass the server boundary — it builds a FormData payload and dispatches the action, which validates with `.strict()` zod schemas before any DB call. T43.F adds no new Server Action, no new auth surface, no new raw SQL, no new dependency, no new logging. The two surfaces the S36 handoff flagged for re-audit — Channel 1 form-side rendering and the manifest allowlist 12 → 13 — are both clean.

---

## Audit 20 (2026-05-21) — T43.F review

### SEC-01 — No secrets in source code — PASS

All six new source files and three new test files reviewed. The new code carries only voice-copy string constants (`'+ image'`, `'Save media'`, `'Media saved.'`, etc.), numeric thresholds (`ROWS_SOFT_WARN_THRESHOLD = 10`, `CAPTION_SOFT_WARN_THRESHOLD = 140`), and a typographic drag glyph. Test files use synthetic zero-padded UUID placeholders (`00000000-0000-4000-8000-000000000a43`, `...0000000000a1`) and `https://example.test/...` URLs — no real Supabase URL, key, or environment value. No env-var fallback to a real default. The deleted `ProjectImageField.tsx` removed code; it did not expose anything.

### SEC-02 — Validate and sanitize all inputs at boundaries — PASS

The system boundary is the `saveProjectMedia` Server Action. `ProjectMediaField` builds a FormData payload (`project_id` + `JSON.stringify(rows)`) and dispatches the action — it does not write to the DB directly. Boundary validation is `projectMediaSaveSchema.parse()` inside `saveProjectMediaInternal`, before any Supabase call (audit 19). Both `projectMediaSaveSchema` and `projectMediaRowSchema` carry `.strict()` (verified verbatim this audit) — unknown keys rejected at top-level and per-row.

The form's client-side checks (`isRowComplete` gating the Save button, caption `maxLength={280}`, add-button disable at 20 rows) are UX-only and explicitly non-authoritative — the server zod boundary and the DB row-cap trigger remain the source of truth. A tampered client that skips the gating still hits `.strict()` zod + the RPC's row-cap trigger.

The admin read path `loadAdminProjectMedia(projectId)` receives `project.id` from a project row already fetched via `getProjectById(id)` (which dispatches `notFound()` for a nonexistent id). `getProjectMediaByProjectAdmin` rejects a non-string/empty `projectId` and queries via the Supabase builder's `.eq('project_id', projectId)` — parameterized.

### SEC-03 — Parameterized queries — PASS

`loadAdminProjectMedia` → `getProjectMediaByProjectAdmin` uses `supabase.from('project_media').select(...).eq(...).order(...)` — parameter-bound query builder, no string concatenation. `saveProjectMedia` dispatches via `supabase.rpc('save_project_media', {...})` — parameter-bound (audit 19). T43.F introduces no raw SQL.

### SEC-04 — Authentication and authorization — PASS

The edit page `app/(admin)/admin/projects/[id]/page.tsx` is under `/admin/*`, gated by `middleware.ts` (authentication). `loadAdminProjectMedia` reads via the authenticated server client — RLS `project_media_admin_all` (`for all to authenticated`) applies. `saveProjectMedia` writes via the `save_project_media` RPC: `security invoker` + EXECUTE revoked from `public` and `anon`, granted only to `authenticated` + RLS `project_media_admin_all` (all verified verbatim; audited CLEAR in 19). Single-admin deployment (CONSTRAINT-09): there is no second user, so no horizontal-privilege surface — the `using(true)/with check(true)` admin policy is the documented permissive-admin baseline (F-37), unchanged by T43.F.

### SEC-05 — Never log or expose sensitive data — PASS

T43.F adds no `console.*` calls. `lib/admin-project-media-preview.ts` does not log — DB/signing errors bubble per the CONSTRAINT-14 admin-loud carve-out, surfacing only in the admin's own (auth-gated) browser session; no cross-user exposure. `ProjectMediaField` renders `state.formError` (the resource-agnostic `GENERIC_FORM_ERROR` constant for non-validation failures) — no stack trace, no Supabase error detail, no row data to the wire. The "Media saved." toast carries no data.

### SEC-06 — HTTPS / encryption at rest — N/A

No new transport surface, no new at-rest storage. Vercel HTTPS + Supabase TLS + the private `images` bucket (signed-URL reads) all pre-exist.

### SEC-07 — Never commit sensitive files — PASS

All eight SEC-07 files exist and are `.gitignore`-matched (`session-log.md`, `session-handoff.md`, `framework-issues.md`, `testing-setup.md`, `profile.md`, `CLAUDE.md`, `manifest.md`, `.env.local`). `git status --porcelain` shows only T43.F application code + tests + the in-repo plan file (`docs/plan-phase-4-launch.md` — intentionally tracked, not on the SEC-07 list). The six new T43.F source/test files spot-checked are NOT caught by `.gitignore` — correctly committable. `git log --name-only -8` shows no SEC-07 file in recent history. `docs/security-report.md` (this file) is intentionally tracked — not on the SEC-07 list. No sensitive file staged, committed, or in history.

### SEC-08 — Server Action surface minimization — PASS

T43.F creates no `'use server'` module and adds no export to one. `lib/admin-project-media-preview.ts` and `lib/admin-project-media-form-state.ts` are plain modules (no `'use server'` directive). The form imports the existing single Server Action `saveProjectMedia` as a client-to-server reference — intended usage. The `tests/server-actions-manifest.test.ts` invariant test (allowlist now 13, byte-exact equality against `.next/server/server-reference-manifest.json`) passed in the full build-driven `npm test` run — confirming exactly 13 action IDs in the manifest and no accidental helper leak.

### SEC-09 — Auth-flow uniformity — PASS (not an auth flow; six-channel contract intact)

T43.F is an admin CRUD surface, not an auth flow, so SEC-09 does not strictly apply. The project nonetheless extends a six-channel uniformity contract to all admin mutations; the S36 handoff flagged Channel 1 (form-side rendering) for re-audit:

- **Channel 1 (UI text) — clean.** No XSS: `caption` renders as a controlled `<Textarea value={...}>` (property-set, never `innerHTML`); `altText` renders as a controlled `<Input value={...}>` and as `<img alt={...}>` (React-escaped attribute); the preview `<img src={signedUrl}>` uses a server-generated Supabase Storage signed URL, never user-typed text. No `dangerouslySetInnerHTML` anywhere in T43.F. No enumeration leak: the form surfaces only the generic `state.formError`; zod field errors carry schema-derived strings on allowlisted roots only (audit 19).
- **Channels 2–6** belong to the `saveProjectMedia` action and are unchanged from audit 19 (uniform envelope, `padToFloor` timing floor, one action ID, no `Set-Cookie` mutation, always-200 resolve). T43.F's `useActionState`/`useTransition` dispatch is the standard client pattern and alters none of them.

### Additional vulnerability-pattern review

- **Mass assignment / parameter pollution — closed.** Both zod schemas are `.strict()`. `toWirePayload` constructs each wire row as exactly `{image_id, image_after_id, caption}` — it never sends `id`, `uid`, `kind`, or `order_index`. `order_index` is derived server-side by the RPC via `WITH ORDINALITY` (a client cannot inject ordering). The `id` field added to `AdminProjectMediaRow` in T43.F is loader-output only; it never reaches the wire, and `.strict()` would reject it if a tampered client forced it. No IDOR — the RPC delete-then-inserts all rows for the validated `project_id`; row identity is positional, not id-addressable.
- **Injection** — none (SEC-03).
- **Broken access control** — single-admin model; no horizontal-escalation surface.
- **Insecure dependencies** — T43.F adds zero new dependencies. The pre-existing `npm audit` 8-moderate finding is unchanged and out of scope.
- **F-37 class (render-side scheme guard)** — considered: T43.F's only rendered URL is the server-generated Storage signed URL, not a user-influenced value. No new instance of the F-37 class.

### Informational (not a finding)

`ProjectMediaField` renders `state.formError` but does not render `state.fieldErrors` per-field. A zod validation error returning `{status:'error', fieldErrors}` (no `formError`) would therefore display nothing to the operator. This is a UX-completeness gap, not a security issue — showing *less* is not a leak, and the client-side `isRowComplete` gating prevents the common validation-failure paths from ever reaching the server. Referred to `@code-review` / `@qa` for UX assessment.

---

## Carry-forward (prior audits, not re-walked — audit 20 is a T43.F delta audit)

### Medium
- **F-3** — `EMAIL_SCHEMA` length cap (`lib/auth-internal.ts:20`). Recommend `z.string().min(3).max(254).email()`. Carry-forward, unchanged — T43.F does not touch this file.
- **F-4** — Callback handler OTP type set width (`app/(admin)/admin/auth/callback/route.ts`). Recommend narrowing to `new Set(['email', 'magiclink'])`. Carry-forward, unchanged — T43.F does not touch this file.

### Low
F-6–F-11, F-20–F-25, F-27, F-28 — prior-audit carry-forwards. F-31–F-35 — audit 16 Lows. F-37 — audit 18 Low (render-side scheme guard on TypoIcon), deferred carry-forward. F-36 — RESOLVED in re-audit 17b.

---

## Summary Table

| Severity | Count | F-codes |
|---|---|---|
| Critical | 0 | — |
| High | 0 | — |
| Medium | 2 | F-3 (carry), F-4 (carry) |
| Low | ~19 | F-31–F-35 (audit 16); F-37 (audit 18); F-6–F-11, F-20–F-25, F-27, F-28 (carry) |

**Opened audit 20:** None.
**Closed audit 20:** None.
**Verdict:** CLEAR — no Critical or High findings. T43.F ships. Next security review point: T43.G (public `ProjectMediaCarousel` render surface — XSS audit of the caption render path on the public site, multi-instance DOM scoping) and T43.I close-out.
